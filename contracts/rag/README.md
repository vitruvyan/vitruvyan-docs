# RAG Governance Contracts

> **Last updated**: April 18, 2026 14:00 UTC

This directory contains the binding contracts for RAG (Retrieval-Augmented Generation) infrastructure governance.

## Documents

| File | Description |
|------|-------------|
| `RAG_GOVERNANCE_CONTRACT_V1.md` | Contract specification (tiers, naming, payload, compliance, phase 4 updates) |
| `RAG_GOVERNANCE_OPERATIONS.md` | Operational runbook (init, audit, metrics, stale checks, migration planning) |

## Lifecycle Governance (Semantic Warden V1)

The Semantic Warden is the governance domain for semantic memory lifecycle.
It is NOT an autonomous agent — it is a composed subsystem of deterministic workers, contracts, and metrics.

| Component | Location | Description |
|-----------|----------|-------------|
| Contract types | `vitruvyan_core/contracts/rag.py` | `CollectionHealthReport`, `DeduplicationReport`, `LifecycleEvent`, channel constants, DDL |
| Workers | `vitruvyan_core/core/rag/lifecycle/` | `stale_checker`, `metrics_exporter`, `health_report` |
| Tests | `tests/unit/contracts/test_rag_lifecycle.py` | 31 unit tests |
| KB Documentation | [RAG Lifecycle Ops](../../knowledge_base/rag/lifecycle.md) | Full operational documentation |

## Python Interface

The programmatic contract interface lives at:
- `vitruvyan_core/contracts/rag.py`

Import via:
```python
from contracts.rag import CollectionDeclaration, CollectionTier, RAGPayload
# or
from vitruvyan_core.contracts import CollectionTier, RAGPayload, deterministic_point_id
```

## Quick Reference

### Collection Tiers
- **CORE**: OS-level, permanent (e.g., `semantic_states`, `conversations_embeddings`)
- **ORDER**: Sacred Order data (e.g., `entity_embeddings`, `weave_embeddings`)
- **DOMAIN**: Vertical-specific (e.g., `finance.templates`)
- **EPHEMERAL**: Test/tmp (`test_*`, `tmp_*`)

### Key Rules
1. All access through `QdrantAgent` — no raw Qdrant clients
2. All collections declared in `scripts/init_qdrant_collections.py`
3. All payloads include `source` + `created_at` metadata
4. Collection declarations include model/version metadata (`model_name`, `version`) for phase 4 governance

### Phase 4 Highlights

- Embedding model registry (`EMBEDDING_MODELS`) with dimension validation
- Collection versioning support in declaration model
- Stale detection utilities (`StaleReport`, `check_stale_collection`)
- Retrieval effectiveness metrics (`SearchMetrics`, `RAGMetricsCollector`)
