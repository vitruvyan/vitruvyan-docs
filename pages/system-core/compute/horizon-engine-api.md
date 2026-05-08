---
tags:
  - api
  - horizon-engine
  - cognitive-modules
  - optimisation
  - admin
---

# 🌐 Horizon Engine API

> **Last Updated**: March 23, 2026 12:00 UTC

<p class="kb-subtitle">LIVELLO 2 service for Pareto frontier optimisation and doctrine-based design-point ranking.</p>

## 📍 Location

- Service: `services/api_horizon_engine/`
- Pure core: `vitruvyan_core/core/governance/horizon_engine/`
- Module doc: [Horizon Engine](../orders/HORIZON_ENGINE.md)

## 🚪 Base URL / Port

- Config default: `SERVICE_PORT=8014` (`services/api_horizon_engine/config.py`)
- Docker external port: **9014** (see `infrastructure/docker/docker-compose.yml`)

## 🧭 Endpoints (implemented)

Defined in `services/api_horizon_engine/api/routes.py`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | liveness + bus connectivity status |
| `POST` | `/optimise` | run a Pareto optimisation + doctrine ranking |
| `GET` | `/optimise/{run_id}` | retrieve a past run (501 — not yet implemented) |

## 🧾 Request/Response models

See `services/api_horizon_engine/models/schemas.py`.

### `POST /optimise`

**Request** (`OptimisationRunRequest`):

```json
{
  "space_definition": {
    "space_id": "portfolio-q1-2026",
    "objectives": [
      {"name": "return",        "direction": "maximize", "weight": 1.0},
      {"name": "risk",          "direction": "minimize", "weight": 1.0},
      {"name": "quality_score", "direction": "maximize", "weight": 0.5}
    ],
    "doctrine": "defensive",
    "knobs": [],
    "description": "Q1 2026 portfolio selection"
  },
  "design_points": [
    {"config_id": "A", "values": {"return": 0.12, "risk": 0.08, "quality_score": 0.91}},
    {"config_id": "B", "values": {"return": 0.09, "risk": 0.04, "quality_score": 0.95}},
    {"config_id": "C", "values": {"return": 0.15, "risk": 0.18, "quality_score": 0.70}}
  ],
  "seed": 42,
  "diagnostics_level": "standard"
}
```

**Response** (`OptimisationRunResponse`):

```json
{
  "run_id": "he-20260323-b2c3d4e5",
  "pareto_frontier": {
    "points": [
      {
        "config_id": "A",
        "values":      {"return": 0.12, "risk": 0.08, "quality_score": 0.91},
        "norm_values": {},
        "is_pareto": true,
        "doctrine_score": 0.14,
        "doctrine_rank": 2
      },
      {
        "config_id": "B",
        "values":      {"return": 0.09, "risk": 0.04, "quality_score": 0.95},
        "norm_values": {},
        "is_pareto": true,
        "doctrine_score": 0.17,
        "doctrine_rank": 1
      }
    ],
    "size": 2,
    "doctrine": "defensive"
  },
  "recommended_id": "B",
  "doctrine": "defensive",
  "total_design_points": 3,
  "produced_at": "2026-03-23T12:00:00Z",
  "diagnostics": {}
}
```

### `GET /health`

**Response** (`HealthCheckResponse`):

```json
{
  "status": "ok",
  "service": "api_horizon_engine",
  "bus_connected": true
}
```

## ⚙️ Env vars (service-level)

Loaded in `services/api_horizon_engine/config.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_PORT` | `8014` | HTTP listen port |
| `LOG_LEVEL` | `INFO` | logging verbosity |
| `DEFAULT_DOCTRINE` | `balanced` | doctrine preset (balanced/defensive/aggressive/quality_first) |
| `DEFAULT_SEED` | `42` | RNG seed for reproducibility |
| `VERITAS_ENGINE_URL` | `http://veritas_engine:8013` | upstream Veritas URL (optional) |
| `REDIS_URL` | `redis://redis:6379` | StreamBus connection |
| `POSTGRES_HOST` | `postgres` | audit log DB host |
| `POSTGRES_DB` | `vitruvyan` | audit log DB name |
| `POSTGRES_USER` | `vitruvyan` | audit log DB user |
| `POSTGRES_PASSWORD` | *(secret)* | audit log DB password |

## 🔄 Redis Streams Listener

`services/api_horizon_engine/streams_listener.py` runs as a sidecar container.

- **Channel**: `horizon.optimisation.requested`
- **Consumer group**: `horizon_engine`
- **Trigger**: deserializes payload → calls `HorizonBusAdapter.run_optimisation()`
- **ACK**: acknowledges event after successful processing

## 🗄️ Audit Log (optional)

`services/api_horizon_engine/adapters/persistence.py` writes to:

```sql
TABLE horizon_audit_log (
  run_id              TEXT PRIMARY KEY,
  doctrine            TEXT,
  total_design_points INTEGER,
  pareto_size         INTEGER,
  recommended_id      TEXT,
  produced_at         TIMESTAMPTZ,
  diagnostics         JSONB
)
```

Insert is `ON CONFLICT DO NOTHING` — idempotent.
Postgres wiring is optional: if `PostgresAgent` is unavailable the audit log silently skips.

## 🐳 Docker

```yaml
# infrastructure/docker/docker-compose.yml (excerpt)
horizon_engine:
  build: services/api_horizon_engine
  ports:
    - "9014:8014"
  environment:
    - DEFAULT_DOCTRINE=balanced
    - REDIS_URL=redis://redis:6379
```

```bash
# Build + deploy
docker compose build horizon_engine
docker compose up -d horizon_engine
```

## 🔗 Related

- [Horizon Engine (module)](../orders/HORIZON_ENGINE.md)
- [Veritas Engine API](VERITAS_ENGINE_API.md)
- [Neural Engine API](NEURAL_ENGINE_API.md)
