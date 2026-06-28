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
  filtro Qdrant *esatto* su `tenant`, `language`, `intent`, **insieme di entità**
  e `prompt_type`. Il match semantico varia **solo la formulazione**: una
  parafrasi su un'**entità diversa** (o altro tenant/lingua) **non potrà mai**
  restituire la risposta di un'altra entità.
- **Allow-list dei prompt type**: attiva solo per tipi **non vincolanti /
  esplicativi** (es. `general`, `explanation`, `detailed_analysis`); mai per
  risposte che dipendono da output deterministici puntuali.
- **Promozione**: un hit L2 viene promosso in L1 (i riusi successivi sono esatti).
- **Store**: dopo una chiamata LLM fresca, la risposta viene indicizzata in L2
  (con il binding context come payload) per i prossimi near-paraphrase.
- **Degradazione**: embedding o Qdrant non disponibili → miss → LLM fresco.

### Postura di sicurezza

- **OFF di default** (`LLM_SEMANTIC_CACHE_ENABLED=false`): si abilita
  esplicitamente per-deploy.
- **Soglia alta** (cosine `0.95`): solo parafrasi davvero vicine.
- Il binding context come **hard-filter** garantisce isolamento tenant/entità:
  la similarità non attraversa mai i confini di contesto.

### Configurazione L2

| Variabile | Default | Significato |
|---|---|---|
| `LLM_SEMANTIC_CACHE_ENABLED` | `false` | abilita la cache semantica |
| `LLM_SEMANTIC_CACHE_THRESHOLD` | `0.95` | soglia cosine minima per un hit |
| `LLM_SEMANTIC_CACHE_PROMPT_TYPES` | `general,explanation,detailed_analysis` | prompt type ammessi |

- **Collezione Qdrant**: `llm_semantic_cache`, **768-dim**, distanza **Cosine**.
  Dichiarata in `contracts.rag` come collezione CORE; **auto-creata** al primo
  utilizzo (`ensure_collection`), nessuna migrazione manuale.
- **Embedding**: `nomic-embed-text-v1.5` via `api_embedding` (`EMBEDDING_API_URL`).

---

## Orchestrazione (`cached_llm_node`)

1. Calcola la chiave e tenta **L1** (lookup esatto).
2. Su miss L1, se la L2 è attiva *e* il `prompt_type` è in allow-list → tenta **L2**.
3. Su miss totale → chiama l'**LLM**; poi **store** in L1 (sempre) e in L2 (se attiva).
4. Un hit L2 viene **promosso** in L1.

Ogni fallimento infrastrutturale lungo questa catena → **miss** + chiamata LLM
fresca: la chat non si blocca mai per colpa della cache.

---

## Operatività

- **Abilitare la L2**: impostare `LLM_SEMANTIC_CACHE_ENABLED=true` sul servizio
  che esegue il grafo (`cached_llm_node`) e ricreare il container. La collezione
  Qdrant si crea da sola al primo uso.
- **Invalidare per entità**: alla modifica dei dati di un'entità, invalidare le
  voci L1 collegate via reverse index (le risposte stantie spariscono subito).
- **Svuotare la cache**: rimuovere le chiavi Redis con il prefisso della cache
  (cold start innocuo: si ripopola alla prima richiesta).
- **Modifiche al modulo cache (core)**: i servizi **non montano** `core/` → una
  modifica a `cache_manager.py`/`semantic_cache.py` richiede **rebuild** del
  servizio (non un semplice restart).

> Cronologia: la riscrittura della L1 (statistiche/invalidation corrette,
> degradazione Redis) e l'introduzione della L2 semantica sono arrivate nelle
> release Core **1.31.2** (L1) e **1.32.0** (L2).
