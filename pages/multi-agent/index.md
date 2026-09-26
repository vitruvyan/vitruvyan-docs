---
title: How it works
---

# Multi-agent — several agents, one chain of evidence

Orbis can split a question across several agents that work in parallel on the bus, then
compose a single answer from their results. The split is decided by the system, question by
question. **One agent is the default**: a question is split only when its parts are truly
independent.

> **Where it lives:** `vitruvyan/orbis` · graph nodes in
> `kernel/orchestration/motus/nodes/delegation.py`, bus port in
> `services/api_graph/adapters/delegation_port.py`, listener in
> `services/api_graph/streams_listener.py` · **Status:** active in production since
> 25/09/2026 (`GRAPH_DELEGATION_ENABLED=1`) · **Issue:** #25

---

## The one-sentence version

**The graph decides whether to split; the bus carries the parts; the governance sees
everything.** Every part is a full graph run with its own trace, the coordinator waits for
their outcomes, and the final answer goes through the same tribunal as any other answer.

## The path of a question

```
question
   │
   ▼
intake → recall → interpret
   │
   ▼
plan ──── single ───────▶ contextualize → …   (the usual path)
   │
 multi
   ▼
delegate ── no capacity ─▶ contextualize → …   (the usual path)
   │
   │  graph.run.requested  (one event per part)
   ▼
graph listener ── runs the parts in parallel, each one a full Motus run
   │
   │  graph.run.completed / graph.run.failed  (one event per part)
   ▼
delegate ── collects the outcomes, reads each answer from its trace
   │
   ▼
govern → compose → remember
```

### 1. The fork — `plan`

`plan` runs right after `interpret`. It asks the model a single question: can this request be
split into parts that are **independent** (each answerable without the others), need
**different skills, sources or tools**, and are **all questions** (never actions)?

The model's proposal is then filtered by fixed rules. The answer is `single` when:

| Reason | When |
|---|---|
| `delegated_run` | the run is itself a part of another question — parts never split again |
| `action_intent` | the intent is an action: an action is never split |
| `disabled` | delegation is switched off |
| `planner_failed` / `planner_invalid` | the model did not answer, or answered badly |
| `not_decomposable` | fewer than two valid parts — **in doubt, single** |

Otherwise the answer is `multi`, with at most `GRAPH_MAX_DELEGATED_PARTS` parts (the extra
ones are dropped and the reason becomes `capped`). The choice is written as the Decision
`delegation_mode` and the fact `delegation_plan`, so every split — and every non-split — is
explained in the trace.

### 2. The coordinator — `delegate`

`delegate` takes a coordinator slot without waiting. If none is free (or no bus port is
installed) it writes `delegation_outcome = no_capacity` and the question continues on the
usual single-agent path: **a busy system degrades to one agent, it never stalls.**

When it has a slot, for each part it:

- builds **deterministic identifiers** from the coordinator's run id, so a retry produces the
  same `request_id` and `run_id` instead of duplicates;
- publishes one `graph.run.requested` event carrying the part text and **all of the user's
  context**: tenant, user, ephemeral flag, scopes, language, and `hop_count + 1`;
- records the publication as an external effect with a receipt (the event id).

Then it collects the outcomes, up to `GRAPH_DELEGATION_TIMEOUT_S`, and always releases the
slot, even on error.

### 3. The agents — the graph listener

The listener consumes `graph.run.requested` and runs each part as a full Motus run, up to
`GRAPH_LISTENER_CONCURRENCY` at a time. A delegated run is marked `delegated`: it cannot split
again and it **does not write memory**, because the conversation belongs to the coordinator.
It then announces the outcome on `graph.run.completed` or `graph.run.failed`. The event
carries identifiers, status and duration, **never the answer text**: the bus stays
payload-blind, and the answer is read from the run's trace.

### 4. Collecting the outcomes

The coordinator reads the two outcome channels with `XRANGE`, without a consumer group, and
keeps only its own `request_id`s; the first outcome for each part wins. For every completed
part it reads the answer from that part's trace and checks that the trace belongs to **the
same tenant** as the question. A part from another tenant is treated as failed
(`tenant_mismatch`), never as an answer.

Each part ends in one of four states: `succeeded`, `empty`, `failed`, `missing` (no outcome
before the timeout).

### 5. Judging and composing

- `govern` passes the delegation and the parts' answers to the tribunal, so the verdict is
  about what the agents actually said. Only the **number** of parts goes on the bus.
- `compose` narrates **only from the parts that succeeded**, each one a source of tier
  `delegated`. Every part that failed, came back empty or never answered is **declared in the
  answer with a fixed sentence written by the node, never by the model** — a failure never
  looks like an empty answer. If no part succeeded, the answer is only those sentences.

## What you can see

The whole chain — coordinator and parts — is one correlation: the parts' `correlation_id` is
the coordinator's `run_id`.

- `GET /motus/chain/{correlation_id}` returns the coordinator and its delegated runs, with the
  state of each part as seen by the coordinator and by its own trace, and whether each trace
  really belongs to the chain. No text.
- `vit agents` lists the recent delegated questions; `vit agents chain <id>` shows one chain.

See [Configure and observe](./operating) for the settings, the event contracts and the first
measurements.

## What this gives you

- **More reach, same control.** Parts run in parallel, but each one is a governed, traced run
  and the final answer is judged like any other.
- **Nothing is lost silently.** A part that fails or times out is named in the answer.
- **Isolation by construction.** Parts carry the user's identity and permissions, and a result
  from another tenant is rejected.
- **Explainable choices.** Why a question was split — or not — is a Decision in the trace.
