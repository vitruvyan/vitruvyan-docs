---
tags:
  - api
  - veritas-engine
  - cognitive-modules
  - admin
---

# 🌐 Veritas Engine API (DSE)

> **Last Updated**: March 23, 2026 12:00 UTC

<p class="kb-subtitle">LIVELLO 2 service for signal quality validation, regime detection, and confidence aggregation.</p>

## 📍 Location

- Service: `services/api_veritas_engine/`
- Pure core: `vitruvyan_core/core/governance/veritas_engine/`
- Module doc: [Veritas Engine](../orders/VERITAS_ENGINE.md)

## 🚪 Base URL / Port

- Config default: `SERVICE_PORT=8013` (`services/api_veritas_engine/config.py`)
- Docker external port: **9013** (see `infrastructure/docker/docker-compose.yml`)

## 🧭 Endpoints (implemented)

Defined in `services/api_veritas_engine/api/routes.py`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | liveness + bus connectivity status |
| `POST` | `/validate` | run a full signal quality validation |
| `GET` | `/validate/{run_id}` | retrieve a past run (501 — not yet implemented) |

## 🧾 Request/Response models

See `services/api_veritas_engine/models/schemas.py`.

### `POST /validate`

**Request** (`ValidationRunRequest`):

```json
{
  "entity_ids": ["AAPL", "MSFT", "GOOGL"],
  "features": {
    "AAPL": {
      "completeness": 0.95,
      "z_consistency": 0.88,
      "freshness": 0.90,
      "sample_adequacy": 0.75,
      "outlier_probability": 0.05,
      "value": 185.5,
      "staleness_days": 0
    }
  },
  "domain": "finance",
  "diagnostics_level": "standard"
}
```

**Response** (`ValidationRunResponse`):

```json
{
  "run_id": "ve-20260323-a1b2c3d4",
  "profile": "default",
  "entity_count": 3,
  "overall_confidence": 0.872,
  "regime": {
    "classification": "normal",
    "score": 0.21,
    "components": {}
  },
  "qualities": [
    {
      "entity_id": "AAPL",
      "quality_score": 0.91,
      "flags": [],
      "components": {}
    }
  ],
  "produced_at": "2026-03-23T12:00:00Z",
  "diagnostics": {}
}
```

### `GET /health`

**Response** (`HealthCheckResponse`):

```json
{
  "status": "ok",
  "service": "api_veritas_engine",
  "bus_connected": true
}
```

## ⚙️ Env vars (service-level)

Loaded in `services/api_veritas_engine/config.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_PORT` | `8013` | HTTP listen port |
| `LOG_LEVEL` | `INFO` | logging verbosity |
| `QUALITY_PROFILE` | `default` | threshold preset (`default`/`strict`/`relaxed`) |
| `NEURAL_ENGINE_URL` | `http://neural_engine:8003` | upstream NE URL (optional) |
| `REDIS_URL` | `redis://redis:6379` | StreamBus connection |
| `POSTGRES_HOST` | `postgres` | audit log DB host |
| `POSTGRES_DB` | `vitruvyan` | audit log DB name |
| `POSTGRES_USER` | `vitruvyan` | audit log DB user |
| `POSTGRES_PASSWORD` | *(secret)* | audit log DB password |

## 🔄 Redis Streams Listener

`services/api_veritas_engine/streams_listener.py` runs as a sidecar container.

- **Channel**: `veritas.validation.requested`
- **Consumer group**: `veritas_engine`
- **Trigger**: deserializes payload → calls `VeritasBusAdapter.run_validation()`
- **ACK**: acknowledges event after successful processing

## 🗄️ Audit Log (optional)

`services/api_veritas_engine/adapters/persistence.py` writes to:

```sql
TABLE veritas_audit_log (
  run_id        TEXT PRIMARY KEY,
  profile       TEXT,
  entity_count  INTEGER,
  overall_confidence FLOAT,
  regime        TEXT,
  produced_at   TIMESTAMPTZ,
  diagnostics   JSONB
)
```

Insert is `ON CONFLICT DO NOTHING` — idempotent.
Postgres wiring is optional: if `PostgresAgent` is unavailable the audit log silently skips.

## 🐳 Docker

```yaml
# infrastructure/docker/docker-compose.yml (excerpt)
veritas_engine:
  build: services/api_veritas_engine
  ports:
    - "9013:8013"
  environment:
    - QUALITY_PROFILE=default
    - REDIS_URL=redis://redis:6379
```

```bash
# Build + deploy
docker compose build veritas_engine
docker compose up -d veritas_engine
```

## 🔗 Related

- [Veritas Engine (module)](../orders/VERITAS_ENGINE.md)
- [Neural Engine API](NEURAL_ENGINE_API.md)
- [Horizon Engine API](HORIZON_ENGINE_API.md)
