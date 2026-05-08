---
tags:
  - cognitive-modules
  - veritas-engine
  - governance
  - quality
  - admin
---

# 🔬 Veritas Engine (DSE — Data Signal Engine)

> **Last Updated**: March 23, 2026 12:00 UTC

<p class="kb-subtitle">Signal quality validation, regime detection and confidence aggregation. The epistemic gatekeeper before data reaches downstream scoring engines.</p>

## 🎯 What it does

- 🧪 **Signal quality analysis**: scores each entity across 5 quality dimensions (completeness, z-consistency, freshness, sample adequacy, outlier score)
- 📊 **Regime detection**: classifies the universe health as `normal / stress / crisis` based on aggregate signal quality
- 🧮 **Confidence aggregation**: produces a validated `VeritasEngineOutput` with per-entity diagnostics and an overall run confidence
- 🚥 **Flagging**: marks entities as `incomplete_features`, `outlier`, `low_sample_size`, or `stale_data`

- ⚖️ **Epistemic layer**: Truth / Governance (Reason family)
- 🛡️ **Mandate**: guarantee that downstream engines (Neural Engine, Horizon Engine) only consume validated signal data
- 📦 **Outputs**: `VeritasEngineOutput`, `List[SignalQuality]`, `RegimeState` *(no I/O in LIVELLO 1)*

## 📜 Charter (mandate + non-goals)

### ✅ Mandate

- Score every entity in the input universe across quality dimensions
- Detect the collective regime of the data universe (normal / stress / crisis)
- Emit a frozen, auditable output that upstream services can trust and store
- Never modify input data — Veritas observes, does not mutate

### 🚫 Non-goals

- no writes in LIVELLO 1 (no DB, no Qdrant, no StreamBus)
- not a data-cleaning service — does not impute or interpolate missing values
- not a pre-processing engine — does not normalize or transform features
- does not decide business outcomes — it assesses data readiness only

## 🔌 Interfaces

- **HTTP (LIVELLO 2)**: `services/api_veritas_engine/` exposes `POST /validate`, `GET /health`
- **Cognitive Bus (LIVELLO 2)**: adapters emit `veritas.validation.completed`, `veritas.signal.flagged`, `veritas.regime.detected`
- **Governance thresholds**: configurable via `QUALITY_PROFILE` env var (`default` / `strict` / `relaxed`)

## 📡 Event contract (Cognitive Bus)

Defined in `vitruvyan_core/core/governance/veritas_engine/events/channels.py`:

| Event | Direction | Meaning |
|-------|-----------|---------|
| `veritas.validation.requested` | inbound | trigger a new validation run |
| `veritas.validation.completed` | outbound | full output ready |
| `veritas.signal.flagged` | outbound | one or more entities have quality flags |
| `veritas.regime.detected` | outbound | regime classification emitted |
| `veritas.batch.processed` | outbound | batch summary metrics |

## 🧩 Code map

- **LIVELLO 1 (pure, no I/O)**: `vitruvyan_core/core/governance/veritas_engine/`
  - Consumers: `consumers/quality_analyzer.py`, `consumers/regime_detector.py`, `consumers/confidence_aggregator.py`
  - Domain objects: `domain/objects.py` (`SignalValidationRequest`, `EntityQualityDiagnostic`, `RegimeIndicators`, `ValidationSummary`)
  - Governance: `governance/thresholds.py` (`QualityThresholds`, `DEFAULT_THRESHOLDS`, `STRICT_THRESHOLDS`, `RELAXED_THRESHOLDS`)
  - Events: `events/channels.py`
  - Monitoring: `monitoring/metrics.py` (14 metric name constants)
- **LIVELLO 2 (service + adapters + I/O)**: `services/api_veritas_engine/`
  - HTTP routes: `api/routes.py`
  - Bus orchestration: `adapters/bus_adapter.py`
  - Persistence (audit log): `adapters/persistence.py`

---

## 🔁 Pipeline (happy path)

### 🧪 Validation run

```
POST /validate
    │
    ▼
VeritasBusAdapter.run_validation()
    │
    ├─ 1. quality_analyzer.analyze_signal_quality(entity_ids, features, thresholds)
    │      → List[SignalQuality]   (per-entity: score + flags)
    │
    ├─ 2. regime_detector.detect_regime(qualities, raw_features, thresholds)
    │      → RegimeState           (normal | stress | crisis + score)
    │
    └─ 3. confidence_aggregator.aggregate_validation(run_id, profile, qualities, regime)
           → VeritasEngineOutput   (frozen, auditable)
    │
    ├─ emit veritas.validation.completed
    ├─ emit veritas.regime.detected
    └─ HTTP response → ValidationRunResponse
```

---

## 🤖 Consumers (LIVELLO 1)

### 🧪 `quality_analyzer` — per-entity scoring

- File: `vitruvyan_core/core/governance/veritas_engine/consumers/quality_analyzer.py`
- Entry: `analyze_signal_quality(entity_ids, features, thresholds) → List[SignalQuality]`

**Quality dimensions (weighted sum → `[0.0, 1.0]`):**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `completeness` | 0.25 | ratio of present vs expected features |
| `z_consistency` | 0.20 | inverse stddev of z-scored values (rewarded for stability) |
| `freshness` | 0.20 | recency of last data point (`staleness_days` → decay) |
| `sample_adequacy` | 0.20 | ratio of actual_samples / min_samples |
| `non_outlier` | 0.15 | 1 - outlier_probability |

**Flags emitted when score falls below threshold:**

- `incomplete_features` — completeness < `low_threshold`
- `outlier` — outlier_probability > 0.5
- `low_sample_size` — sample_adequacy < `medium_threshold`
- `stale_data` — staleness_days > 30

### 📊 `regime_detector` — universe regime

- File: `vitruvyan_core/core/governance/veritas_engine/consumers/regime_detector.py`
- Entry: `detect_regime(qualities, raw_features, thresholds) → RegimeState`

**Regime score formula (→ `normal / stress / crisis`):**

| Component | Weight | Source |
|-----------|--------|--------|
| volatility | 0.35 | std of entity quality scores |
| dispersion | 0.25 | IQR / median quality |
| low signal density | 0.25 | fraction of flagged entities |
| low freshness | 0.15 | fraction of stale entities |

Classification:

- `normal` — regime_score < 0.35
- `stress` — 0.35 ≤ score < 0.65
- `crisis` — score ≥ 0.65

### 🧮 `confidence_aggregator` — final output assembly

- File: `vitruvyan_core/core/governance/veritas_engine/consumers/confidence_aggregator.py`
- Entry: `aggregate_validation(run_id, profile, qualities, regime) → VeritasEngineOutput`
- Helper: `build_run_id(prefix="ve") → str`

Produces `VeritasEngineOutput` (from `contracts.schemas`):
- `run_id`, `profile`, `entity_count`, `qualities`, `regime`, `overall_confidence`, `diagnostics`, `produced_at`

**`overall_confidence`** = mean of per-entity quality scores.

---

## ⚙️ Governance: Quality Thresholds

Frozen dataclass `QualityThresholds` (file: `governance/thresholds.py`):

| Preset | `high` | `medium` | `low` | Use case |
|--------|--------|----------|-------|----------|
| `DEFAULT_THRESHOLDS` | 0.80 | 0.60 | 0.40 | standard production |
| `STRICT_THRESHOLDS` | 0.90 | 0.70 | 0.50 | regulated / audit |
| `RELAXED_THRESHOLDS` | 0.70 | 0.50 | 0.30 | exploratory / dev |

Activate via env var: `QUALITY_PROFILE=strict|relaxed` (default: `default`).

---

## 🔗 Integration with other engines

| Engine | Integration |
|--------|-------------|
| **Neural Engine** | Veritas output can gate NE input: proceed only if `overall_confidence ≥ threshold` and `regime ≠ crisis` |
| **Horizon Engine** | Veritas `regime` classification feeds Horizon's doctrine selection (e.g. `crisis → defensive`) |
| **Orthodoxy Wardens** | Veritas `diagnostics` shipped as evidence for audit chain |

---

## 🧪 Tests

- Unit tests: `vitruvyan_core/core/governance/veritas_engine/tests/test_veritas_livello1.py` (11 tests)
- Run: `pytest vitruvyan_core/core/governance/veritas_engine/tests/ -v`
- All tests are pure Python — no Docker / Redis / Postgres required

---

## 📦 vit package

- Package descriptor: `service-veritas-engine.vit` (root of `vitruvyan-core`)
- Install: `vit install service-veritas-engine`
