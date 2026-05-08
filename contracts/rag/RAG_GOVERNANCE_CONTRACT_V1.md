# RAG Governance Contract V1

Last updated: May 2026  
Status: ACTIVE  
Version: 1.3.0  
Owner: Vitruvyan Core Architecture

---

## 1. Purpose

This contract defines binding governance rules for RAG infrastructure in Vitruvyan.

RAG is a managed memory substrate. The objective is to prevent collection sprawl, hidden coupling, and silent quality decay.

Normative keywords follow RFC 2119 semantics: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY.

---

## 2. Scope

This contract applies to:

- all Qdrant collections used by Vitruvyan services
- `QdrantAgent` as the canonical runtime gateway
- collection declarations and bootstrap via `scripts/init_qdrant_collections.py`
- registry contracts in `vitruvyan_core/contracts/rag.py`
- audit and compliance tooling (`scripts/audit_rag_collections.py`)

This contract does not define Qdrant cluster topology (infra concern).

---

## 3. Core Principles

### 3.1 Single Gateway

Service runtime code MUST use `QdrantAgent`.

- forbidden: direct `QdrantClient` usage in business logic
- forbidden: raw Qdrant REST calls in business logic
- exception: bootstrap/ops scripts MAY use direct calls when needed

### 3.2 Declared Collections Only

Production collections MUST be declared and owned.

- declaration authority: `scripts/init_qdrant_collections.py`
- programmatic registry: `vitruvyan_core/contracts/rag.py`
- undeclared live collections are ORPHAN and SHOULD be remediated

### 3.3 No Hardcoded Collection Defaults

Collection names MUST be explicit at call sites.

Current implementation status:

- `search_phrases(..., collection=...)` -> enforced
- `upsert_semantic_state(..., collection=...)` -> enforced
- `upsert_point_from_grounding(..., collection=...)` -> enforced

### 3.4 Soft Runtime Guards

`QdrantAgent` includes non-blocking governance guards:

- undeclared collection usage warning (`RAG_ENFORCE_REGISTRY=warn|strict|off`)
- payload warning when `payload.source` is missing (MUST metadata)

### 3.5 Single Embedding Entry Point (LangGraph Nodes)

All LangGraph nodes that generate embeddings MUST use the shared client:

- module: `vitruvyan_core/core/orchestration/langgraph/node/_embedding.py`
- functions: `embed_text(text)`, `embed_batch(texts)`
- forbidden: direct `httpx.post()` to any embedding endpoint inside a node
- forbidden: re-declaring `EMBEDDING_API_URL` env var resolution in individual nodes
- exception: `semantic_grounding_node` delegates to `VSGSEngine` (infrastructure boundary — acceptable)
- exception: `intent_detection_node` calls `{BABEL_API_URL}/v1/embeddings/multilingual` (Babel internal routing — different service)

---

## 4. Collection Taxonomy

### 4.1 Tiers

| Tier | Scope | Lifecycle | Example |
|---|---|---|---|
| CORE | OS-level, domain-agnostic | long-lived | `semantic_states`, `conversations_embeddings` |
| ORDER | Sacred Order operational | managed by owner order | `entity_embeddings`, `weave_embeddings` |
| DOMAIN | vertical-specific | vertical lifecycle | `finance.templates` |
| EPHEMERAL | tests/migration/temp | disposable | `test_*`, `tmp_*`, `migration_*` |

### 4.2 Naming

- lowercase, 3-64 chars
- allowed chars: `[a-z0-9_.]`
- domain collections SHOULD use `<domain>.<purpose>`
- EPHEMERAL collections MUST use approved prefixes

Grandfathered active names:

- `semantic_states`
- `phrases_embeddings`
- `conversations_embeddings`
- `entity_embeddings`
- `weave_embeddings`

### 4.3 Ownership

- write path: owner-first responsibility
- read path: cross-order reads allowed when contract-compliant

---

## 5. Vector and Model Standards

### 5.1 Collection Declaration Fields

`CollectionDeclaration` supports:

- `name`
- `vector_size`
- `distance`
- `tier`
- `owner`
- `purpose`
- `domain`
- `model_name` (phase 4)
- `version` (phase 4)

### 5.2 Canonical Embedding Model

The system embedding model is **`nomic-ai/nomic-embed-text-v1.5`** (768 dimensions).

- provider: `api_embedding` service (container `core_embedding`, port 8010)
- canonical dimension constant: `_embedding.EXPECTED_DIM = 768`
- all active CORE and ORDER collections MUST use 768-dim vectors
- the 768 value is the single source of truth: `integrity_watcher.py` and `_embedding.EXPECTED_DIM` MUST stay aligned

### 5.2.1 Vision Embedding Model (Cross-Modal)

`api_embedding` also loads **`nomic-ai/nomic-embed-vision-v1.5`** for image inputs.

- revision pinned to `9e4269d0524e` (pre–type-annotation bug in upstream nomic-bert HEAD)
- output dimension: **768** — identical latent space as `nomic-embed-text-v1.5`
- cross-modal cosine search works out of the box against any 768-dim text collection (e.g. `phrases_embeddings`)
- endpoints:
  - `POST /v1/embeddings/image` — single base64-encoded image (PNG/JPEG/WEBP)
  - `POST /v1/embeddings/image/batch` — batch of base64 images (max 50)
- env vars: `EMBEDDING_VISION_MODEL` (default `nomic-ai/nomic-embed-vision-v1.5`), `EMBEDDING_VISION_REVISION` (default `9e4269d0524e`)
- service returns HTTP 503 if vision model failed to load (text path unaffected)

### 5.3 Multi-Model Rules (Phase 4)

Multi-model deployments are supported with explicit declaration.

- `model_name` MUST be declared per collection
- `vector_size` MUST match declared model dimension
- model registry lives in `contracts/rag.py` (`EMBEDDING_MODELS`)
- cross-collection mixed dimensions are allowed only when each collection is internally consistent

### 5.4 Versioning Rules (Phase 4)

Collection schema versioning is supported.

- `version` MUST be integer >= 1
- v1 uses canonical collection name
- v2+ MAY use suffix strategy (`<name>_vN`) during migration
- migrations SHOULD use explicit migration planning (see Section 9)

---

## 6. Payload Contract

Every upserted point MUST include:

- `source`
- `created_at`

Recommended metadata:

- `text`
- `version`
- `domain`

`RAGPayload` in `contracts/rag.py` is the canonical helper for payload normalization.

---

## 7. Runtime Integration

### 7.1 Embedding Service Environment Variables

Each service reads the embedding base URL from the environment variable appropriate to its client:

| Service | Env var | Notes |
|---|---|---|
| `graph` (LangGraph nodes) | `EMBEDDING_API_URL` | shared by `_embedding.py`, `qdrant_node`, `can_node` |
| `babel_gardens` | `EMBEDDING_SERVICE_URL` | consumed by `EmbeddingEngineCooperative` |
| `memory_orders` / `memory_orders_listener` | `EMBEDDING_API_URL` | consumed by `memory_orders/config.py` |
| `codex_hunters` | `EMBEDDING_API_URL` | consumed by `codex_hunters/config.py` |
| `pattern_weavers` | `EMBEDDING_URL` | consumed by `EmbeddingAdapter` |

All values point to `http://embedding:8010` in the Docker stack.

### 7.2 Write Path (Current)

Representative active flows:

- Codex Hunters -> `entity_embeddings`
- Embedding service -> `phrases_embeddings`
- Pattern Weavers -> `weave_embeddings`
- VSGS / semantic grounding sync -> `semantic_states`
- CAN conversational memory -> `conversations_embeddings`

Note: legacy `sentiment_embeddings` is not part of the active declared registry.

### 7.3 Read Path

LangGraph retrieval follows a tiered cascade in `qdrant_node` with semantic-first upgrades:

1. `user_documents` (user-uploaded chunks, filtered by `user_id`) — highest priority
2. `conversations_embeddings` — conversational memory
3. `phrases_embeddings` — NLP seed phrases
4. `weave_embeddings` — ontological patterns (fallback)

All retrieval calls pass explicit collection names. Embedding for search is generated via `embed_text()` from `_embedding.py`.

**Semantic-first upgrades (Phase 6, env-gated)**:

| Component | Class | Env var | Default |
|---|---|---|---|
| Query expansion | `HyDEQueryExpander` | `RAG_HYDE_ENABLED` | `1` (on) |
| Re-ranking | `CrossEncoderReranker` | `RAG_SEMANTIC_RERANKER` | `1` (on) |
| Quality evaluation | `LLMRAGEvaluator` | `RAG_METRICS` | `1` (on) |

- **HyDE** (Hypothetical Document Embedding): LLM generates a short hypothetical answer to the query; both the original query and the hypothetical are embedded and searched in parallel; results are merged and deduplicated. Requires `OPENAI_API_KEY`; degrades to `SimpleQueryExpander` if not set.
- **CrossEncoderReranker**: After candidate hits are collected, a cross-encoder (`ms-marco-MiniLM-L-6-v2`) re-scores each `(query, passage)` pair jointly. Requires `sentence-transformers`; degrades to cosine-order truncation if unavailable.
- **LLMRAGEvaluator**: When `RAG_METRICS=1`, scores the retrieved context on faithfulness, relevance and context precision using the LLM-as-judge pattern. Result written to `state["result"]["rag_eval"]`.

The fallback chain is always: semantic primary → deterministic fallback → no-op. The retrieval pipeline never raises on degradation.

---

## 8. Audit and Compliance

### 8.1 Canonical Audit Tool

`scripts/audit_rag_collections.py` reports:

- OK
- MISSING
- MISMATCH
- ORPHAN

### 8.2 Stale Detection Utilities (Phase 4)

`contracts/rag.py` provides stale analysis helpers:

- `StaleReport`
- `check_stale_collection(...)`
- `RAG_STALE_THRESHOLD_DAYS`

### 8.3 Effectiveness Metrics Utilities (Phase 4)

`contracts/rag.py` provides retrieval quality instrumentation:

- `SearchMetrics`
- `RAGMetricsCollector`
- global collector via `get_rag_metrics()`

`QdrantAgent.search()` can auto-record metrics when `RAG_METRICS != 0`.

### 8.4 Compliance Checklist

A deployment is compliant when:

1. no undeclared live collections
2. no missing declared collections
3. declared vector/distance values match live config
4. Qdrant access path is contract-compliant
5. required payload metadata is enforced at adapter boundaries

---

## 9. Migration Planning (Phase 4)

`contracts/rag.py` includes migration planning primitives:

- `MigrationPlan`
- `plan_collection_migration(...)`

Use these for controlled v1 -> v2 and/or model migrations.

---

## 10. Current State (April 8, 2026)

### 10.1 Completed

- Phase 1 cleanup: orphan collection purge
- Phase 2 wiring: explicit collection params and missing reader/writer paths
- Phase 3 enforcement: audit script + runtime soft guards
- Phase 4 core primitives:
  - model registry (`EmbeddingModel`, `EMBEDDING_MODELS`)
  - per-collection model/version fields
  - stale detection utilities
  - retrieval effectiveness metrics collector
  - `QdrantAgent` CLI metrics mode
- Phase 6 — Semantic-first retrieval upgrade (May 2026):
  - `HyDEQueryExpander`: LLM generates hypothetical answer for dual-vector search (Gao et al., NAACL 2023)
  - `CrossEncoderReranker`: joint `(query, passage)` scoring via `ms-marco-MiniLM-L-6-v2` (lazy-load, graceful fallback)
  - `LLMRAGEvaluator`: LLM-as-judge scoring (faithfulness, relevance, context precision); neutral fallback on error
  - All three classes in `vitruvyan_core/contracts/retrieval.py`
  - `qdrant_node.py` wired: HyDE multi-vec search → cascade → CrossEncoder rerank → LLMRAGEvaluator on `RAG_METRICS=1`
  - Env vars: `RAG_HYDE_ENABLED`, `RAG_SEMANTIC_RERANKER`, `RAG_METRICS` added to graph service in `docker-compose.yml`
  - Unit tests: `tests/unit/contracts/test_retrieval_semantic.py` (34 tests, 100% pass)
  - Golden rule added to `copilot-instructions.md`: "Retrieval is semantic, not deterministic"
- Phase 5 — Embedding topology consolidation (April 2026):
  - `_embedding.py` introduced as single embedding entry point for all LangGraph nodes
  - `qdrant_node.py` and `can_node.py` refactored — no direct `httpx` embedding calls
  - `EXPECTED_DIM = 768` as canonical dimension constant
  - `_check_dim()` available for optional dimension assertion
  - env var names aligned across all consumer services (see Section 7.1)
  - Babel Gardens `EmbeddingEngineCooperative` correctly wired to `api_embedding` (critical fix: `EMBEDDING_SERVICE_URL` was `EMBEDDING_URL` — caused 384-dim fallback)
  - `qdrant_node` URL construction bug fixed (path was embedded in env var default)
  - Unit test suite: `tests/unit/orchestration/test_embedding_client.py` (20 tests)
  - Vision model: `nomic-embed-vision-v1.5` (pinned `9e4269d0524e`) — same 768-dim latent space; `/v1/embeddings/image` + `/v1/embeddings/image/batch` endpoints (cross-modal cosine search ready)

### 10.2 Remaining Operational Work

- stale alerting integration (automated scheduling + alert channel)
- long-term metrics persistence/observability dashboards
- migration playbook automation for large collections

---

## 11. Change Control

1. CORE/ORDER contract changes require contract amendment in this document.
2. DOMAIN collection additions follow vertical governance and manifest policy.
3. Breaking changes require V2 contract.

---

## 12. References

- `vitruvyan_core/contracts/rag.py`
- `vitruvyan_core/contracts/retrieval.py` — retrieval class hierarchy (IQueryTransformer, IReranker, IRAGEvaluator)
- `vitruvyan_core/core/agents/qdrant_agent.py`
- `vitruvyan_core/core/orchestration/langgraph/node/_embedding.py`
- `vitruvyan_core/core/orchestration/langgraph/node/qdrant_node.py`
- `vitruvyan_core/core/orchestration/langgraph/node/can_node.py`
- `tests/unit/orchestration/test_embedding_client.py`
- `tests/unit/contracts/test_retrieval_semantic.py` — HyDE, CrossEncoder, LLMRAGEvaluator (34 tests)
- `scripts/init_qdrant_collections.py`
- `scripts/audit_rag_collections.py`
- `docs/contracts/verticals/VERTICAL_CONTRACT_V1.md`
