# Cache delle risposte LLM (L1 esatta + L2 semantica)

Vitruvyan mette in cache le risposte del modello su **due livelli** per ridurre
latenza e costo senza mai compromettere la correttezza per-contesto. La cache è
**trasparente** (API pubblica invariata per i chiamanti) e **degrada in modo
graceful**: se l'infrastruttura (Redis, Qdrant, embedding) non è disponibile,
ogni operazione diventa un *miss* e il sistema chiama l'LLM come se la cache non
esistesse.

```
richiesta ──▶ L1 (cache esatta, Redis) ──hit──▶ risposta
                 │ miss
                 ▼
              L2 (cache semantica, Qdrant) ──hit──▶ risposta (+ promozione in L1)
                 │ miss
                 ▼
              LLM fresco ──▶ risposta (+ store in L1, e in L2 se abilitata)
```

Sorgenti:
- `core/llm/cache_manager.py` — L1 (esatta).
- `core/llm/semantic_cache.py` — L2 (semantica).
- `core/orchestration/langgraph/node/cached_llm_node.py` — orchestrazione dei due livelli.

---

## L1 — cache esatta (Redis)

Riuso di una risposta **identica** quando la richiesta è identica nei campi che
*cambiano la risposta*.

- **Chiave** = SHA-256 di: `input_text`, `intent`, `entity_ids` (ordinati),
  `language` (`language_detected` → `language` → default), `prompt_type`.
  Due richieste con stessa chiave condividono la risposta; qualunque differenza
  in questi campi produce una chiave diversa.
- **Store**: Redis con TTL (`LLM_CACHE_TTL_HOURS`, default 24h).
- **Invalidazione per entità**: ogni voce è indicizzata in un *reverse index*
  per `entity_id`; quando i dati di un'entità cambiano, si invalidano in O(1) le
  sole risposte che la citano (niente scan/substring-match).
- **Statistiche**: hit/miss/token risparmiati corretti (contatori giornalieri).
- **Degradazione**: Redis irraggiungibile → no-op (miss), nessun errore propagato.

### Configurazione L1

| Variabile | Default | Significato |
|---|---|---|
| `LLM_CACHE_ENABLED` | `true` | abilita la cache esatta |
| `LLM_CACHE_TTL_HOURS` | `24` | durata di una voce |
| `LLM_CACHE_MAX_SIZE` | `10000` | tetto voci |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | backing store |

---

## L2 — cache semantica (Qdrant)

Sta **dietro** la L1: scatta solo su *miss* della L1. Riusa la risposta di una
domanda **semanticamente simile** (parafrasi), **ma solo entro un contesto di
binding identico**.

- **Come funziona**: su miss L1, si fa l'embedding del testo della richiesta
  (Nomic 768-dim via `api_embedding`) e si cerca in Qdrant la risposta passata
  più simile **sopra soglia** (cosine).
- **Hard-filter di binding (sicurezza)**: la ricerca semantica è vincolata da un
  filtro Qdrant *esatto* su `tenant`, `language`, `intent`, **insieme di entità**,
  `prompt_type` e — sul path RAG — **set di evidenze** (vedi sotto). Il match
  semantico varia **solo la formulazione**: una parafrasi su un'**entità diversa**
  (o altro tenant/lingua/evidenza) **non potrà mai** restituire la risposta di un
  altro contesto.
- **Allow-list dei prompt type**: attiva solo per tipi **non vincolanti /
  esplicativi** (es. `general`, `explanation`, `detailed_analysis`); mai per
  risposte che dipendono da output deterministici puntuali.
- **Promozione**: un hit L2 viene promosso in L1 (i riusi successivi sono esatti).
- **Store**: dopo una chiamata LLM fresca, la risposta viene indicizzata in L2
  (con il binding context come payload) per i prossimi near-paraphrase.
- **Degradazione**: embedding o Qdrant non disponibili → miss → LLM fresco.

### L2 sul path RAG — **evidence-binding** (sicurezza)

Le risposte RAG dipendono dalle **evidenze recuperate**, non solo dal testo della
domanda. Cachare per sola similarità del testo rischierebbe di servire una
risposta **stantia** rispetto al corpus attuale — inaccettabile in sicurezza.

`security_rag_synthesis` avvolge la **sola sintesi LLM** (la chiamata costosa
large-context) con lookup/store L2, aggiungendo al binding un **`evidence_key`** =
hash dei `chunk_id` recuperati. Una risposta RAG cachata viene riusata **solo
quando una domanda simile recupera la stessa evidenza**: se il corpus cambia
(chunk diversi) l'`evidence_key` cambia → **miss → sintesi fresca**. Non si serve
**mai** una risposta fondata su evidenza superata. Il post-processing
deterministico (igiene citazioni, blocco IoC, TLP, chip spaziali) resta sempre
ricalcolato. Il path soft/conversazionale è invariato (`evidence_key='none'`).

A protezione ulteriore: **invalidate-on-ingest** (`invalidate_tenant`) — quando il
corpus di un tenant cambia, l'`evidence_indexer` purga le voci L2 di quel tenant
(le voci a evidenza ormai irraggiungibile spariscono subito, senza attendere il
TTL).

### Eviction / TTL (crescita limitata)

Qdrant non ha un TTL nativo. Ogni punto porta `created_at_epoch`; lo sweep
`prune_expired()` (range-delete oltre `LLM_SEMANTIC_CACHE_TTL_DAYS`) viene eseguito
opportunisticamente sullo store. **Default off** per non cambiare il comportamento.

### Postura di sicurezza

- **OFF di default** (`LLM_SEMANTIC_CACHE_ENABLED=false`): si abilita
  esplicitamente per-deploy.
- **Soglia alta** (cosine `0.95`): solo parafrasi davvero vicine.
- Il binding context come **hard-filter** garantisce isolamento tenant/entità/
  evidenza: la similarità non attraversa mai i confini di contesto.

### Configurazione L2

| Variabile | Default | Significato |
|---|---|---|
| `LLM_SEMANTIC_CACHE_ENABLED` | `false` | abilita la cache semantica |
| `LLM_SEMANTIC_CACHE_THRESHOLD` | `0.95` | soglia cosine minima per un hit |
| `LLM_SEMANTIC_CACHE_PROMPT_TYPES` | `general,explanation,detailed_analysis` | prompt type ammessi |
| `LLM_SEMANTIC_CACHE_TTL_DAYS` | `0` (off) | orizzonte di eviction (giorni) per lo sweep |
| `LLM_SEMANTIC_CACHE_INVALIDATE_ENABLED` | `false` | purga la cache del tenant all'ingest del corpus |

- `evidence_key` (RAG) è **automatico** (dai chunk recuperati): nessuna config.
- **Collezione Qdrant**: `llm_semantic_cache`, **768-dim**, distanza **Cosine**.
  Dichiarata in `contracts.rag` come collezione CORE; **auto-creata** al primo
  utilizzo (`ensure_collection`), nessuna migrazione manuale.
- **Embedding**: `nomic-embed-text-v1.5` via `api_embedding` (`EMBEDDING_API_URL`).

---

## Orchestrazione (due path)

La L2 vive in **due punti** del grafo:

- **Path soft/conversazionale** — `cached_llm_node` (route `llm_soft`, intent
  conversazionali): L1 esatto → su miss L2 (se attiva + allow-list) → su miss LLM
  → store L1 (sempre) + L2 (se attiva); un hit L2 è **promosso** in L1.
- **Path RAG** — `security_rag_synthesis`: dopo il retrieval, calcola
  l'`evidence_key` dai chunk recuperati, fa lookup L2 **evidence-bound** attorno
  alla sintesi; su miss esegue la sintesi e la memorizza. È qui che vivono i
  risparmi di token (chiamate large-context).

Ogni fallimento infrastrutturale lungo la catena → **miss** + chiamata LLM
fresca: la chat non si blocca mai per colpa della cache.

---

## Operatività

- **Abilitare la L2**: `LLM_SEMANTIC_CACHE_ENABLED=true` sul servizio che esegue
  il grafo e ricreare il container. La collezione Qdrant si crea da sola al primo uso.
- **Limitare la crescita L2 (TTL)**: `LLM_SEMANTIC_CACHE_TTL_DAYS=<giorni>` →
  sweep automatico sullo store.
- **Invalidate-on-ingest L2**: `LLM_SEMANTIC_CACHE_INVALIDATE_ENABLED=true`
  sull'`evidence_indexer` → al cambio corpus di un tenant ne purga la cache L2.
- **Invalidare per entità (L1)**: alla modifica dei dati di un'entità, le voci L1
  collegate spariscono via reverse index.
- **Svuotare la cache L1**: rimuovere le chiavi Redis col prefisso della cache
  (cold start innocuo: si ripopola alla prima richiesta).
- **Modifiche al modulo cache (core)**: i servizi **non montano** `core/` → una
  modifica a `cache_manager.py`/`semantic_cache.py` richiede **rebuild** del
  servizio (non un semplice restart).

> Cronologia (release Core): **1.31.2** riscrittura L1 (statistiche/invalidation
> corrette, degradazione Redis) · **1.32.0** L2 semantica · **1.32.1** fix lettura
> cross-schema (`from_dict`) · **1.33.0** L2 sul path RAG **evidence-bound** + TTL
> prune · **1.34.0** invalidate-on-ingest.
