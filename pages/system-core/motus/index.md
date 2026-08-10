---
title: What Motus is
---

# Motus — the trace-first runtime

**Motus** is an embeddable graph execution runtime whose immutable trace *is*
the audit evidence. A run does not produce a log alongside its result: it
produces a causal account of itself, in a published format, that a third party
can check without trusting the process that wrote it or the people who run it.

> **Repository:** `vitruvyan/motus` (private) · **Version:** 0.8.1 ·
> **Trace schema:** 2.0.0 · **Import:** `vitruvyan_motus` ·
> **Dependencies:** the kernel imports nothing outside the standard library

---

## The one-sentence version

Motus does not make your system answer better. **It makes it visible when your
system is answering badly.**

That is not a slogan. The first external integration ran a retrieval graph
whose `decline` branch was unreachable in practice — every question, however
off-topic, cleared the relevance threshold. No test caught it. The trace caught
it, because the routing record lists the branches that were *offered and
refused*, and a branch never taken reads identically to a branch that cannot be
taken until something writes down that it was offered.

## When to reach for it

Use Motus when the **decision itself** is the deliverable and someone may later
dispute it: a verdict, a rejection, a risk classification, an advisory output
under MiFID II or the EU AI Act. The question it answers is not "what did the
system do?" but "can you prove that is what it did, to someone who assumes you
edited the record?"

Do **not** reach for it when you need throughput, parallel fan-out, or a large
integration ecosystem. Motus is single-lane — one node at a time — and that is
a deliberate exclusion, not a gap waiting to be filled. See
[Known limitations](#what-motus-does-not-do).

## Motus and LangGraph

Vitruvyan runs LangGraph in `api_graph` and the two are not competitors. The
division is worth stating precisely, because the surface similarity is high:

|  | LangGraph | Motus |
|---|---|---|
| where the intelligence lives | in the nodes | in the nodes |
| routing | a function returns a string | routing runs on a **recorded `Decision`** |
| the branch taken | an event inside the interpreter | a fact in the record |
| output | an answer | an answer **and evidence of how it was reached** |
| checkable by a third party | no | yes — shipped validator, no trust in us |
| parallel fan-out | yes | no, deliberately |
| ecosystem | large | none; zero runtime dependencies |

The consequence of row three is the reason the first integrator called it *"the
feature that made the migration worth doing"*: **a decision the graph took but
did not record cannot reach a recording node at all.** You cannot route on
something you did not write down.

## What Motus guarantees

Five invariants, normative in `contract/guarantees.md`:

1. **One execution semantics.** Every physical optimisation passes through the
   same executor and produces the same observable trace. There are no co-equal
   engines.
2. **Sink failure prevents logical success.** A run cannot declare itself
   completed if its required sink did not accept the trace.
3. **The kernel does not interpret the domain.** No LLM, no Vitruvyan OS, no
   LangChain, no epistemic categories. `Fact`, `Decision` and `Rejection` are
   neutral workflow primitives — a Fact is a *recorded assertion*, never
   verified truth. Meaning belongs to the consumer.
4. **Nondeterminism is declared and observable.** Replay capability is always
   an explicit recorded property; the absence of a declaration never implies
   reproducibility.
5. **Structural completeness is not content exposure.** Redacted values carry a
   hash and a policy reference — causality stays complete when the content
   cannot be persisted.

Invariant III is the one that surprises people. Motus will faithfully record a
badly reasoned decision, and that is correct: a kernel that overrides your
judgment has just decided for you, silently.

## What Motus does not do

Published in the repository README rather than left to be discovered:

- **No fan-out.** Execution is single-lane. A declared concurrent topology has
  no representation in GraphSpec v1 or trace schema v1. It existed in the
  predecessor (Axis 0.4.0) and was deliberately not carried forward; the
  contract names the trigger that would bring it back — *the first real
  consumer that needs it.*
- **`resume` drives new work synchronously**, so a resumed segment cannot
  contain an `async def` node.
- **No anchor.** The trace carries a hash chain and a per-trace root; it does
  not publish that root anywhere the operator cannot rewrite it. Without an
  anchor the chain proves internal consistency, not immutability. Motus ships
  no anchor and holds no chain credentials by decision: the repository provides
  the socket, not the plug.
- **Never exactly-once.** Resume is an at-least-once condition with idempotent
  effects, and Motus promises exactly-once in no version, ever.

## The pieces

| piece | what it is |
|---|---|
| `GraphSpec` | the declared topology: nodes, effect classes, transitions. Fingerprinted. |
| `Runtime` | the executor. Policy, durability profile, per-node retries, sinks, listeners. |
| `State` | the immutable carrier: intent, metadata, facts, decisions, rejections. |
| `Trace` | the account of one run: a header plus an ordered, hash-chained record sequence. |
| `TraceSink` | durable evidence. `JsonlTraceSink` writes one validator-ready JSONL document per run. |
| `ReplayEngine` | playback (reconstruct state), verify (re-execute pure nodes), resume (linked new segment). |
| `motus-validate` | the shipped validator. Checks a trace against the published contract, in a process that need not be the one that produced it. |

The validator ships with the distribution because **a trace nobody can check is
a log**. That is the product.

## Where to go next

- [Writing nodes](./writing-nodes) — the node protocol in practice, and the
  three things a node can say when something goes wrong.
- [The trace](./the-trace) — what it contains, how to validate it, how to store
  it without breaking the integrity chain, and what the root is for.
