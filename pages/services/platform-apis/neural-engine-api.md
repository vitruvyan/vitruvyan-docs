---
tags:
  - api
  - neural-engine
  - cognitive-modules
  - scoring
  - admin
---

# 🧠 Neural Engine API

> **Last Updated**: March 23, 2026 12:00 UTC

<p class="kb-subtitle">LIVELLO 2 service for domain-agnostic multi-factor ranking, composite scoring, and entity screening.</p>

## 📍 Location

- Service: `services/api_neural_engine/`
- Pure core: `vitruvyan_core/core/neural_engine/`

## 🚪 Base URL / Port

- Config default: `PORT=8003` (`services/api_neural_engine/config.py`)
- Docker external port: **9003** (see `infrastructure/docker/docker-compose.yml`)

## 🧭 Endpoints (implemented)

Defined in `services/api_neural_engine/api/routes.py`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/screen` | multi-factor entity screening and composite ranking |
| `POST` | `/rank` | single-factor ranking across an entity universe |
| `GET`  | `/health` | dependency-aware health (Postgres, Redis, embedding) |
| `GET`  | `/metrics` | Prometheus text metrics |
| `GET`  | `/profiles` | list available scoring profiles |
| `GET`  | `/` | service info (version, domain, uptime) |

## 🧾 Request/Response models

Pydantic models live in `services/api_neural_engine/schemas/api_models.py`.

### `POST /screen`

**Request** (`ScreenRequest`):

```json
{
  "profile": "finance_v1",
  "entity_ids": ["AAPL", "MSFT", "GOOGL"],
  "filters": {},
  "top_k": 10,
  "stratification_mode": "global",
  "risk_tolerance": "medium",
  "mode": "discovery"
}
```

Key fields:
- `profile` — scoring profile name (maps to `IScoringStrategy` implementation)
- `stratification_mode` — `global` | `stratified` | `composite`
- `risk_tolerance` — `low` | `medium` | `high`

**Response** (`ScreenResponse`): ranked list of entities with composite scores, z-scores per factor, rank, percentile, and explainability audit trail.

### `POST /rank`

**Request** (`RankRequest`):
- `feature_name: str` — single KPI to rank by
- `entity_ids: List[str]`
- `top_k: int`
- `higher_is_better: bool` (default `true`)

### `GET /health`

Returns dependency-aware status:
- Postgres reachability
- Redis/StreamBus reachability
- Embedding service reachability
- Overall: `healthy | degraded | critical`

## ⚙️ Env vars (service-level)

Loaded in `services/api_neural_engine/config.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8003` | HTTP listen port |
| `LOG_LEVEL` | `INFO` | logging verbosity |
| `DOMAIN` | `mock` | domain plugin to load (`finance`, `mock`, …) |
| `NE_CACHE_TTL_SECONDS` | `30` | scoring result cache TTL |
| `NE_STRATIFICATION_MODE` | `global` | default stratification (`global`/`stratified`/`composite`) |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated CORS origins |

## 🔗 Integration with Cognitive Modules

The Neural Engine is the **scoring** step in the Cognitive Pipeline. It integrates with:

| Module | Integration |
|--------|-------------|
| **Veritas Engine** | validate signal quality before scoring; skip entities where `quality_score < threshold` or `regime = crisis` |
| **Horizon Engine** | NE composite scores can serve as KPI inputs to Horizon's design space (e.g. `return = NE_score`) |
| **Babel Gardens** | NE consumes normalized entity features published by Babel Gardens via StreamBus |

## 🐳 Docker

```bash
docker compose build neural_engine
docker compose up -d neural_engine
```

## 🔗 Related

- [Neural Engine (module)](../../vitruvyan_core/core/neural_engine/README.md)
- [Veritas Engine API](VERITAS_ENGINE_API.md)
- [Horizon Engine API](HORIZON_ENGINE_API.md)
