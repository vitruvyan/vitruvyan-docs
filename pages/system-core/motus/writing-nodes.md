---
title: Writing nodes
---

# Writing nodes

All of the intelligence lives here. Motus routes, records and refuses; it never
decides what is true. This page is the protocol a node must satisfy and the
three mistakes a first integration reliably makes.

> Runnable versions of everything below are in the Motus repository:
> `examples/05_how_a_node_reports.py` and `examples/06_effects_and_receipts.py`.

---

## The shape

A node is a plain callable with one of two signatures:

```python
def check(state: State) -> State: ...
def check(state: State, ctx: RunContext) -> State: ...
```

State goes in, state comes out. The returned state is what the run commits;
whatever the node did internally before returning never reached the run. Ask
for `ctx` when you need the run's clock, randomness, identity, or when you must
declare an effect — never `datetime.now()` directly, because ambient
nondeterminism that does not pass through `RunContext` is invisible to replay.

A node may not import runtime internals, spawn concurrency that outlives the
call, read topology or environment flags to change behaviour, or block on human
input. Variation enters through state, never through configuration read behind
the trace's back.

## The three things a node can say

This is the section worth reading twice. **The mistake that costs most is
treating "the check did not pass" as an error.**

| what happened | is it an error? | what the node does |
|---|---|---|
| the source is unreachable, the DB is down | **yes** | `raise` |
| the quotation is not in the source | **no**, it is a result | `Rejection` + `Decision` |
| clean, but a human must sign it | **no**, it is a result | `Decision` + terminal node |

### 1. A real error: raise

```python
def fetch(state: State) -> State:
    text = archive.get()          # ConnectionError propagates
    return state.with_fact(Fact("source_length", len(text), "archive.org", NOW))
```

A node fails by raising. The trace separates **what the attempt did**
(`returned | raised | cancelled`) from **what the runner did about it**
(`commit | retry | abort | continue`). A raised attempt handed nothing back, so
its writes are structurally empty in the trace — but what it *consumed* before
failing is preserved, because that is evidence of what it read.

Retries are declared per node and default to **one attempt, meaning none**:

```python
Runtime(SPEC, nodes, max_attempts={"fetch": 3, "check_sources": 3})
```

Retrying a network fetch is sensible; retrying a decision is not. Every attempt
gets its own `attempt_started` record — a retry numbers the attempts, it never
hides them.

Policy decides what happens when the retries run out:

- `Policy.STRICT` (default) — the run aborts as `run_failed(node_failure)`.
  Correct whenever the product is a judgment: a skipped check must not be able
  to produce a verdict.
- `Policy.EXPLORATION` — the failure is recorded and the run continues past it.

### 2. A negative result: `Rejection`

```python
if not found:
    state = state.with_rejection(Rejection(
        what="quotation", reason="not located in the source text", ts=NOW,
        evidence={"searched_characters": len(source), "quotation": quotation},
    ))
return state.with_decision(Decision(
    "verified", "yes" if found else "no", NOW,
    reason="verbatim match" if found else "no verbatim match"))
```

A `Rejection` is a **recorded not-taken**: what was declined, why, and — this
is the part that pays — with what evidence. The evidence is what makes the
rejection arguable six months later. An empty result cannot be argued with.

The node protocol forbids the alternative in so many words: *a node MUST NOT
swallow its own failure into a silently "successful" empty result.* If it can
degrade meaningfully, it records a rejection or a decision saying so.

> **From the field.** An integrator's redirect guard rejected every quotation
> from `archive.org` for weeks, because the CDN host that answered was not on
> the whitelist. Twelve real passages, present in the source, marked absent.
> With Rejections carrying the answering host as evidence, the defect would
> have been legible on the first run instead of the hundredth.

### 3. A decision that routes

Routing runs on a recorded `Decision`, dispatched by key:

```python
"check": {"kind": "route", "on": "verified", "map": {"yes": "publish", "no": "refuse"}}
```

The routing record then keeps the **whole route step**, including the branches
that were offered and not taken, plus an `origin` pointing at the exact write
that decided it:

```
-> publish  offered, not taken
-> refuse   taken
   origin: the Decision written by record 6
```

An auditor asking *"could this run have refused, and why didn't it?"* is
answered by the record instead of by reading the graph definition alongside it.

## Declaring what you touched

A node that calls an API or writes to a database has done something the trace
cannot infer and cannot undo. Motus does not detect it — nothing can, from
outside a function — so the node declares it through `ctx`:

```python
ctx.record_effect(EffectDescriptor(
    EffectClass.EXTERNAL_EFFECT,
    "GET archive.org/download/travelsininter00park",
    idempotency_key="fetch:park-1795:v1",
    receipt=EffectReceipt(receipt_id="dn760108.eu.archive.org/…",
                          status="completed",
                          result_fingerprint="effect:sha256:…"),
))
```

`recorded_effect` means *it happened, here, and it is ours to repeat*.
`external_effect` means *it happened out there, and it may not be repeatable*.
Declare the effect **before** concluding anything from it, so an attempt
interrupted mid-call leaves evidence that the call may have happened —
recorded as unknown rather than guessed at.

What the declaration buys is a safe restart. `ReplayEngine.resume` will restart
an incomplete run **only** when every observed external effect carries both a
non-empty idempotency key and a `completed` receipt. Anything weaker and it
refuses:

```
UnsafeResume: external effects require an idempotency key and completed receipt
```

The refusal is the feature. "The call may or may not have gone through" is not
a state you resume from, and the uncertainty is preserved rather than resolved
by assumption. This is an at-least-once condition with idempotent effects — not
a proof that the external system committed exactly once.

## Parameterising a node without losing replay

A real node needs a connection string, a ruleset version, a cache. The obvious
Python — a factory closing over a config object — is the one shape Motus cannot
re-identify, because a closure's captured state is not a JSON value. The run is
then recorded as `partial` with the constraint `node:<name>:opaque_config`,
rather than claiming a reproducibility it cannot honour.

Two shapes it *can* re-identify:

```python
# 1. a partial over strict-JSON keywords
node = functools.partial(check, ruleset_version="1.4.0", source_root=ROOT)

# 2. a callable instance that attests its own configuration
class Check:
    def motus_config(self) -> dict:        # pure, total, cheap, strict-JSON
        return asdict(self.config)
    def __call__(self, state: State) -> State: ...
```

Measured, with `replay=ReplayStatus.declared("full")`:

```
closure over the config  -> partial  ['node:check:opaque_config']
functools.partial        -> full     []
callable + motus_config  -> full     []
```

The configuration is fingerprinted into `graph.code_fingerprint`, so two runs
under different rules carry different fingerprints and a reader can tell them
apart. Neither shape is a purity certificate: `motus_config()` is an
attestation by the class author, taken at its word.

## LLM nodes specifically

Two things that are easy to get backwards:

- **`temperature=0` does not buy replay.** A model call is an
  `external_effect`, and Motus never re-executes external effects during
  verification by design. What temperature zero buys is that the same input
  does not route two different ways across runs — worth having on the node that
  *decides*, less so on the node that writes prose, where variance is the
  product.
- **Cosine similarity is not a judgment.** A relevance gate built on a
  threshold degrades into a rubber stamp on any corpus large enough: measured
  on 1,789 documents, a question about Kubernetes put to Antarctic expedition
  journals scored 0.434 against 0.546 for a perfectly on-topic question. If a
  branch must mean something, have a model read the question and the retrieved
  passages, and record its answer as a `Decision` with a `reason`. The model
  can read; the cosine cannot.

## Checklist before shipping a node

- [ ] state → state, and nothing ambient read behind the trace's back
- [ ] negative results are `Rejection` + `Decision`, never a raise, never an empty success
- [ ] `Rejection.evidence` carries enough to argue with later
- [ ] `max_attempts` set for every node that touches the network
- [ ] every external call declared with an idempotency key and a receipt
- [ ] configuration passed as `functools.partial` or `motus_config()`, not a closure
- [ ] the graph's terminal nodes cover every decision value the graph can produce
