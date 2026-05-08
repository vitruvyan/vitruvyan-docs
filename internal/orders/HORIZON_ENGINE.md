---
tags:
  - cognitive-modules
  - horizon-engine
  - governance
  - optimisation
  - pareto
  - admin
---

# 🌅 Horizon Engine

> **Last Updated**: March 23, 2026 12:00 UTC

<p class="kb-subtitle">Multi-objective Pareto optimisation with doctrine-based design point ranking. Turns a candidate design space into an actionable ranked selection.</p>

## 🎯 What it does

- 📐 **Pareto frontier computation**: identifies non-dominated design points across multiple objectives (maximize / minimize)
- 🏛️ **Doctrine scoring**: applies a configurable doctrine (balanced / defensive / aggressive / quality-first) to rank the Pareto frontier
- 🏆 **Recommendation**: selects the highest-ranked design point as the recommended configuration
- 🔑 **Deterministic hashing**: each run is reproducible via a SHA-256 input hash of the design space + seed

- ⚖️ **Epistemic layer**: Reason (Optimisation / Pareto Analysis)
- 🛡️ **Mandate**: find the best trade-off configurations in a multi-dimensional objective space, then rank them according to an explicit, auditable doctrine
- 📦 **Outputs**: `HorizonEngineOutput`, `ParetoFrontier`, `DesignPoint` *(no I/O in LIVELLO 1)*

## 📜 Charter (mandate + non-goals)

### ✅ Mandate

- Compute the strict Pareto frontier from any input design space
- Apply a named doctrine to rank all frontier points (transparent, deterministic weights)
- Emit a reproducible, frozen output that downstream services can trust and store
- Be objective agnostic: any KPI can be minimized or maximized

### 🚫 Non-goals

- no writes in LIVELLO 1 (no DB, no Qdrant, no StreamBus)
- not a simulation engine — does not *generate* design points, only ranks given ones
- not a constraint solver — does not handle hard constraints between objectives
- not a forecasting engine — output has no time dimension

## 🔌 Interfaces

- **HTTP (LIVELLO 2)**: `services/api_horizon_engine/` exposes `POST /optimise`, `GET /health`
- **Cognitive Bus (LIVELLO 2)**: adapters emit `horizon.pareto.computed`, `horizon.solution.selected`, `horizon.optimisation.completed`
- **Doctrine selection**: configurable via `DEFAULT_DOCTRINE` env var (`balanced` / `defensive` / `aggressive` / `quality_first`)

## 📡 Event contract (Cognitive Bus)

Defined in `vitruvyan_core/core/governance/horizon_engine/events/channels.py`:

| Event | Direction | Meaning |
|-------|-----------|---------|
| `horizon.optimisation.requested` | inbound | trigger a new optimisation run |
| `horizon.pareto.computed` | outbound | frontier computed, size available |
| `horizon.solution.selected` | outbound | recommended design point identified |
| `horizon.optimisation.completed` | outbound | full output ready |
| `horizon.batch.processed` | outbound | batch summary metrics |

## 🧩 Code map

- **LIVELLO 1 (pure, no I/O)**: `vitruvyan_core/core/governance/horizon_engine/`
  - Consumers: `consumers/pareto_analyser.py`, `consumers/doctrine_scorer.py`, `consumers/optimisation_orchestrator.py`
  - Domain objects: `domain/objects.py` (`KPIObjective`, `DesignSpaceDefinition`, `OptimisationRequest`, `ParetoAnalysisResult`)
  - Governance: `governance/doctrines.py` (`Doctrine`, `BALANCED_DOCTRINE`, `DEFENSIVE_DOCTRINE`, `AGGRESSIVE_DOCTRINE`, `QUALITY_FIRST_DOCTRINE`)
  - Events: `events/channels.py`
  - Monitoring: `monitoring/metrics.py` (10 metric name constants)
- **LIVELLO 2 (service + adapters + I/O)**: `services/api_horizon_engine/`
  - HTTP routes: `api/routes.py`
  - Bus orchestration: `adapters/bus_adapter.py`
  - Persistence (audit log): `adapters/persistence.py`

---

## 🔁 Pipeline (happy path)

### 📐 Optimisation run

```
POST /optimise
    │
    ▼
HorizonBusAdapter.run_optimisation()
    │
    ├─ 1. Build domain objects (KPIObjective, DesignSpaceDefinition, OptimisationRequest)
    │
    ├─ 2. pareto_analyser.compute_pareto_frontier(design_points, objectives)
    │      → Tuple[ParetoFrontier, ParetoAnalysisResult]
    │      (normalize all objectives to maximize; O(n²) dominance check)
    │
    ├─ 3. doctrine_scorer.apply_doctrine(frontier, doctrine)
    │      → ParetoFrontier   (with doctrine_score + doctrine_rank per point)
    │
    ├─ 4. doctrine_scorer.select_recommended(frontier)
    │      → Optional[DesignPoint]   (rank 1)
    │
    └─ 5. optimisation_orchestrator.run_optimisation(request)
           → HorizonEngineOutput   (frozen, auditable)
    │
    ├─ emit horizon.pareto.computed
    ├─ emit horizon.solution.selected
    └─ HTTP response → OptimisationRunResponse
```

---

## 🤖 Consumers (LIVELLO 1)

### 📐 `pareto_analyser` — frontier computation

- File: `vitruvyan_core/core/governance/horizon_engine/consumers/pareto_analyser.py`
- Entry: `compute_pareto_frontier(design_points, objectives) → Tuple[ParetoFrontier, ParetoAnalysisResult]`
- Helper: `input_hash(design_points, seed) → str`

**Algorithm:**

1. Normalize all objectives: `minimize` → flip sign (`value × -1`)
2. For each pair `(A, B)`: A dominates B if A ≥ B on *all* objectives and A > B on *at least one*
3. Points with no dominator → Pareto frontier

Result tags each `DesignPoint` with `is_pareto: bool`.

### 🏛️ `doctrine_scorer` — ranking the frontier

- File: `vitruvyan_core/core/governance/horizon_engine/consumers/doctrine_scorer.py`
- Entry: `apply_doctrine(frontier, doctrine) → ParetoFrontier`
- Entry: `select_recommended(frontier) → Optional[DesignPoint]`

**Doctrine scoring**: for each Pareto point, `doctrine_score = Σ (kpi_value × doctrine_weight[kpi])`. Points are ranked ascending by score (rank 1 = best).

**Built-in doctrines:**

| Doctrine | Description | Key weights |
|----------|-------------|-------------|
| `balanced` | equal weight on all KPIs | all = 1.0 (normalized) |
| `defensive` | penalizes risk, rewards return | `risk: -2.0`, `return: +1.0` |
| `aggressive` | maximizes return, discounts risk | `return: +2.0`, `risk: -0.5` |
| `quality_first` | maximizes signal quality score | `quality_score: +3.0` |

Custom doctrines can be registered via `governance/doctrines.py`.

### 🏆 `optimisation_orchestrator` — full run

- File: `vitruvyan_core/core/governance/horizon_engine/consumers/optimisation_orchestrator.py`
- Entry: `run_optimisation(request: OptimisationRequest) → HorizonEngineOutput`
- Helper: `build_run_id(prefix="he") → str`

Produces `HorizonEngineOutput` (from `contracts.schemas`):
- `run_id`, `doctrine`, `pareto_frontier`, `recommended`, `total_design_points`, `input_hash`, `produced_at`, `diagnostics`

---

## ⚙️ Governance: Doctrines

Frozen dataclass `Doctrine` (file: `governance/doctrines.py`):

| Preset | Key weights | Use case |
|--------|-------------|----------|
| `BALANCED_DOCTRINE` | equal | neutral exploration |
| `DEFENSIVE_DOCTRINE` | risk=-2.0, return=+1.0 | risk-averse selection |
| `AGGRESSIVE_DOCTRINE` | return=+2.0, risk=-0.5 | growth-first selection |
| `QUALITY_FIRST_DOCTRINE` | quality_score=+3.0 | data-quality gating |

Activate via env var: `DEFAULT_DOCTRINE=balanced|defensive|aggressive|quality_first`.

---

## 🔗 Integration with other engines

| Engine | Integration |
|--------|-------------|
| **Veritas Engine** | Veritas `regime` classification can automatically select the Horizon doctrine (`crisis → defensive`, `normal → balanced`) |
| **Neural Engine** | NE scores can be used as KPI values fed into Horizon's design space (`return = NE_composite_score`) |
| **Vault Keepers** | Horizon output (selected design point) can be archived via Vault for audit and replay |

---

## 🧪 Tests

- Unit tests: `vitruvyan_core/core/governance/horizon_engine/tests/test_horizon_livello1.py` (10 tests, incl. Pareto correctness)
- Run: `pytest vitruvyan_core/core/governance/horizon_engine/tests/ -v`
- All tests are pure Python — no Docker / Redis / Postgres required

---

## 📦 vit package

- Package descriptor: `service-horizon-engine.vit` (root of `vitruvyan-core`)
- Install: `vit install service-horizon-engine`
