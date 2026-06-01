# Finance Vertical — Sentiment Engine Philosophy

> **Last updated**: 2026-06-01  
> **Vertical**: finance  
> **Status**: design contract (active redesign — see Mercator issues #3, #4, #5)  
> **Companion docs**: [pipeline_reddit_ingestion_embedding.md](../../pipeline_reddit_ingestion_embedding.md) (the *how*), this doc is the *why*.

This is the **first KB article** for the `verticals/finance/` section. It
states the philosophical and architectural commitments of the finance
vertical's sentiment engine — the rules we won't break, even when convenient.

The companion pipeline doc tells you how Reddit/GNews/Polygon news flow
from Oculus → Codex → Babel → Pattern Weavers. This doc explains *why we
trust that pipeline* and *what we refuse to extract from it*.

---

## 1. What sentiment is for, in finance

Sentiment is the **reading of the narrative around an entity**. By itself
it is noise. In conjunction with momentum, volume, and regime, it becomes
a **co-indicator** of:

1. **Expectations** — what is the market currently pricing in?
2. **Conviction drift** — how is consensus moving?
3. **Risk perception** — fear / euphoria preceding volatility swings
4. **Crowding** — how psychologically "owned" is a trade?
5. **Narrative momentum** — turnaround story vs decline story

Sentiment is **not** a leading indicator in isolation. It is **lagging by
design** (people write after price moves), and **reflexive** (peak
sentiment often precedes a top). Any system that treats sentiment as a
signal must encode these properties.

---

## 2. Refusal to collapse sentiment into a single number

The previous Mercator implementation reduced sentiment to one float per
ticker, blending LLM market knowledge with real-data extraction via a
hardcoded 60/40 split. This was **wrong as a unit of thought**, not just
broken as code.

The new contract:

> **Sentiment is a family of signal observations, not a score.**

Each observation is **atomic, cited, source-attributed**, and persisted
in the `signal_observations` table. Five signal families compose the
finance-domain sentiment surface:

| Signal name | Range | What it measures | Half-life |
|---|---|---|---|
| `sentiment_valence` | [-1, 1] | overall polarity, positive/negative | 168h (7d) |
| `market_fear_index` | [0, 1] | stress, uncertainty, VIX-proxy from text | 48h |
| `volatility_perception` | [0, 1] | implied volatility from narrative | 24h |
| `narrative_momentum` | [-1, 1] | directional force of the story | 72h |
| `analyst_consensus_drift` | [-1, 1] | delta vs prior consensus | 720h (30d) |

Each observation carries: `entity_id`, `signal_name`, `value`,
`confidence`, `source`, `evidence_ref`, `extracted_at`, `cluster_id`,
`entity_type`, `metadata`.

**Aggregation happens at query time**, never at write time. The backend
keeps atomic observations; the UI's `SentimentCard` computes the answer
to the *current* question. This means:

- The same data, queried with different windows, produces different aggregates — by design.
- Source weights can change without rewriting history.
- Trend, by-source breakdown, evidence top-K, freshness are all derived in one query.

---

## 3. Three independent epistemic sources

For each observation, the `source` field MUST be one of three classes:

| Source class | Examples | Authority weight | Decay |
|---|---|---|---|
| `external_evidence` | Reddit, GNews, Polygon news, Reuters, Bloomberg | per-source weight in `source_authority_weights` table | normal |
| `user_supplied` | Earnings call transcript, 10-K, analyst report uploaded via IngestWizard | 0.9 (high authority) | longer half-life |
| `llm_market_knowledge` | LLM prior on the ticker without text grounding | 0.30 | shortest half-life |

These MUST NOT be blended at write time. The user-supplied class is a
first-class citizen for **mid/small caps not covered by Reddit/GNews** —
a Bloomberg article counts more than a Reddit post, and a
user-uploaded 10-K counts more than both.

LLM market knowledge is the **a-priori** — usable when no external
evidence exists for the ticker (rare ticker scenario), but explicitly
flagged so the UI can render it differently (dotted-line confidence
band, not solid).

---

## 4. Three event classes for the live feed

The Synaptic Conclave bus carries three sentiment-related event classes
to the UI. They MUST NOT mix on the same channel.

```
finance.observation.*   → ingestion-derived, append-only, atomic
finance.insight.*       → cross-observation reasoning (e.g. z-score 3σ)
finance.hint.*          → doctrine + thesis + policy → actionable
```

Each `hint` MUST trace to ≥1 `insight`, which MUST trace to ≥N
`observations`. This **causal chain** is the substrate of:

- **Time Machine / Causal Replay**: every advisory recommendation must
  be replayable end-to-end with the observations as they existed at
  decision time.
- **Audit and compliance**: regulated advisory needs a non-repudiable
  reason chain.
- **Plasticity learning loop**: when a hint leads to a trade with a
  bad outcome, the failure attributes back to specific observations
  + insight rules + thesis state.

---

## 5. Semantic Warden as obligatory layer

Stale narrative is not a feature, it is decay. The Semantic Warden V1
contracts (in `vitruvyan_core/contracts/rag.py`) declare the lifecycle
of evidence + signal observation collections:

| Collection | Tier | Retention | Dedup cadence |
|---|---|---|---|
| `finance_evidence_packs` | DOMAIN | 90d | weekly cosine 0.85 |
| `finance_signal_observations` | DOMAIN | 30d | n/a (atomic) |

The Warden lifecycle workers (`lifecycle_scanner`, `dedup_scanner`,
`health_reporter`) are **non-optional**. A finance vertical without
active lifecycle is a finance vertical drowning in 6-month-old earnings
calls.

---

## 6. Echo chamber: detection and treatment

Ten articles syndicating the same Reuters story are not ten signals.
The Warden's `dedup_scanner` runs weekly:

1. **Detection**: cosine similarity > 0.85 over `(entity_id, time_window)` → same `cluster_id`. Persisted on `evidence_packs.cluster_id`.
2. **Treatment** (in `signal_observations_persister`): an observation derived from an evidence row already in a cluster does NOT create a new row. It **updates the cluster aggregate**:
   - `value` = weighted average by `source_authority`
   - `confidence` = `max(confidences)`
   - `evidence_refs` = list of all contributing refs
   - `coverage_count` = N
   - `diversity_warning: bool` if size > 3 with same `source_domain`

Tracability is preserved (you see all evidence refs); weight is
correct (10 echoes = 1 signal, with the most authoritative source as canonical).

The UI's diversity score = `unique_clusters / total_observations`. If
< 0.5 the card shows a `⚠ low diversity` badge.

---

## 7. Sentiment per asset class

`entity_type` discriminates the right interpretation:

| `entity_type` | Examples | Sentiment focus |
|---|---|---|
| `ticker` | AAPL, MSFT, BRK.B | idiosyncratic |
| `theme` | ARKK, ESG | narrative thesis |
| `sector` | XLE, XLF, XLK | sector rotation |
| `bond_etf` | TLT, AGG | yield curve sentiment |
| `commodity_etf` | GLD, USO | macro |

A single position in AAPL produces two relevant aggregates: idiosyncratic
(ticker level) and sector (XLK theme level). The UI lets the user pivot
between them; the backend stores both as separate observations.

---

## 8. The aggregation formula (query time)

Given an entity `e`, signal `s`, window `W` (default 7d):

```
weight(o) = source_authority(o.source) * exp(-age_hours(o) / half_life(s))
aggregate(e, s, W) = Σ_o (o.value * o.confidence * weight(o)) / Σ_o weight(o)
```

The sparkline is `aggregate` bucketed daily over W. The by-source
breakdown is the same formula restricted per `o.source` class. The
freshness indicator is `min(age_hours(o)) for o in observations(e, s, W)`.

No magic constants. Every weight is sourced from a config table, every
decay half-life is per signal-family. All deterministic, all auditable.

---

## 9. Why this matters: sentiment as the template for engine refactor

The pattern **atomic observations + aggregation at query time** is the
template for refactoring the rest of Mercator's finance engine. Today
the engine has many tables that should be derived views:

| Today | Becomes |
|---|---|
| `sentiment_scores` (legacy, deprecated) | views over `signal_observations` |
| `factor_scores` | views over signal_observations with `signal_name LIKE 'factor_%'` |
| `signals` (vuota, deprecata) | dropped |
| `babel_analysis_log` | dropped, replaced by `audit_events` |
| `design_points` (hardcoded strategies) | composed from observations + doctrine at query time |
| `allocation_results` | composed view + memoization |

One canonical pipeline: **observation → cluster → aggregate**.

Lean = one table, many views, query-time composition. Sentiment is the
first domain where we prove the pattern; everything else follows.

---

## 10. Non-negotiables (Golden Rules for the sentiment engine)

1. **LLM-first** for extraction (per Vitruvyan Golden Rule). Regex/lexicon = graceful-degradation fallback only.
2. **No write-time blending** of different `source` classes. Blending is a query-time concern.
3. **Every observation cites its evidence_ref**. No uncited claims.
4. **Semantic Warden is on**. Stale evidence and echo clusters are managed automatically.
5. **Observation > insight > hint**, with traceable causal chain. Hints without insights are forbidden.
6. **Aggregation is deterministic and reproducible** given the same observations, weights, and window.
7. **`validated_tickers` is authoritative** (per Mercator UI-only contract). Sentiment is computed for tickers the user *selected*, never for tickers the backend *guessed*.

---

## 11. Open design points (not yet decided)

- Cross-entity sentiment propagation via Pattern Weavers ontology (e.g., TSMC shock → AAPL via supply-chain). Tracked as separate signal `cross_entity_sentiment_propagation` or as metadata enrichment? See Mercator issue #19.
- Whether `user_supplied` evidence should be subject to dedup against external evidence, or kept in a separate cluster space. Working assumption: separate cluster space.
- Whether `llm_market_knowledge` observations should be persisted at all, or computed live (treating them as opinions, not data). Working assumption: persisted with explicit source flag, so trend analytics work uniformly.

---

## References

- Mercator parity roadmap: [vitruvyan/mercator#3](https://github.com/vitruvyan/mercator/issues/3)
- Phase 1 — Sentiment infrastructure repair: [vitruvyan/mercator#4](https://github.com/vitruvyan/mercator/issues/4)
- Phase 2 — Reddit + GNews + Polygon ingestion via Oculus: [vitruvyan/mercator#5](https://github.com/vitruvyan/mercator/issues/5)
- Phase 3 — Semantic Warden activation: [vitruvyan/mercator#6](https://github.com/vitruvyan/mercator/issues/6)
- Phase 4 — Sentiment UX redesign: [vitruvyan/mercator#7](https://github.com/vitruvyan/mercator/issues/7)
- Live-feed observation/insight/hint architecture: [vitruvyan/mercator#22](https://github.com/vitruvyan/mercator/issues/22)
- Pipeline technical reference: [`pipeline_reddit_ingestion_embedding.md`](../../pipeline_reddit_ingestion_embedding.md)
- Vertical contract V1: [`contracts/verticals/VERTICAL_CONTRACT_V1.md`](../../contracts/verticals/VERTICAL_CONTRACT_V1.md)
- RAG Governance Contract V1 (Semantic Warden): [`contracts/rag/RAG_GOVERNANCE_CONTRACT_V1.md`](../../contracts/rag/RAG_GOVERNANCE_CONTRACT_V1.md)
