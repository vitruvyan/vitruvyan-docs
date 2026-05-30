---
tags:
  - architecture
  - neural
  - cortex-atlas
  - synaptic-conclave
  - sacred-orders
---

# 🧠 Vitruvyan Neural Architecture

**A three-layer neural model for distributed cognitive systems**

> *Cortex Atlas does not model the world. It models the system's experience of the world.*

**Stato del documento**: riferimento architetturale (vivente)
**Versione di riferimento**: vitruvyan-core v1.29.0 (30 maggio 2026)
**Predecessore**: [Synaptic Conclave — Visione filosofica e architetturale](./synaptic-conclave-philosophy) (22 maggio 2026)

---

## Abstract

Vitruvyan è un framework cognitivo per sistemi software che persegue **intelligenza distribuita coordinata** invece di intelligenza monolitica concentrata. La sua architettura è organizzata in tre strati neurali — sinaptico, corticale, neuro-endocrino — modellati a partire da principi documentati nelle neuroscienze e nei sistemi biologici distribuiti (Hebb, 1949; Godfrey-Smith, 2016; Hutchins, 1995). Il primo strato (Synaptic Conclave) è operativo e fornisce trasporto di eventi semanticamente ricchi attraverso un bus asincrono. Il secondo strato (**Cortex Atlas**, introdotto in v1.29.0 come scaffold dormante) implementa il consolidamento mnesico: trasforma la co-attivazione ripetuta osservata sul bus in struttura associativa permanente attraverso un meccanismo hebbiano. Il terzo strato (neuro-endocrino) è progettato ma non implementato. Questo documento articola i fondamenti scientifici, la motivazione architetturale, il design dello strato corticale, il razionale per cui esso non coincide con una Knowledge Graph o un GraphRAG, e i criteri disciplinari che governano la sua attivazione.

---

## 1. Motivazione

### 1.1 Il problema architetturale

I sistemi AI contemporanei si polarizzano lungo due assi:

- **Monolitici**: un singolo modello (LLM) accentra capacità di linguaggio, ragionamento, memoria e decisione. La cognizione è prodotta da scala (parametri, compute, dati di addestramento).
- **Idraulici**: pipeline lineari (retrieve → rank → synthesize → respond) in cui i dati scorrono dalla sorgente alla risposta. La cognizione è prodotta da concatenazione di stadi specializzati.

Entrambi i paradigmi presentano limiti strutturali quando il sistema deve essere **auditabile, governato, evolvibile e responsabile** delle proprie decisioni:

| Limite | Modello monolitico | Pipeline idraulica |
|---|---|---|
| Auditabilità | Scatola nera per costruzione | Stati intermedi effimeri |
| Memoria di sé | Inesistente | Inesistente |
| Estensibilità | Re-training | Modifica della pipeline |
| Governance | Impossibile dall'interno | Impossibile dall'interno |
| Costo cognitivo | Cresce con la scala | Cresce con la profondità |

### 1.2 Il paradigma alternativo

La biologia offre un terzo paradigma. Il cervello dei vertebrati, i sistemi nervosi distribuiti del polpo (Godfrey-Smith, 2016), le reti miceliali (Simard, 2018) e i sistemi sociali umani in attività coordinata (Hutchins, 1995) condividono una struttura: **molte unità locali autonome che comunicano attraverso un mezzo condiviso, producendo cognizione globale come proprietà emergente della coordinazione**.

Vitruvyan è la traduzione computazionale di questo paradigma. Non è un modello cognitivo né una pipeline cognitiva: è un **mezzo cognitivo** — un bus su cui agenti specializzati (Sacred Orders) emettono e consumano eventi, e attraverso cui la cognizione globale emerge dalla loro coordinazione.

---

## 2. Fondamenti scientifici

L'architettura neurale di Vitruvyan poggia su principi documentati in letteratura. Ciascun principio è tradotto in un meccanismo software specifico.

### 2.1 Hebbian learning (Hebb, 1949)

> *"Cells that fire together, wire together."*

Quando due neuroni si attivano in correlazione temporale, la sinapsi che li connette si rafforza. La struttura associativa del cervello non è programmata: emerge dall'osservazione ripetuta di co-attivazioni.

**Traduzione in Vitruvyan**: lo strato corticale (Cortex Atlas) registra co-attivazioni fra entità canoniche osservate nello stesso `trace_id`, persiste l'osservazione come "edge" con un contatore di occorrenze (tonus sinaptico), e applica decadimento temporale per pruning automatico.

### 2.2 Cell assemblies (Hebb, 1949; Buzsáki, 2010)

Gruppi di neuroni che si co-attivano formano "assembly" — strutture di alto livello che rappresentano concetti, episodi, schemi motori. L'assembly non è un singolo neurone: è un pattern emergente di correlazione.

**Traduzione**: il meccanismo di consolidamento (M3) di Cortex Atlas promuove cluster di edge stabili in `Assembly` — strutture composite identificate da coesione + persistenza temporale, non da clustering grafico puro.

### 2.3 Distributed cognition (Hutchins, 1995)

La cognizione non risiede in un singolo agente ma è distribuita su agenti multipli, artefatti e canali di comunicazione. La nave navigata da Hutchins (1995, *Cognition in the Wild*) non è guidata da un capitano cognitivamente isolato: è il sistema "equipaggio + strumenti + protocolli" a navigare.

**Traduzione**: i Sacred Orders (Pattern Weavers, Babel Gardens, Vault Keepers, Codex Hunters, Orthodoxy Wardens, Memory Orders) sono agenti specializzati che condividono il bus come ambiente cognitivo. Nessun Sacred Order è "il cervello"; la cognizione globale emerge dalla loro coordinazione asincrona.

### 2.4 Octopus cognition (Godfrey-Smith, 2016)

Il polpo possiede ~500 milioni di neuroni, di cui due terzi distribuiti nelle braccia. Ogni braccio risolve problemi locali senza intervento del cervello centrale. La cognizione è radicalmente distribuita ma globalmente coordinata.

**Traduzione**: ogni Sacred Order ha autonomia decisionale locale (e.g., Pattern Weavers decide le canonicalizzazioni senza chiedere permesso a un orchestratore centrale). La coordinazione globale emerge dagli eventi che ciascuno emette sul bus.

### 2.5 Synaptic plasticity (Bliss & Lømo, 1973; Citri & Malenka, 2008)

I parametri di una sinapsi (efficacia, soglia, persistenza) non sono fissi: si adattano in risposta all'attività. Long-term potentiation e long-term depression sono i meccanismi fondamentali dell'apprendimento.

**Traduzione**: il framework `PlasticityManager` (core/synaptic_conclave/plasticity/) tracca parametri scalari di consumer (e.g., decay rate, consolidation threshold) come `ParameterTrajectory` — sequenze temporali soggette a rilevamento di anomalia (oscillazione, drift, stagnazione, instabilità, divergenza). Cortex Atlas M2/M4 leggono e propongono modifiche a questi parametri via Plasticity, non implementano una propria modulazione.

### 2.6 Memory consolidation (Squire, 1992; Diekelmann & Born, 2010)

La memoria episodica viene consolidata dall'ippocampo alla neocorteccia attraverso processi di replay durante il sonno. La memoria di lavoro (eventi) si trasforma in memoria di lungo termine (struttura) attraverso un meccanismo dedicato e temporalmente separato.

**Traduzione**: M3 (Consolidator) di Cortex Atlas opera come processo notturno (batch periodico) che ispeziona gli edge stabili e li promuove in Assembly. La consolidazione avviene su scala temporale diversa dall'osservazione (M1), riflettendo la separazione biologica fra acquisizione e consolidamento.

### 2.7 Neuromodulation (Marder, 2012; Avery & Krichmar, 2017)

I sistemi neuromodulatori (dopamina, acetilcolina, noradrenalina, serotonina) non trasmettono informazione punto-a-punto: modulano stati globali del sistema — vigilanza, esplorazione vs sfruttamento, ritmi circadiani. Operano su scale temporali più lunghe e in modalità non-numeriche.

**Traduzione**: il terzo strato (neuro-endocrino) è progettato per i context modulator multi-stato (e.g., "phase di esplorazione" vs "phase di consolidamento"). È esplicitamente parcheggiato — la sua implementazione richiede estensione di `PlasticityObserver` oltre il modello scalare e non è opportuna prima che gli strati inferiori siano stabili.

---

## 3. L'architettura neurale a tre strati

Vitruvyan replica la stratificazione biologica con tre strati architetturali, ciascuno con un substrato fisico, una funzione cognitiva, una scala temporale e una maturità di sviluppo.

| Strato | Funzione cognitiva | Substrato | Scala temporale | Stato in v1.29.0 |
|---|---|---|---|---|
| **Sinaptico** (Synaptic Conclave) | Trasmissione di eventi semanticamente ricchi | Redis Streams + tabella `bus_events` | millisecondi-secondi | Produzione |
| **Corticale** (Cortex Atlas) | Consolidamento mnesico, formazione di struttura associativa | PostgreSQL (`cortex_atlas_edges`, `cortex_atlas_assemblies`) | ore-giorni | Scaffold dormant |
| **Neuro-endocrino** | Modulazione comportamentale, stati sistemici discreti | Multi-state context modulators | giorni-settimane | Progettato (G.4+) |

La gradazione temporale dei tre strati è un vincolo architetturale, non una contingenza implementativa. Tentare di accendere lo strato corticale prima che il substrato sinaptico produca segnale sufficiente — o lo strato neuro-endocrino prima che la corteccia sia stabile — riproduce il fallimento osservato in modelli artificiali che saltano stadi di maturazione: il sistema produce output sintatticamente plausibili ma semanticamente vuoti.

---

## 4. Strato sinaptico — il bus come differenziatore

Il dettaglio filosofico e operativo dello strato sinaptico è trattato nel [documento predecessore](./synaptic-conclave-philosophy). In sintesi:

- Il bus (Redis Streams + `bus_events`) è il **mezzo cognitivo** del sistema, non un canale di logging.
- Ogni Sacred Order emette eventi semanticamente ricchi (`ontology.entity.resolved`, `babel.signals.extracted`, `orthodoxy.verdict.issued`, ecc.).
- L'auditabilità è proprietà emergente: ogni decisione del sistema è ricostruibile dalla concatenazione di eventi che l'ha prodotta.
- La regola operativa fondamentale: **ogni evento nuovo deve avere un consumer designato**. Senza consumer è logging travestito.

Lo strato sinaptico è condizione necessaria ma non sufficiente. Il bus accumula eventi; serve un meccanismo che li trasformi in **struttura**. Questo è il ruolo dello strato corticale.

---

## 5. Strato corticale — Cortex Atlas

Cortex Atlas è introdotto in vitruvyan-core v1.29.0 come scaffold dormante (vedi [`core/cognitive/cortex_atlas/`](https://github.com/vitruvyan/vitruvyan-core/tree/main/vitruvyan_core/core/cognitive/cortex_atlas)). Implementa il consolidamento mnesico attraverso quattro meccaniche (M1-M4) governate da un gate di attivazione (M0).

### 5.1 Le cinque meccaniche

| Mech | Nome | Responsabilità | Owner di policy | Validazione |
|---|---|---|---|---|
| **M0** | `AtlasActivationPolicy` | Gate disciplinare — protegge dall'attivazione prematura | Atlas | n/a |
| **M1** | `EdgeObserver` | Detect co-firing dentro un `trace_id`, UPSERT su `cortex_atlas_edges` | n/a (puramente statistica) | none |
| **M2** | `DecayManager` | Decay del tonus degli edge, pruning sotto floor | `PlasticityManager` | n/a |
| **M3** | `Consolidator` | Promuove edge stabili in `Assembly` candidate | n/a | `Orthodoxy Wardens` (verdict per candidate) |
| **M4** | `ModulatorEmitter` | Propone aggiustamenti scalari di policy | `PlasticityManager` (dispatch) | `OutcomeTracker` (retroattivo) |

### 5.2 Tre assi architetturali

Il design dello scaffold è governato da tre principi non negoziabili. Ogni modifica futura deve preservarli.

#### 5.2.1 Dormant by default

L'attivazione richiede due gate concorrenti:

- **Feature flag**: `CORTEX_ATLAS_ENABLED` (env var, default `false`)
- **Activation policy**: `AtlasActivationPolicy.is_ready_to_activate()` deve ritornare `ready=True`

Entrambi devono essere verdi. La policy verifica quattro sub-criteri (volume, recurrence, quality, phase_d). Se anche uno solo dei criteri non è soddisfatto, il sistema rifiuta di accendere e dichiara *perché* attraverso una `ActivationDecision` strutturata.

La motivazione di questa disciplina è documentata in letteratura: i sistemi associativi attivati prima della maturazione del substrato producono pattern spurii che non corrispondono a struttura semantica reale (overfitting su sample insufficiente). La policy di attivazione è equivalente al ruolo dei "critical periods" nella maturazione neurale (Hensch, 2005): finestre in cui il sistema è pronto a strutturarsi solo a fronte di stimolazione appropriata.

#### 5.2.2 Statistical, not semantic

Cortex Atlas **non propone canonical names**. L'autorità semantica appartiene a Pattern Weavers; Atlas conta esclusivamente le co-attivazioni fra canonical già esistenti.

> Pattern Weavers: *X è canonical.*
> Cortex Atlas: *X co-attiva con Y.*

Questa separazione è una proprietà architettonica, non un'opinione. Pattern Weavers e Cortex Atlas vivono in domini di autorità disgiunti — semantico vs statistico — e per costruzione non possono entrare in conflitto territoriale. Tradotto in termini biologici: Pattern Weavers è equivalente al ruolo dell'area di Wernicke (riconoscimento linguistico-semantico) e Cortex Atlas all'ippocampo (consolidamento associativo). Sono cooperanti, non sostituibili.

#### 5.2.3 Reuses Plasticity, Orthodoxy and Memory Orders

Cortex Atlas è **tessuto connettivo**, non un nuovo organo. La forma operativa di questo principio:

| Responsabilità | Owner | Modalità di delega |
|---|---|---|
| Decay rate / floor threshold (M2) | `PlasticityManager` | Letto come parametro tramite `PlasticityObserver` trajectory |
| Validazione di assembly promosse (M3) | `Orthodoxy Wardens` | M3 emette `AssemblyValidationRequest`, Orthodoxy ritorna verdict |
| Dispatch di modulators (M4) | `PlasticityManager` | M4 chiama `plasticity_manager.propose_adjustment()`, **non emette stream proprio** |
| Health metric dello strato corticale | `Memory Orders` (terzo analyzer) | Atlas espone tabelle, Memory Orders le legge |

Cortex Atlas G.1, attivandosi, diventa il **primo consumer reale** di `PlasticityManager` (oggi dormiente con 0 outcomes registrati). Il framework di plasticità viene validato attraverso uso, non attraverso dichiarazione.

---

## 6. Perché non una Knowledge Graph

L'introduzione di Cortex Atlas solleva legittimamente la domanda: *perché non utilizzare una Knowledge Graph esistente*?

La risposta è che Cortex Atlas e Knowledge Graph rispondono a domande diverse.

> Una **Knowledge Graph** modella *ciò che è in relazione* — la struttura del dominio.
> **Cortex Atlas** modella *ciò che si attiva ripetutamente insieme* — la struttura dell'esperienza del sistema.

| | Knowledge Graph | Cortex Atlas |
|---|---|---|
| Modella | il dominio | l'esperienza del sistema sul dominio |
| Sorgente di verità | tassonomia curata / ingestion | co-attivazione ripetuta sul bus |
| Aggiornato da | processo editoriale | osservazione hebbiana automatica |
| Possiede i canonical | sì | no (Pattern Weavers) |
| Modalità di fallimento dominante | diventa stale | diventa rumoroso |
| Costo di manutenzione | alto (editoriale continuo) | basso (autoregolato da decay) |

Esempio chiarificatore. Una KG di dominio security può affermare: *"CVE-2024-1234 è una vulnerabilità di tipo X che colpisce il sistema Y"*. Cortex Atlas, su un sistema che parla di sicurezza, può rilevare e affermare: *"ogni volta che il sistema parla di CVE-2024-1234, parla anche di ISO 27001 — sempre, in 87% dei trace"*. La KG dichiara una verità del dominio; Atlas dichiara una verità statistica del sistema. Sono fatti diversi, prodotti in modi diversi, utili per ragionamenti diversi.

I due meccanismi sono **complementari, non sostitutivi**. Un verticale può eseguire entrambi simultaneamente: la KG fornisce struttura semantica curata; Atlas fornisce evidenza statistica di uso effettivo. Quando divergono, la divergenza stessa è informazione (la KG cataloga concetti che il sistema non usa mai; il sistema usa associazioni che la KG non documenta).

---

## 7. Perché non GraphRAG

GraphRAG (Edge et al., 2024) estende il paradigma RAG sostituendo l'indice vettoriale con un grafo di conoscenza. Migliora il recall su query che richiedono ragionamento multi-hop ma resta un'architettura **interrogativa**: l'utente chiede, il grafo risponde.

| | GraphRAG | Vitruvyan + Cortex Atlas |
|---|---|---|
| Paradigma | interrogativo (query-driven) | coordinativo (event-driven) |
| Stato fra query | stateless (per design) | stateful (il bus persiste, la corteccia accumula) |
| Memoria di sé | none | propriocezione (eventi sul sistema stesso) |
| Auditabilità | tracing per singola query | proprietà emergente del bus |
| Evoluzione del grafo | manuale (editorial) | automatica (hebbian) |
| Costo per query | proporzionale alla profondità del traversal | indipendente dal traversal (la struttura è già consolidata) |

GraphRAG può essere componente di un Vitruvyan vertical (un Sacred Order che fa retrieval su KG), ma non sostituisce l'architettura: rimane stadio di una pipeline. Cortex Atlas non è un retriever migliore — è un meccanismo che *osserva ciò che i retriever fanno* e ne estrae struttura.

---

## 8. Perché non un LLM monolitico

I large language model monolitici sono ottimizzati per **una funzione**: predire il prossimo token. Attraverso la scala raggiungono capacità emergenti notevoli, ma presentano limiti strutturali per sistemi che devono essere governati:

| | LLM monolitico | Vitruvyan |
|---|---|---|
| Modalità di cognizione | unica (generative) | multipla (osservativa, generativa, valutativa, custodiale) |
| Auditabilità della singola decisione | impossibile (parametri continui) | ricostruibile dalla concatenazione di eventi |
| Estensione capacità | re-training | nuovo consumer sul bus |
| Costo di sviluppo nuovo dominio | dataset + training pipeline | nuovo Sacred Order |
| Governance del comportamento | system prompt (fragile) | Orthodoxy Wardens (audit attivo) |
| Memoria persistente | context window (effimera) | bus + corteccia (permanente) |
| Modalità di fallimento | hallucination (irrecuperabile) | drift di contratto (rilevabile via propriocezione) |

Vitruvyan **utilizza** LLM (via `LLMAgent` core) come strumento per task linguistici delegabili — extraction, classificazione, sintesi. Non li tratta come motore cognitivo. La distinzione è equivalente, in biologia, a non confondere "la corteccia visiva" con "il sistema cognitivo del soggetto": la corteccia visiva è componente specializzato, il sistema cognitivo è l'insieme coordinato.

---

## 9. Disciplina di attivazione

Lo scaffold v1.29.0 contiene `AtlasActivationPolicy` come stub: tutti i sub-gate ritornano `NotImplementedError` finché i criteri concreti non vengono implementati. La scelta è deliberata e disciplinare: i criteri saranno tarati empiricamente quando l'attivazione diventerà imminente, non da considerazioni a priori.

Ciò che è fissato nello scaffold è la **struttura** dei criteri:

| Gate | Cosa misura | Condizione di soddisfacimento |
|---|---|---|
| **Volume** | co-firing events per giorno | Ingestion + extraction a scala produttiva |
| **Recurrence** | average canonical recurrence | Substrato si muove sopra 1.00 (floor atomico osservato in v1.29.0) |
| **Quality** | gold standard extraction validato | [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) Phase D chiuso |
| **Phase D** | production hardening completo | [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) chiuso |

### 9.1 Snapshot del substrato al rilascio v1.29.0

| Sorgente | Stato misurato | Implicazione per l'attivazione |
|---|---|---|
| `ontology_observations` | 2430 obs, 386 canonical unici, avg recurrence **1.00** | Sotto qualunque soglia significativa — formazione hebbiana impossibile |
| `signal_observations` (migrazione 019) | 191 rows, 4 famiglie, avg recurrence 1.63 | Template strutturale che Atlas generalizza |
| `bus_events` | 22 474 graph events, 1 877 ontology resolutions | Substrato per co-firing detection esistente |
| `PlasticityManager` | 0 outcomes, 0 adjustments | Dormiente — Atlas G.1 ne diventa primo consumer |

Il KPI primario da tracciare quando l'attivazione comincerà è la **edge formation rate**, non la edge quality. La quale ultima è una proprietà che emerge solo se la prima è statisticamente significativa.

---

## 10. Roadmap

| Fase | Contenuto | Dipendenze | Stato |
|---|---|---|---|
| **G.0** | Scaffold completo: contratti, consumer dormant, activation gate, integration boundaries | — | **v1.29.0 — completato** |
| **G.1** | M1 wiring. Edge formation only. Primo consumer reale di `PlasticityManager` | Activation Gate aperto, aicomsec#32 chiuso | Pianificato |
| **G.2** | M2 + M3. Decay sweep + consolidation con verdict Orthodoxy. `associative_coherence_analyzer` live | G.1 stabile | Pianificato |
| **G.3** | M4 scalar modulators. Loop di feedback chiuso via `PlasticityManager` | G.2 stabile | Pianificato |
| **G.4** | Multi-state context modulators. Estensione di `PlasticityObserver` oltre le scalar trajectories | G.3 stabile, estensione observer | Visione |

La decisione operativa di topology di deployment (1, 2, o 4 container per-vertical) è parcheggiata su [vitruvyan-core#44](https://github.com/vitruvyan/vitruvyan-core/issues/44) e va risolta prima di G.1.

---

## 11. Mapping rispetto al predecessore

Il documento [Synaptic Conclave](./synaptic-conclave-philosophy) (22 maggio 2026) aveva articolato la tesi del bus come differenziatore architetturale e riconosciuto, al §3.3, l'assenza di un livello di consolidamento mnesico. Questo documento conserva la tesi e fornisce la forma operativa di quel livello.

| Aspetto | Predecessore | Questo documento |
|---|---|---|
| Bus | Differenziatore architetturale | Strato sinaptico del sistema neurale |
| Eventi semantici | Aspirazione (§4.1) | Substrato per co-firing detection (M1) |
| Memoria semantica | "Manca un livello di consolidamento" (§3.3) | Strato corticale — Cortex Atlas (M0-M4) |
| Propriocezione | Aspirazione (§4.2) | Strato neuro-endocrino futuro (G.4+) |
| Auditabilità | Proprietà emergente del bus | Resta proprietà del bus, integrata da verdict Orthodoxy per assembly |
| Rischio "discarica" (§3.1) | Riconosciuto | Affrontato dall'Activation Gate (M0) |

Il predecessore resta come documento di visione storica. Questo è il suo seguito operativo.

---

## Riferimenti scientifici

- Avery, M. C., & Krichmar, J. L. (2017). *Neuromodulatory systems and their interactions: A review of models, theories, and experiments*. Frontiers in Neural Circuits.
- Bliss, T. V. P., & Lømo, T. (1973). *Long-lasting potentiation of synaptic transmission in the dentate area of the anaesthetized rabbit following stimulation of the perforant path*. Journal of Physiology.
- Buzsáki, G. (2010). *Neural syntax: cell assemblies, synapsembles, and readers*. Neuron.
- Citri, A., & Malenka, R. C. (2008). *Synaptic plasticity: Multiple forms, functions, and mechanisms*. Neuropsychopharmacology.
- Diekelmann, S., & Born, J. (2010). *The memory function of sleep*. Nature Reviews Neuroscience.
- Edge, D., et al. (2024). *From local to global: A graph RAG approach to query-focused summarization*. Microsoft Research.
- Godfrey-Smith, P. (2016). *Other Minds: The Octopus, the Sea, and the Deep Origins of Consciousness*. Farrar, Straus and Giroux.
- Hebb, D. O. (1949). *The Organization of Behavior: A Neuropsychological Theory*. Wiley.
- Hensch, T. K. (2005). *Critical period plasticity in local cortical circuits*. Nature Reviews Neuroscience.
- Hutchins, E. (1995). *Cognition in the Wild*. MIT Press.
- Marder, E. (2012). *Neuromodulation of neuronal circuits: back to the future*. Neuron.
- Simard, S. W. (2018). *Mycorrhizal networks facilitate tree communication, learning and memory*. In: *Memory and Learning in Plants*.
- Squire, L. R. (1992). *Memory and the hippocampus: A synthesis from findings with rats, monkeys, and humans*. Psychological Review.

---

## Riferimenti interni

- [Synaptic Conclave — Visione filosofica e architetturale](./synaptic-conclave-philosophy) — strato sinaptico (predecessore)
- [Dual Memory Layer](./dual-memory-layer) — memoria di lavoro vs memoria di lungo termine
- [Sacred Orders Pattern](./sacred-orders-pattern) — pattern architetturale degli ordini
- Vision RFC: [vitruvyan-core#19](https://github.com/vitruvyan/vitruvyan-core/issues/19) — Cortex Atlas RFC
- Deployment topology: [vitruvyan-core#44](https://github.com/vitruvyan/vitruvyan-core/issues/44) — decisione G.1
- Activation prerequisite: [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) — Phase D
- Release: [vitruvyan-core v1.29.0](https://github.com/vitruvyan/vitruvyan-core/releases/tag/v1.29.0) — scaffold Cortex Atlas
