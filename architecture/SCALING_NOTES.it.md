# Vitruvyan — Note di scala (living document)

> **Cosa è questo documento.** Una raccolta evolutiva di osservazioni sulle proprietà di scalabilità del sistema Vitruvyan: cosa è strutturalmente sano, dove emergeranno i bottleneck quando arriverà la scala, quali decisioni architettoniche dovremo rivisitare a quel punto, e cosa è invece *fine-tuning operativo* gestibile senza redesign.
>
> **Cosa NON è.** Un piano di esecuzione. Non c'è ancora una scala che lo giustifichi. Questo documento è la *memoria di ciò che sappiamo oggi* per quando arriverà il momento di affrontare problemi che oggi non abbiamo.
>
> **Convenzione.** Ogni sezione è datata. Nuove osservazioni si aggiungono in coda, non in sostituzione. Quando una decisione viene presa, va annotato. Quando una previsione si avvera (o si smentisce), va annotato.

---

## Baseline al 2026-05-27

Per dare contesto alle considerazioni che seguono, lo stato "di partenza" misurato oggi:

- **Trace persistiti in causal-replay**: 1428 (dati reali, multi-mese di operatività)
- **Chunks indicizzati in Qdrant** (`aicomsec.999.chunks`): ~10k+ stimato (corpus security multi-standard)
- **Sacred Orders attivi**: 6 + container ausiliari (orthodoxy, vault, pattern weavers, babel, memory orders, codex hunters, ontology observations)
- **Latenza tipica per query RAG**: 40-100s (dominata da chiamate LLM)
- **Concorrenza testata**: 1 worker, ~ 1 query alla volta nei benchmark
- **Tenant in produzione**: 1 (`999`)

Tutti i numeri sotto cui le considerazioni che seguono sono *previsioni*, non *misure*.

---

## Tesi positiva: l'architettura è scaling-friendly per costruzione

Aggiornata 2026-05-27.

L'architettura di Vitruvyan è stata progettata event-driven e modulare. Questo non è un caso fortunato — è una scelta deliberata derivata dalla tesi del Synaptic Conclave (rete miceliale/polipo, distributed cognition, no central failure point). Le proprietà che ne derivano e che favoriscono la scala:

### Substrato di trasmissione

- **Redis Streams** supporta milioni di eventi/sec su commodity hardware
- **Consumer groups** permettono scaling orizzontale dei worker per canale senza riconfigurazione architetturale
- **Persistenza native + replay** dà robustezza intrinseca contro consumer failure

### Memoria semantica e relazionale

- **PostgreSQL** regge bilioni di righe con buone strategie di indicizzazione + partitioning
- **Qdrant** è progettato per multi-billion vector con sharding nativo
- **Collection-per-tenant** in Qdrant + tenant_id propagato a ogni livello → isolamento naturale

### Coordinamento

- **Stateless workers** per la maggior parte dei nodi LangGraph → scalano orizzontalmente "gratis"
- **Async event-driven** ovunque possibile → no synchronous bottleneck strutturale
- **Tenant isolation** + TLP gating via Vault Keepers → scaling lineare con N tenant (non quadratico)

### Conseguenza operativa

I "dial" che servirà girare a scala sono *parametri operativi*, non *redesign architetturali*:
- Worker count per consumer group
- Connection pool sizes (PG, Qdrant, Redis)
- Redis Streams trimming policies (MAXLEN, MINID)
- Qdrant collection sharding factor
- LLM rate limit budgeting (tiering API)
- Cache layer aggiunta (se necessario)

Questo è un payoff diretto della disciplina del bus + dei Sacred Orders. Architetture lineari (pipeline) avrebbero richiesto redesign per scalare. Una rete distribuita scala "estendendo i tentacoli", non riprogettandosi.

---

## Frizione 1: il bottleneck vero è esterno

Aggiornata 2026-05-27.

L'osservazione più importante per quando ci troveremo a scalare: **il limite non sarà l'architettura interna, ma il LLM esterno**.

### Bottleneck primari attesi (in ordine di emergere)

| # | Bottleneck | Causa | Mitigation |
|---|---|---|---|
| 1 | **LLM rate limits API** | Ogni trace fa N chiamate LLM (1-10s). Tier-5 OpenAI = 10k RPM | Multi-tier API budgeting, fallback su modelli più piccoli sotto pressione, batch processing dove possibile |
| 2 | **LLM token cost** | Token bill cresce lineare con trace volume | Caching aggressivo di risposte semanticamente simili, prompt size optimization, modelli economici per task semplici |
| 3 | **LLM latency tail (p99)** | LLM API latency non è predicibile | Hedging request, parallelism dove safe, timeout aggressivi con fallback path |
| 4 | **Embedding service throughput** | Ingestion + query embedding hanno rate limits separati | Local embedding model per query frequenti, batching per ingestion |

### Implicazione strategica

Quando un CTO chiede *"scala a 10k utenti?"*, la risposta tecnica difensibile è:

> *"L'architettura non è limitante; i limiti operativi a scala saranno rate limits LLM e costo token, che sono gestiti via tiering API + caching + fallback su modelli economici per task validabili. Stiamo costruendo un benchmark per misurare la curva costo/throughput sotto carico realistico."*

Identifica con precisione *dove finisce l'autonomia del sistema*. Più forte di "abbiamo architettura modulare" che è opinione.

---

## Frizione 2: decisioni interne ancora non stressate

Aggiornata 2026-05-27.

L'architettura è sana, ma certe scelte vivono in zona "*ok ai volumi attuali, da rivedere a scala*". Documentare ora previene di dire un giorno "non lo sapevamo".

### Tabella di decisioni a revisione futura

| Decisione | Status oggi | Trigger atteso per revisione | Azione prevista (non urgente) |
|---|---|---|---|
| `bus_events` cresce monotonicamente | 1428 trace, no policy | A ~10M trace → 1-10 GB | TTL + archive tier (cold storage) |
| `traces_summary` denormalizzato | Performante a volume corrente | A ~10M trace → query lente | Partitioning per tenant + tempo, eventualmente columnar |
| Causal-replay search via `pg_trgm` | Veloce sui dati attuali | Full-text su corpus massiv → degradazione | OpenSearch / Elastic / pgvector full-text |
| Multi-tenant su singolo Redis | Funziona | A N>50 tenant → noisy neighbor | Redis cluster con shard per tenant range |
| Synchronous `/run/stream` blocked per LLM | Acceptable | A throughput sostenuto → connection pool exhaustion | Async job queue + polling/webhook pattern |
| Qdrant single-collection per tenant | Funziona | A multi-tenant con corpora grandi → memory pressure | Tier-2 storage Qdrant (cloud) o filtered collection condivisa |
| Causal-replay anomaly rules heuristic | OK al volume corrente | Anomaly rate cresce → noise | Pattern observer applicato (vedi vitruvyan-core#30) |
| Plasticity framework dormant | Esiste, non wired | Quando serve adaptive behavior | Activate per consumer specifici prima di Cortex Atlas |
| `weave_embeddings` collection vuota | Drift consapevole (v2 deprecated) | Quando v2 path completamente rimosso | Decommission collection |

### Come usare questa tabella

Quando il sistema raggiunge una soglia, **NON si fa redesign**. Si consulta questa tabella, si identifica l'azione prevista, si esegue.

Quando si scopre un nuovo trigger inatteso, si AGGIORNA questa tabella prima di intervenire — così la prossima persona che ci passa sa cosa è stato deciso e perché.

---

## Frizione 3: la convinzione va concretizzata

Aggiornata 2026-05-27.

*"Sono piuttosto convinto che il sistema possa reggere"* è onesto ma è ancora **hypothesis**, non knowledge. Lo stress test (`vitruvyan-core#TBD`) trasforma:

| Stato narrativo | Tipologia | Vendibilità in pitch |
|---|---|---|
| *"L'architettura scala"* | Opinione fondata | Bassa |
| *"Abbiamo misurato N traces concorrenti × M tenant × K minuti, zero loss, p99 stabile a Y ms — qui i grafici"* | Dato | Alta |

Differenza è enorme in contesti istituzionali (Difesa, finance compliance, healthcare). Il pattern *"stiamo costruendo perché abbiamo misurato"* è molto più forte di *"crediamo che funzioni"*.

### Stress test plan (riferimento)

Vedi issue vitruvyan-core#TBD (Stress test del Synaptic Conclave). Profili previsti:

- **Light** (5-10 min, ~10 trace): validate il tooling
- **Medium** (~10-15 min, ~100 trace concorrenti): verifica parallelismo
- **Heavy** (~30 min, ~1000 trace): trova dove inizia la degradazione

Metriche da raccogliere:
- Throughput sostenuto (trace/min)
- Latency p50/p95/p99
- Zero loss verification
- Anomaly rate stabilità
- Verdict quality stabilità
- Consumer lag bounded

---

## Cosa Cortex Atlas + Cognitive Modulators aggiungono al discorso scala

Aggiornata 2026-05-27.

Cortex Atlas (vitruvyan-core#19) introduce due novità rilevanti per scaling:

### 1. Storage growth pattern diverso

Cortex Atlas `cortex_atlas_edges` cresce con il **traffico interessante**, non col corpus. Per Hebbian decay, gli archi raramente attivati muoiono → dimensione stabile asintoticamente, non monotona. *Implicazione*: a differenza di `bus_events` che cresce sempre, Cortex Atlas trova un punto di equilibrio.

### 2. Cognitive Modulators come self-throttling

I Cognitive Modulators (M4) sono PER DESIGN signal di stress sistemico:
- `attention_noise` alto → +stringenza retrieval → -carico downstream
- `epistemic_confidence` basso → +qualifications, -aggressività decisionale
- `domain_drift` alto → fallback path conservativo

*Implicazione*: il sistema si **auto-modula sotto stress**. Non scala solo perché l'architettura lo permette, scala perché *riconosce di essere sotto stress e modifica comportamento*. È scaling adattivo, non statico.

### Caveat

Tutto questo è ancora hypothesis (Cortex Atlas non esiste). Va validato sul campo. Ma se la tesi regge, **Vitruvyan diventa un sistema che scala più graziosamente di quanto faccia l'architettura statica**.

---

## Connessione al business plan Phase H

Aggiornata 2026-05-27.

La scalabilità ha implicazioni dirette sul business model:

### Cosa va nel core OSS
Le primitives architetturali che rendono scaling possibile:
- Synaptic Conclave (bus + persistenza)
- Causal-replay
- Per-tenant isolation
- Modulator pattern (proto via Causal Observer, full via Cortex Atlas G.5)

Questi sono *generally useful*, vanno nel free tier.

### Cosa va nel paid enterprise plugin
Le componenti operative che servono a scala enterprise:
- **Multi-region deployment** + replicazione cross-region
- **WORM retention** (5-7 anni MiFID/regulatory)
- **Tamper-evidence** (signing dei record causal-replay)
- **Hardware Security Module** integration
- **SLA monitoring** + alerting enterprise (PagerDuty, Opsgenie)
- **Compliance reporting export** (RTS 22, audit packs)

Questi sono *enterprise-scale specific*, valgono pricing premium.

### Conseguenza

La tabella di "decisioni interne da rivisitare a scala" sopra è anche **la roadmap di cosa diventerà capacity del paid tier**. Quando trigger condition si avvera, l'azione "tier-2 storage Qdrant", "archive tier per bus_events", "WORM retention" — non viene fatta nel core, ma diventa enterprise plugin.

---

## Cosa NON è in questo documento

Per evitare scope creep:

- Non è un piano di hiring o di team scaling (umani)
- Non è un'analisi di sicurezza (esistono altri doc)
- Non è una roadmap di feature (esistono gli issue)
- Non è certificazione formale (lo sarà solo dopo stress test reali)

---

## Change log

| Data | Sezione | Modifica |
|---|---|---|
| 2026-05-27 | Documento creato | Inizializzato da conversazione Davide ↔ Claude su scalabilità architetturale e fine-tuning vs redesign |

---

*Documento mantenuto come living reference. Le aggiunte si fanno in coda con data. Le revisioni si annotano qui sopra. Riferimento per: chiunque dovrà affrontare problemi di scala in futuro, decisioni di business plan Phase H, pitch a clienti enterprise.*

*Riferimenti chat:*
- *[2026-05-27 — Cortex Atlas, Cognitive Modulators e intelligenza tecnica](../chat/2026-05-27_cortex_atlas_cognitive_modulators_e_intelligenza_tecnica.md)*
- *[2026-05-26 — Synaptic Conclave e Cortex Atlas](../chat/2026-05-26_synaptic_conclave_e_cortex_atlas.md)*
- *[claude_su_vitruvyan](../chat/claude_su_vitruvyan.md)*
