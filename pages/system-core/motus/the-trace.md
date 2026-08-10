---
title: The trace
---

# The trace

The trace is the product. Everything else in Motus exists to make it worth
something: a causal account of one run, in a published format, that a third
party can check without trusting the process that produced it.

---

## What it is

A **header** plus an ordered, append-only sequence of **records**, in either of
two canonical encodings of the same logical model:

- one JSON document, or
- **JSONL** — UTF-8, LF endings only, one header line then one record per line.

A field run of seven executed nodes produced 24 records: one header, one `run_started`,
then `attempt_started` / `transition` / `routing` per executed node, then a
terminal record (`run_completed`, `run_failed` or `run_cancelled`). Nothing
follows a terminal record. A stream that ends without one is a crash-truncated
prefix, and says so.

## Validating it

The distribution ships the validator, and this is the point of the exercise:

```console
motus-validate jsonl run.jsonl
motus-validate trace run.json --spec graph.json
```

Exit 0 or exit 1 with the rule and the offending field. It enforces far more
than the JSON schema — record coherence (T-rules), the execution state machine
(E-rules), spec binding with a recomputed graph fingerprint (SB-rules), and the
integrity chain.

Measured against a real trace and three tampered copies:

| trace | exit | rule | what it caught |
|---|---|---|---|
| untouched | 0 | — | — |
| a verdict changed in a routing record | 1 | T11 | `records[18].integrity.payload_hash` does not match |
| one hex digit flipped in a digest | 1 | T11 | `records[20].integrity.payload_hash` does not match |
| one whole record deleted | 1 | T11 | `records[11].integrity.prev_hash` breaks the chain |

Two distinct failure modes — payload mismatch and chain break — each naming the
record and field, actionable without reading the validator's source.

## The integrity chain and the root

Since schema 2.0.0 every record carries an `integrity` block. `payload_hash` is
SHA-256 over the canonical object form of that record **with its own integrity
block nulled** — because what a digest must not cover is its own value.
`prev_hash` is the previous record's `payload_hash`, and the first record's
predecessor is the header itself, whose digest starts the chain.

The consequence is the useful part:

```python
root = result.trace.root            # 'sha256:1ca0f5f6…'
```

The **root is the terminal record's `payload_hash`**, derived and never stored
twice. Because the chain reaches back through every record to the header, that
one value commits to the entire run — records, run id, policy, metadata and
`graph.code_fingerprint` alike. Anchoring anything larger buys nothing and is
more fragile.

> Chaining records alone would have left run id, policy and metadata outside
> the root: rewritable without moving the terminal hash, and a validator would
> have passed the result clean. An anchor over such a root proves a sequence of
> records existed and says nothing about whose run they were.

## Anchoring it

Checking the chain's shape proves nothing by itself — whoever edits a record
can recompute a well-formed hash. What they cannot do is reproduce a root that
was **published outside their reach before the edit was possible**.

Motus ships no anchor and holds no chain credentials, by decision: the
repository provides the socket, not the plug. A working implementation exists
in the field (~380 lines, TRON Nile) and its shape is the design input for the
interface:

```python
anchor(root: str, *, wait: bool = True) -> dict   # receipt
verify(root: str, receipt: dict) -> bool
```

Three things that implementation learned, worth respecting in any other:

1. **`verify()` is the half that matters and the half people skip.** It must
   re-read from the chain and never trust the receipt's own copy of the
   payload. A local file that certifies itself certifies nothing.
2. **Broadcast and confirmation are different events.** A receipt must be able
   to say "unconfirmed after 60 s" — that is a fact about the network, not a
   failed anchor.
3. **Budget the carrier from the string, not the digest.** A TRON memo holds
   100 characters; `sha256:` + 64 hex is **71**, not 64. The value names its
   hash function on purpose — a digest that does not say what produced it
   cannot be recomputed — and that costs seven characters.

## Storing it

The integrity digests are computed over the **canonical object form**, never
over the bytes of a particular encoding. So key order and whitespace never
reach the chain, and any storage that preserves the JSON *value* is safe.

**Postgres `jsonb` does not preserve the value.** Measured against Postgres 16:

| stored value | comes back as | chain |
|---|---|---|
| `0.30000000000000004` | unchanged | survives |
| `1e-320` | unchanged | survives |
| `9007199254740993` | unchanged | survives |
| `-0.0` | `0.0` | **breaks T11** |
| `1e16` and above | `10000000000000000` (an integer) | **breaks T11** |

`jsonb` stores numbers as `numeric`, which has no notion of float versus
integer, and rewrites them in plain decimal. Any float at or above `1e16` —
the point where Python switches to exponent notation — returns as an integer,
and the record's value has changed even though nothing was edited. Negative
zero is the nastier case: it compares equal to `0.0` in Python, so a test
written with `==` reports success while the digest has already moved.

**Recommendation:** store the JSONL as `text`. The column then holds the exact
stream `motus-validate jsonl` reads, so checking a verdict is one `psql`
redirect with no intermediate rendering to be faithful about:

```console
psql -tAc "select trace_jsonl from verdict_traces where submission_id=27" > t.jsonl
motus-validate jsonl t.jsonl            # exit 0
```

A third party can then check a verdict with nothing but the database and the
shipped validator, trusting neither us nor our code.

## Durability, and what the header claims

The run header declares one durability profile, and it records the crash
guarantee the caller **bought** — never what the sink turned out to be capable
of:

| profile | guarantee after process loss |
|---|---|
| `in-memory` (default) | none; the trace exists only as the returned object |
| `buffered` | everything up to the last confirmed flush, with the loss window declared in the header |
| `synchronous` | a transition is committable only after sink acknowledgement |

Attaching a `JsonlTraceSink` does **not** move the profile off `in-memory`.
The sink's delivery is recorded as synchronous (`flush_interval_ms: 0`,
`chunk_records: 1`) and it adds no crash-survival claim, because claiming a
stronger guarantee than the profile bought is a contract violation. If you want
the guarantee, ask for it:

```python
Runtime(SPEC, nodes, sink=JsonlTraceSink(path), durability_profile="synchronous")
```

Separately from the run's status, every outcome answers whether its evidence
was written:

```python
if result.evidence != "persisted":
    # the run has an outcome; its durable account does not
```

`persisted`, `incomplete` or `not-required`. It is deliberately not folded into
the status: a node that raised while the archive was also down has two facts to
report, and the more important one is the node. This fact currently lives on
the result object and **not inside the trace** — a deferral recorded in
ADR-016.

## Replay

Three explicit operations, and the names promise less than they seem to:

```python
bundle = TraceBundle(spec, result.trace)
engine = ReplayEngine(bundle)

engine.playback()              # reconstruct committed state, execute nothing
engine.verify({"observe": fn}) # re-execute PURE nodes against recorded draws
engine.resume(runtime)         # a new, causally linked run segment
```

`replay_capability` (`full | partial | none` plus constraints) reports whether
the runtime can **re-identify each node's configuration** — and nothing wider.
It is not a purity certificate and `partial` is not an accusation. Nothing
refuses a run for its capability; it is recorded so a reader can judge, and
rule T10 only enforces that it never improves over the course of a run.

External effects are never re-executed during verification. Re-charging a card
to verify a trace would be a spectacular own goal.
