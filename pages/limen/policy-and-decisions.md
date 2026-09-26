---
title: Policy and decisions
---

# Policy and decisions

Two ideas carry all of Limen's enforcement logic: **the policy is data, not code**, and **the
gateway enforces exactly what Limen decided, and decides nothing itself** (ADR-003).

---

## The decision run: a graph with seven nodes

Every request runs through `policies/default.graph.json` — an ordinary Motus `GraphSpec`, one
node per step:

| node | reads | writes |
|---|---|---|
| `authenticate` | `principal`, `tenant`, `groups`, `issuer` | `principal_ok` |
| `classify_data` | `prompt_hash`, `attachments_count`, `requested_model`, `declared_data_class`, … | `data_class`, `data_class_source` |
| `select_model` | `data_class`, `groups`, `requested_model` | `model`, `provider`, `locality` |
| `apply_policy` | `data_class`, `groups`, `model`, `locality`, `principal_ok` | `route`, `policy_clause`, `policy_table_fingerprint` |
| `allow` / `review` / `deny` | `model`, `provider` or `policy_clause` | — (terminal) |

`apply_policy` routes on its own `route` fact, with `deny` as the default when nothing else
matches — a request that reaches no rule at all is refused, not passed through.

Two fingerprints identify what actually ran, and both are carried in every trace:

- **`graph_fingerprint`** — identifies the *topology* above: which nodes exist and how they wire
  together. It changes only when the graph file changes.
- **`policy_table_fingerprint`** — identifies the *rows* an administrator configured (below). It
  changes every time the table does, independently of the graph.

A verifier reading a trace months later does not need to ask Limen which policy applied — both
fingerprints are already in the record.

## The policy table: what an administrator writes

The graph is fixed; the table is not. It declares the data classes it accepts and one row per
`(group, data_class)` pair:

```json
{
  "data_classes": ["text", "documents", "public", "personal"],
  "rows": [
    {"group": "engineering", "data_class": "text",     "model": "local-default",    "route": "allow",  "clause": "engineering_text_local"},
    {"group": "finance",     "data_class": "public",    "model": "external-default", "route": "allow",  "clause": "finance_public_external"},
    {"group": "finance",     "data_class": "personal",  "model": null,               "route": "review", "clause": "finance_personal_review"}
  ]
}
```

An administrator sets `LIMEN_POLICY_TABLE` to load a custom table, or leaves it unset to use the
built-in one. Every `clause` value is chosen to be readable on its own in a trace, months later,
without cross-referencing the table file — `finance_personal_review` says what happened and why
in one string.

## The prompt never enters the decision

`classify_data` reads `declared_data_class` — an assertion, not an inference. The caller sends
`X-Limen-Data-Class: personal` (or `text`, `documents`, `public`), or the virtual key carries a
default in its metadata; the header wins when both are present. **Limen does not read the
prompt to guess its sensitivity.** An assertion Limen does not recognise becomes
`unclassified`, and an unclassified request is denied by default — the same rule Vitruvyan
applies everywhere a caller supplies a validated list: an explicit assertion is authoritative,
never silently re-derived from content.

The `Request` record the gateway hands to Limen makes this structural, not just a convention —
`prompt_hash` is the only field that touches the content at all:

```python
@dataclass(frozen=True)
class Request:
    request_id: str
    requested_model: str
    prompt_hash: str          # sha256 of the canonical prompt bytes — never the text
    attachments_count: int = 0
    call_type: str = "completion"
    declared_data_class: str | None = None
    declared_data_class_source: str = "attachments"
```

## Three routes, one meaning each

Measured against the shipped default policy:

| who | what | answer |
|---|---|---|
| alice (`legal`) | text | allowed → `external-default` |
| alice (`legal`) | text + attachment | allowed → `local-default` (stays local) |
| bob (`sales`) | text + attachment | **451** `requires human review`, with the clause and a `run_ref` |
| a key with no groups | anything | **403** `denied`, clause `no_matching_policy` |

`allow` lets the gateway proceed to the provider with the model Limen selected. `review` and
`deny` both stop the call before any provider is reached — the difference is that `review`
queues the request for a human (`python -m limen.evidence.review list`) while `deny` simply
refuses it. Every one of the three carries the `run_ref` of the decision that produced it, so a
denied or reviewed call is traceable back to the exact run that refused it.

## Enforcement point vs. decision point (ADR-003)

Limen deliberately does not reimplement the 24 capability areas that mature open-source gateways
already solve well — OpenAI compatibility, provider adapters, streaming, virtual keys, budgets,
rate limits. It focuses on the five that differentiate it, and lets **LiteLLM** carry the rest:

| | LiteLLM proxy | Limen |
|---|---|---|
| role | policy **enforcement** point (PEP) | policy **decision** point (PDP) |
| holds | provider credentials, budgets, rate limits | nothing secret — opaque strings only |
| runs | the whole gateway | in-process, inside LiteLLM's pre-call hook |
| on `deny` | raises, before any provider call | decided the raise |
| on `allow` | calls the provider with the selected model | decided the model |
| logging | operational state | **never evidence** |

The interface between the two is one function, gateway-neutral by design:
`decide(principal, request, policy) -> Decision`, in `src/limen/decision.py`. If a different
gateway is ever needed, it calls the same function over a webhook — the graph does not change.
LiteLLM's own logs record operational state; the evidence a third party can check is the Motus
trace and commitment log described next.

## Where to go next

- [Evidence and proof](./evidence-and-proof) — what a decision leaves behind, and how to verify
  it without trusting Limen.
- [Try it in ten minutes](./try-it) — see these three routes fire against a real policy table.
