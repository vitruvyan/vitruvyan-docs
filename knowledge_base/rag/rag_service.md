---
tags:
  - rag
  - embedding
  - service
  - api
  - vision
---

# RAG Service — Embedding API

> **Last updated**: April 8, 2026 12:00 UTC

<p class="kb-subtitle">Servizio LIVELLO 2 per text embedding (nomic-embed-text-v1.5, 768d) e vision embedding (nomic-embed-vision-v1.5, 768d) con archiviazione opzionale in Qdrant.</p>

---

## Panoramica

`api_embedding` è il **gateway centrale di embedding** dello stack. Serve due modelli nella stessa latent space a 768 dimensioni — testo e immagini sono direttamente comparabili con cosine similarity.

| Modello | Input | Dimensione | Architettura |
|---------|-------|-----------|-------------|
| `nomic-ai/nomic-embed-text-v1.5` | Testo (max 8192 token) | 768 | `nomic-bert-2048` |
| `nomic-ai/nomic-embed-vision-v1.5` | Immagine base64 (PNG/JPEG/WEBP) | 768 | `nomic-bert-2048` |

Entrambi richiedono `trust_remote_code=True` (architettura custom). Il modello vision è **pinned** alla revisione `9e4269d0524e` per evitare un bug di annotazione type introdotto in una versione successiva dell'upstream.

---

## Posizione e Porta

```
Service:    services/api_embedding/
Container:  core_embedding
Port:       8010 (container) / 9010 (host)
```

Variabile env: `PORT` (default `8010`).

---

## Accesso dal codice (LangGraph Nodes)

I nodi LangGraph non chiamano direttamente il servizio — usano il client centralizzato:

```python
from core.orchestration.langgraph.node._embedding import (
    embed_text,
    embed_batch,
    EXPECTED_DIM,  # 768
)

# Singolo testo
vec: list[float] = embed_text("testo da embeddare")

# Batch (efficiente per pipeline)
vecs: list[list[float]] = embed_batch(["testo 1", "testo 2"])

# Verifica dimensione
assert len(vec) == EXPECTED_DIM
```

Il client legge `EMBEDDING_API_URL` (default `http://embedding:8010`) e gestisce logging DEBUG/ERROR.

---

## Endpoint

### `GET /health`

Risponde `200 OK` con status dei componenti (modello testuale, modello vision, Postgres, Qdrant).

```json
{
  "status": "healthy",
  "model_loaded": true,
  "postgres_connected": true,
  "qdrant_connected": true
}
```

---

### `POST /v1/embeddings/create`

Embedding di un singolo testo.

**Request**:
```json
{
  "text": "descrizione del prodotto",
  "store_in_qdrant": false,
  "collection_name": "phrases_embeddings"
}
```

**Response**:
```json
{
  "success": true,
  "embedding": [0.012, -0.034, ...],
  "dimension": 768,
  "model_used": "nomic-ai/nomic-embed-text-v1.5",
  "processing_time_ms": 18.4,
  "stored_in_qdrant": false
}
```

---

### `POST /v1/embeddings/batch`

Batch di testi (max 100). Più efficiente di N chiamate singole.

**Request**:
```json
{
  "texts": ["testo 1", "testo 2", "testo 3"],
  "store_in_qdrant": false,
  "collection_name": "phrases_embeddings"
}
```

**Response**:
```json
{
  "success": true,
  "embeddings": [[...], [...], [...]],
  "count": 3,
  "dimension": 768,
  "processing_time_ms": 35.1
}
```

---

### `POST /v1/embeddings/image` *(vision)*

Embedding di una singola immagine base64. Il vettore output è nello stesso spazio latente del testo — la ricerca cross-modale funziona direttamente contro qualsiasi collezione 768-dim.

**Request**:
```json
{
  "image_b64": "<base64 encoded PNG/JPEG/WEBP>",
  "store_in_qdrant": true,
  "collection_name": "phrases_embeddings",
  "metadata": {
    "source": "upload",
    "description": "screenshot dashboard"
  }
}
```

**Response**:
```json
{
  "success": true,
  "embedding": [0.008, -0.021, ...],
  "dimension": 768,
  "model_used": "nomic-ai/nomic-embed-vision-v1.5",
  "processing_time_ms": 42.7,
  "stored_in_qdrant": true
}
```

Restituisce HTTP **503** se il modello vision non si è caricato correttamente (il path testo rimane attivo).

---

### `POST /v1/embeddings/image/batch` *(vision)*

Batch di immagini base64 (max 50).

**Request**:
```json
{
  "images_b64": ["<base64_1>", "<base64_2>"],
  "store_in_qdrant": false,
  "collection_name": "phrases_embeddings"
}
```

**Response**: stessa struttura di `/v1/embeddings/batch` con `embeddings[]`.

---

### `GET /v1/stats`

Statistiche runtime: modello caricato, dimensione, stato componenti.

```json
{
  "success": true,
  "stats": {
    "model": {
      "name": "nomic-ai/nomic-embed-text-v1.5",
      "loaded": true,
      "dimension": 768
    },
    "vision_model": {
      "name": "nomic-ai/nomic-embed-vision-v1.5",
      "loaded": true
    },
    "components": {
      "postgres": true,
      "qdrant": true
    }
  }
}
```

---

### `GET /metrics`

Endpoint Prometheus (definito in `main.py`). Raccoglie metriche operative del servizio.

---

## Variabili di Configurazione

Caricate da `services/api_embedding/config.py`:

| Var | Default | Descrizione |
|-----|---------|-------------|
| `PORT` | `8010` | Porta HTTP del servizio |
| `LOG_LEVEL` | `INFO` | Livello logging |
| `EMBEDDING_MODEL` | `nomic-ai/nomic-embed-text-v1.5` | Modello testo |
| `EMBEDDING_VISION_MODEL` | `nomic-ai/nomic-embed-vision-v1.5` | Modello vision |
| `EMBEDDING_VISION_REVISION` | `9e4269d0524e` | Revisione git pinned (stability) |
| `QDRANT_COLLECTION` | `phrases_embeddings` | Collezione Qdrant di default |
| `QDRANT_URL` | `http://core_qdrant:6333` | Endpoint Qdrant |
| `POSTGRES_HOST` | — | Host PostgreSQL |
| `POSTGRES_DB` | — | Database PostgreSQL |
| `POSTGRES_USER` | — | Utente PostgreSQL |
| `POSTGRES_PASSWORD` | — | Password PostgreSQL |

---

## Schema Pydantic

Modelli in `services/api_embedding/schemas.py`:

| Schema | Endpoint |
|--------|---------|
| `EmbeddingRequest` | `/v1/embeddings/create` |
| `BatchEmbeddingRequest` | `/v1/embeddings/batch` |
| `ImageEmbeddingRequest` | `/v1/embeddings/image` |
| `BatchImageEmbeddingRequest` | `/v1/embeddings/image/batch` |
| `EmbeddingResponse` | tutte le response |
| `SyncRequest` / `SyncResponse` | `/v1/sync/postgres_to_qdrant` |

---

## Archiviazione opzionale in Qdrant

Ogni endpoint accetta `store_in_qdrant: bool` e `collection_name: str`. Quando abilitato:

1. Il servizio calcola il vettore
2. Upsert via `QdrantAgent` con `RAGPayload` (include `source`, `created_at`)
3. Il campo `stored_in_qdrant: true` nella response conferma il salvataggio
4. Failure di storage viene loggato come `WARNING` — la response rimane `success: true` con il vettore

La collezione target DEVE essere dichiarata nel registry governance (`contracts/rag.py`).

---

## Risoluzione problemi

| Sintomo | Causa probabile | Fix |
|---------|----------------|-----|
| `503` su `/v1/embeddings/image` | Modello vision non caricato | Verificare `GET /v1/stats`, riavviare container |
| Vettori a 384-dim nei log | Servizio sta usando MiniLM fallback | Verificare che `EMBEDDING_SERVICE_URL` sia impostato correttamente |
| `MISSING` nell'audit collezioni | Collezione non dichiarata in registry | Aggiungere a `contracts/rag.py`, rieseguire `init_qdrant_collections.py` |

---

## Riferimenti

| Risorsa | Path |
|---------|------|
| Service source | `services/api_embedding/` |
| Client LangGraph | `vitruvyan_core/core/orchestration/langgraph/node/_embedding.py` |
| Schemi Pydantic | `services/api_embedding/schemas.py` |
| Config | `services/api_embedding/config.py` |
| RAG Architecture | [RAG Overview](index.md) |
| Governance Contract | [RAG Governance Contract V1](../../contracts/rag/RAG_GOVERNANCE_CONTRACT_V1.md) |
