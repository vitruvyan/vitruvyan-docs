---
title: Evidence and proof
---

# Evidence and proof

Every request that clears the gateway leaves **two** Motus runs, not one: a **decision run**
(did the policy say yes, and to what) and an **effect run** (what actually happened when the
provider was called). The effect run's `run.metadata.caused_by` is the root of the decision
run — the link lives in the evidence itself, not only in a database row somewhere.

---

## What is on disk

```
evidence/
  decisions/    one JSONL trace per policy decision
  effects/      one JSONL trace per provider call (or per streamed response)
  commitments/<writer>/<window>/checkpoint-000000.json, …    sealed hourly
```

Each file is an ordinary Motus trace — the same format documented in
[System Core → Motus → The trace](/system-core/motus/the-trace), because it is produced by the
same `Runtime`, not a lookalike.

## Checking a decision, from any machine

```bash
motus-validate jsonl evidence/decisions/<one>.jsonl
motus-validate checkpoint evidence/commitments/*/*/checkpoint-000000.json
```

Exit 0 or exit 1 with the rule and the offending field — the validator ships with the
distribution and needs nothing from Limen or Vitruvyan to run. That is the point of shipping it:
**a trace nobody can check is a log.** A real run against a tampered copy caught exactly this:

```text
T11 $.records[11].integrity.payload_hash: payload_hash does not match the record:
    declared sha256:d53c7042…, recomputed sha256:7a80264a…
```

## What is never written down

```bash
grep -rl "a phrase from your prompt" evidence/ || echo "the prompt is in no file"
```

Decisions, effects, commitments, alerts and the human-review listing all carry `prompt_hash` and
never the prompt. In a real end-to-end run, this grep against 47 traces (27 decisions, 20
effects) returned no match, and re-running it independently is exactly how a customer verifies
that claim rather than taking Limen's word for it. A client's own local copy of a model's reply
is not Limen evidence and is not covered by this guarantee — the boundary is Limen's own
records, not everything a demo happens to write to disk.

## Sealing: the commitment log and checkpoints

Every `LIMEN_SEAL_INTERVAL` (an hour, by default) the window of commitments accumulated so far is
sealed into a checkpoint chained to the previous one, per writer. A real run held five
checkpoints in one writer chain, each `VALID`, each `previous` pointing at the last — and it
survived five proxy restarts without the chain forking, because sealing happens in-process on a
timer, not on shutdown.

## Anchoring: proving a checkpoint existed before it could be edited

Checking the chain's shape proves nothing on its own — whoever edits a record can recompute a
well-formed hash. What they cannot do is reproduce a root that was published outside their reach
*before* the edit was possible. That publication is what anchoring buys:

```bash
python -m limen.evidence.anchor submit    # sends the checkpoint's root to OpenTimestamps calendars
python -m limen.evidence.anchor status    # "pending" until a Bitcoin block includes it
python -m limen.evidence.anchor upgrade   # rewrites the receipt once the block exists
```

`status` never claims more than it can currently prove. In the first real run, six checkpoints
sat `pending` for a day — not because nothing happened, but because the anchor plug in use at
the time misread its own proof tree and asked the calendars about the wrong commitment. One
version later, the same six checkpoints came back `anchored bitcoin-block:965509`, with
`published_at` derived from the block itself — **never from Limen's local clock** — because a
receipt that trusted its own timestamp would be trusting exactly the thing anchoring exists to
avoid trusting.

## Alerts: a courtesy, not evidence

`LIMEN_ALERT_WEBHOOK_URL` is optional and unset by default. When configured, it fires once — no
retry — for every `deny` or `review`, *after* the decision is already recorded, and it carries
only the fields in `alert.PAYLOAD_FIELDS`: metadata and `prompt_hash`, never the prompt or the
original request headers. An auditor trusts the decision run in `evidence/decisions/`, never the
webhook delivery, precisely because the webhook can silently fail and the trace cannot.

## What "assurance mode: local" means, and does not mean (ADR-002)

Motus defines seven trust levels. Level 4, *execution continuity* — "a run that began through
Motus left a commitment, whether or not it completed" — requires an independent **witness**: a
party that acknowledges a run has *begun* before its outcome is known. No such witness exists
yet anywhere in the Vitruvyan family (Motus issue #122), so Limen ships today with
`Runtime(witness=None)`, and every receipt honestly says `mode: local`.

This is a stated gap, not an oversight, and it is stated in the first screen a buyer reads. What
`mode: local` does **not** prove is that no request was deleted before it reached a checkpoint —
that specific question needs a witness independent of whoever operates Limen. Storage durability
(a WORM bucket, a retention policy) answers a different question — "is the evidence still intact
years later?" — and does not close this gap by itself.

Until a witness exists, Limen's own positioning holds to one rule: it may say *integrity*,
*external existence* (once anchored), *independent verification*, and *proof of what was not
read*. It does not say *witnessed*, *continuity*, *tamper-proof*, or *every interaction*. When a
witness does exist, it plugs in as a Motus client — like the OpenTimestamps anchor — and closes
this gap by changing configuration, not the graph or the trace format.

## Where to go next

- [Try it in ten minutes](./try-it) — produce a decision, an effect, a checkpoint and an anchor
  yourself, and run every command on this page against your own output.
