---
title: What Limen is
---

# Limen — the enterprise AI gateway built on Motus

**Limen** is one OpenAI-compatible endpoint for every model a company allows — local or
external — for agents, applications and people alike. For every request that passes through
it, Limen produces evidence of **what was decided, what was declined, and what was never
read**, verifiable by anyone, offline, without trusting the gateway or Vitruvyan.

> **Repository:** `vitruvyan/limen` (private) · **Status:** pre-MVP, assurance mode `local`
> (ADR-002) · **Depends on:** `vitruvyan-motus`, pinned to a git tag — Motus is not on PyPI

---

## The one-sentence version

**Change the endpoint. Keep the applications.** A team that already talks to an OpenAI-shaped
API repoints it at Limen; nothing else in the integration changes, because the protocol at the
wire is the same one they already speak. What changes is what happens *behind* that endpoint.

## What happens to every request

```
clients ──OpenAI API──▶ LiteLLM proxy (enforcement point: keys, budgets, providers, streaming)
                            │ pre-call hook
                            ▼
                     Limen decision run  = a Motus graph (policies/*.graph.json)
                     authenticate → classify_data → select_model → apply_policy → route
                            │ allow / deny / review
                            ▼
                     LiteLLM calls the provider (local or external)
                            │ post-call hook
                            ▼
                     Limen effect run  (usage, provider receipt, idempotency key)
                            ▼
                     Motus commitment log → checkpoint → OpenTimestamps anchor
                            ▼
                     motus-validate, by anyone, offline
```

Six steps, always in this order:

1. **Verify who is asking** — a principal from an OIDC token or a LiteLLM virtual key.
2. **Classify the request** — a data class, asserted by the caller, never guessed by Limen.
3. **Select the model** — the logical model (local or external) the request may reach.
4. **Apply the policy** — an administrator-owned table decides the route for this
   group/data-class pair.
5. **Allow, deny, or send to human review** — the gateway enforces exactly what Limen decided.
6. **Record it** — the decision becomes a Motus run; the provider call becomes a second one,
   linked to the first.

See [Policy and decisions](./policy-and-decisions) for how steps 2–5 actually work, and
[Evidence and proof](./evidence-and-proof) for step 6.

## Where Limen sits in the Vitruvyan family

Limen is **not** a feature bolted onto Motus. ADR-001 settled this the first time it was
proposed the other way: a policy engine with identities, secrets and budgets cannot live inside
a kernel that imports nothing outside the standard library. So Limen is its own application,
with its own repository and release cadence, that **embeds** `Runtime` the way any consumer of
Motus does — Orbis included:

```
Limen (and Orbis, and anyone) → Motus → Perpetuum
```

Every request that passes through Limen *is* a Motus run. Limen inherits the trace format, the
integrity chain, the derived root, the commitment log, anchoring and the offline verifier
without touching a line of the kernel.

## What Limen guarantees

- **The policy is a Motus `GraphSpec`.** Changing it changes its `graph_fingerprint`, carried in
  the header of every trace it produces — a verifier can tell which policy ran without asking
  Limen.
- **Nodes declare what they read** (`reads_declared`). The evidence therefore also proves what a
  decision did **not** look at — the `select_model` node, for instance, cannot have read
  anything but `data_class`, `groups` and `requested_model`, because the trace says so.
- **The prompt itself never enters the decision.** Limen carries a `prompt_hash`, never the
  text, into anything it writes down.

## What Limen does not do

- It does not mint identities. It consumes OIDC tokens or LiteLLM virtual keys; the identity
  provider is the customer's.
- It does not prove that *every* AI interaction in a company went through it — only the ones
  that did. An employee opening a consumer AI site in a browser with a personal subscription
  never reaches Limen, and no API gateway can reach that case. Closing it is a network and policy
  problem (blocked domains on managed devices, a sanctioned in-house alternative, training), not
  a Limen feature, and Limen will not become a TLS-intercepting web proxy to chase it.
- It does not claim `witnessed` continuity until an independent witness exists (ADR-002) — see
  [Evidence and proof](./evidence-and-proof) for exactly what `mode: local` does and does not
  prove today.

## Where to go next

- [Policy and decisions](./policy-and-decisions) — the graph, the table an administrator writes,
  and the three routes a request can take.
- [Evidence and proof](./evidence-and-proof) — what gets written down, what never does, and how
  a checkpoint gets anchored to Bitcoin.
- [Try it in ten minutes](./try-it) — build, start, create keys, ask, and look at the evidence.
