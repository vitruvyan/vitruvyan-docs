# Babel Gardens API

> **Last Updated**: May 29, 2026 (v3.2)

<p class="kb-subtitle">LIVELLO 2 service for the four signal families + multilingual embeddings.</p>

## Location

- Service: `services/api_babel_gardens/`
- Pure core (LIVELLO 1): `vitruvyan_core/core/cognitive/babel_gardens/`
- Vertical schemas: `vitruvyan_core/domains/<vertical>/babel_gardens/`

## Base URL / Port

Default port is **`8009`** (env: `PORT`). On the dev compose stack the published port is `7009` mapped to `8009`.

## The canonical endpoint — `/v1/signals/extract`

Fused signal extraction. **This is what the chat orchestrator (`/run/stream`) calls in Phase 0.** All registered Sacred Order contributors run concurrently in a thread pool — the wall-clock is the slowest single contributor, not the sum.

### Request

```http
POST /v1/signals/extract
Content-Type: application/json

{
  "text": "string (required, max 10000 chars)",
  "correlation_id": "string (optional, propagates to bus events)",
  "tenant_id": "string (optional)",
  "families": ["language", "security_threat", "analyst_posture", "conversational_sentiment"]
}
```

`families` is an optional whitelist — leave it out to run all registered contributors. Useful for partial calls (e.g. only language detection).

### Response

```json
{
  "signals": {
    "language": {
      "signals": [
        {
          "signal_name": "language_detected",
          "value": "it",
          "confidence": 0.99,
          "source": "language",
          "method": "cascade:cache",
          "extraction_trace": {
            "method": "cascade:unicode-qdrant-cache-llm",
            "method_used": "cache",
            "cascade_trace": [
              { "step": "cache", "candidate": "it", "elapsed_ms": 3.4 }
            ],
            "embedding_model": "google/embeddinggemma-300m",
            "is_reliable": true,
            "elapsed_ms_total": 14.5,
            "interpretation": "absolute_ground_truth",
            "timestamp": "2026-05-29T09:30:00Z",
            "text_hash": "..."
          },
          "metadata": { "contributor": "language", "text_length": 62 }
        }
      ],
      "elapsed_ms": 14.5,
      "contributors_invoked": ["language"],
      "errors": []
    },
    "security_threat": { "signals": [ ... ], "elapsed_ms": 3640, "contributors_invoked": ["secbert", "security_threat_enums"], "errors": [] },
    "analyst_posture": { ... },
    "conversational_sentiment": { ... }
  },
  "elapsed_ms_total": 6850.2,
  "text_hash": "sha256(text[:200])",
  "correlation_id": "..."
}
```

### Latency

| Path | First call (cold) | Cached |
|---|---|---|
| Language only (cache hit) | 50-300 ms | <20 ms |
| Language only (LLM Tier D fallback) | 1-3 s | <20 ms |
| Full Phase 0 (4 families) | 6-7 s | ~1 s |

Phase 0 timeout from the graph side is 15 s (`SIGNALS_EXTRACT_TIMEOUT_S`).

### Family payload shape

Every family payload is:

```jsonc
{
  "signals": [ /* SignalEvidence — one per signal name emitted */ ],
  "elapsed_ms": 0.0,                  // sum of contributor times for this family
  "contributors_invoked": ["..."],    // which contributors ran (even if they errored)
  "errors": ["contributor: ErrorKind"] // present only on failure
}
```

A failure in one contributor (e.g. LLM timeout in `analyst_posture`) does not affect the others — the response still returns with the family's `errors` populated.

## Embeddings

### `POST /v1/embeddings/create`

General-purpose embedding via the cooperative path to `api_embedding:8010` (Nomic). Used for the corpus / RAG retrieval.

### `POST /v1/embeddings/multilingual`

Multilingual embedding **with** language detection. Internally delegates language detection to the canonical `LanguageContributor` cascade — no duplicate heuristic. Used when the caller wants both the vector and the detected language in one call.

### `POST /v1/embeddings/gemma` (v3.1+)

Direct wrapper over `model_manager.gemma_multilingual.encode()`. The model that's actually loaded is reported in `metadata.model` — `google/embeddinggemma-300m` when the gated repo is accessible, otherwise the fallback (`sentence-transformers/paraphrase-multilingual-mpnet-base-v2`).

This endpoint is what the `scripts/seed_language_samples.py` seed script uses. **Do not confuse it with `/multilingual`** — `/gemma` is a thin encode wrapper, no language detection, no Nomic cooperative call.

### `POST /v1/embeddings/batch`

Batch version of `/create`. Max 100 texts.

### `POST /v1/embeddings/similarity`

Cosine similarity between two texts (helper).

## Removed endpoints (v3.0)

These endpoints were retired when the signal architecture replaced the per-family HTTP routes. Callers must migrate to `/v1/signals/extract` with the appropriate `families` filter.

| Removed | Replacement |
|---|---|
| `POST /v1/sentiment/analyze` | `/v1/signals/extract` with `families: ["conversational_sentiment"]` |
| `POST /v1/sentiment/batch` | same — batch through the conversational layer instead |
| `POST /v1/emotion/detect` | retired entirely. The `analyst_posture` family in `/v1/signals/extract` covers the operationally relevant dimensions (urgency, stance, confidence) — emotion in the abstract was a finance-leftover concept that doesn't map onto security workflows |

## Health / metrics

- `GET /health` — components: models, cache, postgres, redis
- `GET /metrics` — Prometheus
- `GET /` — service info

## Profiles + cognitive bridge

`POST /v1/profiles/*`, `POST /v1/events/*`, `POST /v1/routing/intelligent` — legacy admin endpoints, kept for backward compat but not part of the Phase 0 flow.

## Service config — env vars

Loaded in `services/api_babel_gardens/config.py`:

| Variable | Default | Notes |
|---|---|---|
| `HOST`, `PORT` | `0.0.0.0`, `8009` | |
| `BABEL_DOMAIN` | (unset) | Set to `security` to register the security contributors at startup |
| `EMBEDDING_SERVICE_URL` | `http://embedding:8010` | api_embedding URL (Nomic, for the corpus). **Must be the docker service name inside the network** — `localhost` doesn't work inside the container |
| `BABEL_LANGUAGE_SIMILARITY_THRESHOLD` | 0.65 (dev) / 0.85 (prod) | Tier B threshold for the language cascade. Lower while the seed sample is small |
| `HUGGINGFACE_HUB_TOKEN` | (required for gated repos) | EmbeddingGemma is gated; the token must have access. `huggingface_hub.login()` is called process-wide at boot |
| `OPENAI_API_KEY` | (required) | Used by LLM-as-classifier contributors (posture, threat enums, language Tier D) |
| `BABEL_COMPREHENSION_V3` | `0` | Feature flag for the legacy `/v2/comprehend` endpoint. Independent from the Phase 0 path |
| `QDRANT_HOST`, `QDRANT_PORT` | `qdrant`, `6333` | Used by the language cascade Tier B (Qdrant search on `language_samples`) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB` | `redis`, `6379`, `0` | Bus + language cache Tier C |
| `POSTGRES_*` | | Used by the `model_manager` health probe — not for signal persistence (the persister has its own container) |

## Cognitive Bus channels

| Channel | Direction | Notes |
|---|---|---|
| `babel.signals.extracted` | emit | One event per `(signal_family, contributor)` per request. Consumed by `signal_observations_persister` |
| `babel.signals.fused` | emit | One aggregate event per request. Free for telemetry sinks |
| `babel.embedding.*`, `babel.sentiment.*`, `babel.emotion.*`, `babel.synthesis.*`, `babel.topic.*` | (legacy) | Declared but no longer emitted in v3.0+. Old consumers should migrate to `babel.signals.extracted` and filter by `signal_family` |
| `babel.error` | emit (planned) | Service-level errors |

For the persistence side (the `signal_observations` PostgreSQL table) see the Sacred Order page. For the bus mechanism + `drain_pel` safety net see [Synaptic Conclave Philosophy](../../system-core/architecture/SYNAPTIC_CONCLAVE_PHILOSOPHY.md).

## Request/response schemas

Pydantic models live in `services/api_babel_gardens/schemas/api_models.py`. Key types:

- `ExtractRequest`, `ExtractResponse`, `FamilyPayload` (in `routes_signals.py`)
- `EmbeddingRequest`, `BatchEmbeddingRequest`, `EmbeddingResponse`
- `LanguageCodeStr` — `Annotated[str, StringConstraints(pattern=r"^([a-z]{2}|auto)$")]` — replaced the legacy `LanguageCode` enum (deleted in v3.1)

The full signal contract is in `vitruvyan_core/contracts/comprehension.py`:

- `SignalEvidence` — `value` is `Union[float, str, List[str]]` to support `value_type: float | enum | multi-enum`
- `ISignalContributor` — interface that every plugin implements

## Scope boundary

- Babel Gardens is a **semantic-linguistic service**, not the graph router. Execution routing is decided by LangGraph (`intent_detection_node.py`, `route_node.py`).
- Babel **does not write to Qdrant during chat** — the `language_samples` collection is populated once by the seed script and read at Tier B. The corpus retrieval Qdrant writes are done by `evidence_indexer`, not by Babel.
- Babel **does not write to Postgres directly** — the bus consumer (`signal_observations_persister`) handles persistence. Babel only emits.
