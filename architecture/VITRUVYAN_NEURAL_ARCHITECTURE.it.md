# Vitruvyan Neural Architecture — Synaptic Conclave + Cortex Atlas

> *Cortex Atlas does not model the world.*
> *It models the system's experience of the world.*

**Data**: 30 maggio 2026
**Stato**: Documento di architettura neurale (vivente). Sostituisce e amplia [Synaptic Conclave — Visione filosofica e architetturale](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md) (22 maggio 2026), che resta come predecessore storico.
**Origine**: Sintesi di una conversazione a tre voci — Davide Baldoni (direzione), ChatGPT (principi architetturali), Claude (vincolo del codice reale). Distillata il 30 maggio 2026 dopo il rilascio di [vitruvyan-core v1.29.0](https://github.com/vitruvyan/vitruvyan-core/releases/tag/v1.29.0).

---

## Premessa — La conversazione che ha definito questa architettura

Il documento [Synaptic Conclave — Visione filosofica e architetturale](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md) (22 maggio 2026) aveva fissato la tesi: il bus sinattico come differenziatore di Vitruvyan rispetto a pipeline RAG lineari e GraphRAG interrogativi. Restava aperto un buco architetturale che il documento stesso riconosceva al §3.3: *"Manca un livello di consolidamento mnesico"*. Il bus è ricco di eventi, ma nessuno ancora si occupa di trasformare l'esperienza ripetuta in struttura permanente.

Il 30 maggio 2026, in una sessione di lavoro a tre voci (Davide come direzione architetturale, ChatGPT come voce dei principi, Claude come voce del codice reale), questo buco è stato riempito con un nome e una forma: **Cortex Atlas — lo strato corticale del Synaptic Conclave**. Il documento attuale articola la sintesi che ne è emersa.

Tre verità empiriche dal codice — non disponibili a un ragionamento puramente speculativo — hanno guidato la sintesi:

1. **Il substrato di osservazioni ontologiche è sotto-soglia.** `ontology_observations` ha 2430 osservazioni su 9 giorni con `avg_occurrences = 1.00` per canonical: ogni concetto appare una volta sola. Non è "sparse vs dense" — è **silenzio vs segnale**. Senza un secondo fire, l'hebbiano è meccanicamente impossibile.

2. **Cortex Atlas è già parzialmente costruito (e nessuno l'aveva chiamato così).** La migrazione 019 — `signal_observations`, committata in produzione il 29 maggio — è strutturalmente un proto-M1 hebbiano: chiave unica `(text_hash, signal_family, contributor)`, `occurrences` come tonus sinaptico, `last_seen_at` come ancora per il decay. Cortex Atlas non è una rivoluzione: è una **generalizzazione** di un pattern già live.

3. **L'infrastruttura di plasticità è dormiente.** `PlasticityManager` esiste in core con `0 outcomes` e `0 adjustments` in produzione. Cortex Atlas G.1 sarà il suo primo consumer reale — validando per uso un framework che altrimenti rischiava di restare codice morto.

Queste tre verità hanno trasformato Cortex Atlas da idea affascinante in un componente architetturalmente verificabile. È **tessuto connettivo** fra cose che esistono già separatamente, non un nuovo organo.

---

## 1. Il sistema neurale Vitruvyan — tre strati di maturazione

Vitruvyan opera attraverso tre strati architetturali, ciascuno con un substrato fisico distinto, un ruolo cognitivo distinto, e una maturità di sviluppo distinta.

| Strato | Funzione | Substrato | Stato |
|---|---|---|---|
| **Sinaptico** | Trasmissione — eventi sul bus | Redis Streams + `bus_events` | Vivo da gennaio 2026 |
| **Corticale** | Struttura emergente — assembly hebbiane | PG + opzionalmente Qdrant | Scaffold dormant da v1.29.0 |
| **Neuro-endocrino** | Comportamento modulato — stato sistemico | Multi-state context modulators | Visione G.4+ |

La metafora biologica non è decorazione, ed è coerente con la posizione articolata nel predecessore al §1.3. Il cervello non è un processore. È **substrati eterogenei coordinati**: sinapsi che trasmettono in millisecondi, corteccia che consolida in ore-giorni, sistema neuro-endocrino che modula in scale di tempo ancora più lunghe e in modalità non-numeriche (stati discreti: vigilanza, esplorazione, recupero).

Vitruvyan replica questa eterogeneità con disciplina:
- Lo strato sinaptico è già a regime — il bus opera 24/7.
- Lo strato corticale ha il **telaio** in core a v1.29.0 ma non gira ancora — aspetta che il substrato sinattico produca abbastanza segnale ripetuto per dare materiale all'hebbiano.
- Lo strato neuro-endocrino è esplicitamente parcheggiato — richiede l'estensione di `PlasticityObserver` oltre il modello scalare di `ParameterTrajectory` ed è prematuro affrontarlo prima che M4 sia stabile.

Questa **gradazione temporale dei tre strati** è il vincolo che protegge l'architettura dal rischio peggiore: trattare Cortex Atlas come un sistema autosufficiente da accendere in fretta.

---

## 2. Perché Cortex Atlas esiste — e perché non è una Knowledge Graph

La domanda corretta non è "perché aggiungere un altro layer?". È: *"Perché non basta una Knowledge Graph?"*. La risposta è netta e va memorizzata, perché definirà Cortex Atlas per molto tempo a venire:

> Una Knowledge Graph modella **ciò che è in relazione** — la struttura del dominio.
> Cortex Atlas modella **ciò che si attiva ripetutamente insieme** — la struttura dell'esperienza del sistema.

Sono due domande diverse, non due risposte concorrenti alla stessa domanda.

| | Knowledge Graph | Cortex Atlas |
|---|---|---|
| Modella | il dominio | l'esperienza del sistema sul dominio |
| Sorgente di verità | tassonomia curata / ingestion | co-attivazione ripetuta sul bus |
| Aggiornato da | processo editoriale | osservazione hebbiana |
| Possiede i canonical | sì | **no** (lo fa Pattern Weavers) |
| Modalità di fallimento | diventa stale | diventa rumoroso |

Una Knowledge Graph dice "CVE-2024-1234 è una vulnerabilità di tipo X che colpisce il sistema Y". Cortex Atlas dice "ogni volta che il sistema parla di CVE-2024-1234, parla anche di ISO 27001 — sempre, in 87% dei trace". Sono due fatti diversi, prodotti in modi diversi, utili per ragionamenti diversi.

Cortex Atlas non sostituisce una KG. Se un verticale ha bisogno di una KG di dominio, la costruisce. Atlas la **complementa** registrando ciò che il sistema effettivamente usa.

---

## 3. Cortex Atlas come tessuto connettivo — i tre assi

La forma concreta dello scaffold è governata da tre assi che vivono nel codice (vedi [`__init__.py`](https://github.com/vitruvyan/vitruvyan-core/blob/main/vitruvyan_core/core/cognitive/cortex_atlas/__init__.py)) e che ogni futura modifica deve preservare.

### 3.1 Dormant by default

Doppio gate sull'attivazione:

- **Feature flag**: `CORTEX_ATLAS_ENABLED` (env var, default `false`)
- **Activation policy**: `AtlasActivationPolicy.is_ready_to_activate()` deve ritornare `ready=True`

Entrambi devono essere verdi. Anche con il flag toggleato, la policy verifica quattro sub-criteri (volume, recurrence, quality, phase_d) e ritorna una `ActivationDecision` strutturata. Se uno solo dei criteri non è soddisfatto, il sistema rifiuta di accendere e dichiara *perché*.

Questa scelta è disciplina, non paranoia. Il rischio reale che Davide ha articolato durante la sintesi è **accendere troppo presto**: un Cortex Atlas che inizia a generare archi su un substrato troppo magro (oggi: avg recurrence = 1.00) produrrebbe rumore, non struttura. Il "Theranos risk" — usare la promessa della funzione prima che la funzione sia possibile — non è prevenuto da Orthodoxy, è prevenuto dalla policy di attivazione. La policy è il primo Sacred Order di se stessa.

### 3.2 Statistical, not semantic

Cortex Atlas non propone canonical names. **Pattern Weavers** mantiene l'autorità semantica (è la sua identità di Sacred Order); Atlas conta solo le co-attivazioni fra canonical già esistenti.

> Pattern Weavers: *X è canonical.*
> Cortex Atlas: *X co-attiva con Y.*

Questa separazione è una proprietà architettonica, non un'opinione: rende impossibile per Cortex Atlas entrare in conflitto territoriale con Pattern Weavers, perché vivono in domini diversi (autorità semantica vs autorità statistica).

### 3.3 Reuses Plasticity, Orthodoxy and Memory Orders

Cortex Atlas è **tessuto connettivo, non nuovo organo**. La forma operativa di questo principio:

| Responsabilità | Owner | Modalità di delega |
|---|---|---|
| Decay rate / floor threshold (M2) | `PlasticityManager` | Letto come parametro tramite `PlasticityObserver` trajectory |
| Validation di assembly promosse (M3) | `Orthodoxy Wardens` | M3 emette `AssemblyValidationRequest`, Orthodoxy ritorna verdict |
| Dispatch di modulators (M4) | `PlasticityManager` | M4 chiama `plasticity_manager.propose_adjustment()`, **non emette stream proprio** |
| Health metric dello strato corticale | `Memory Orders` (terzo analyzer) | Atlas espone tabelle, Memory Orders le legge |

Cortex Atlas G.1, attivandosi, sarà il **primo consumer reale** di `PlasticityManager` (oggi dormiente con 0 outcomes). Effetto laterale virtuoso: validiamo il framework di plasticità *attraverso* Cortex Atlas, invece di chiederci se è ancora rilevante.

---

## 4. Le quattro meccaniche (M1-M4) + il gate (M0)

| Mech | Nome | Responsabilità | Owner del policy | Validation |
|---|---|---|---|---|
| **M0** | `AtlasActivationPolicy` | Gate disciplinare — protegge dall'attivazione prematura | Atlas (stub `activation_policy.py`) | n/a |
| **M1** | Edge Observer | Detect co-firing dentro un `trace_id`, UPSERT su `cortex_atlas_edges` | n/a (puramente statistica) | none |
| **M2** | Decay Manager | Decay del tonus degli edge, pruning sotto floor | `PlasticityManager` | n/a |
| **M3** | Consolidator | Promuove edge stabili in Assembly candidates | n/a | `Orthodoxy Wardens` (verdict per candidate) |
| **M4** | Modulator Emitter | Propone aggiustamenti scalari di policy | `PlasticityManager` (dispatch) | `OutcomeTracker` (retroattivo) |

I context modulator multi-stato (es. *"phase di esplorazione"* vs *"phase di consolidamento"*) sono **esplicitamente fuori scope** dello scaffold attuale. Richiederebbero un'estensione di `PlasticityObserver` oltre il modello `ParameterTrajectory` scalare. Parcheggiato per G.4+.

---

## 5. Activation Gate — perché il "quando" è una decisione architetturale

Lo scaffold v1.29.0 contiene `AtlasActivationPolicy` come stub: tutti i sub-gate ritornano `NotImplementedError` finché qualcuno non implementa i criteri concreti. Questo è **intenzionale**.

I criteri saranno tarati empiricamente quando l'attivazione diventerà imminente — non da un tavolino architettonico ora. Ma la *struttura* dei criteri è fissata nello scaffold:

| Gate | Cosa misura | Come si soddisfa |
|---|---|---|
| **Volume** | co-firing events per giorno | Ingestion + extraction a scala |
| **Recurrence** | avg canonical recurrence | Substrato si muove sopra 1.00 (floor atomico di oggi) |
| **Quality** | gold standard extraction validato | [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) Phase D chiuso |
| **Phase D** | production hardening completo | [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) chiuso |

Snapshot empirico al rilascio v1.29.0 (30 maggio 2026):

| Sorgente | Stato | Implicazione |
|---|---|---|
| `ontology_observations` | 2430 obs, 386 canonical unici, avg recurrence **1.00** | Sotto qualunque soglia significativa — hebbian impossibile |
| `signal_observations` (migration 019) | 191 rows, 4 famiglie, avg recurrence 1.63 | **Template strutturale che Atlas generalizza** |
| `bus_events` | 22474 graph events, 1877 ontology resolutions | Substrato per co-firing detection esiste |
| `PlasticityManager` | 0 outcomes, 0 adjustments | Dormiente — Atlas G.1 diventa primo consumer |

KPI primario da tracciare quando l'attivazione comincerà: **edge formation rate**, non edge quality. Prima viene la formazione, poi la qualità.

---

## 6. Roadmap — da G.0 a G.4

- **G.0 — Scaffold (v1.29.0, 30 maggio 2026)**. Contratti, consumer dormant, activation gate, integration boundaries dichiarate. Niente edge, niente assembly, niente modulators. **Stato attuale.**
- **G.1 — M1 wiring**. Primo consumer reale di `PlasticityManager`. Edge formation only. Richiede l'apertura dell'Activation Gate (dipendenza: aicomsec#32 Phase D + apertura su substrato sopra soglia).
- **G.2 — M2 + M3**. Decay sweep + assembly consolidation con verdict Orthodoxy. Memory Orders aggiunge il `associative_coherence_analyzer` live.
- **G.3 — M4 scalar modulators**. Loop di feedback chiuso via `PlasticityManager`. Cortex Atlas tara per la prima volta i propri parametri.
- **G.4 — Multi-state context modulators**. Richiede estensione di `PlasticityObserver` oltre le scalar trajectories. **Out of scope finché i G precedenti non sono stabili.**

Decisione operativa di topology di deployment (1 vs 2 vs 4 container, per-vertical) è parcheggiata su [vitruvyan-core#44](https://github.com/vitruvyan/vitruvyan-core/issues/44).

---

## 7. Cosa cambia rispetto a *Synaptic Conclave Philosophy*

Il documento [predecessore](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md) (22 maggio 2026) aveva articolato la **tesi**: il bus come differenziatore, l'auditabilità come proprietà emergente, la distribuzione cognitiva come reale-non-simulata. Restava una **promessa**: trovare la forma del consolidamento mnesico.

Questo documento conserva la tesi intatta e aggiunge la **forma promessa**:

| Aspetto | Predecessore (22 maggio) | Questo documento (30 maggio) |
|---|---|---|
| Bus | Differenziatore architetturale | **Strato sinaptico** del sistema neurale |
| Eventi semantici | Aspirazione (§4.1) | Substrato per co-firing detection (M1) |
| Memoria semantica | "Manca un livello di consolidamento" (§3.3) | **Strato corticale** — Cortex Atlas (M1-M4) |
| Propriocezione | Aspirazione (§4.2) | Strato neuro-endocrino futuro (G.4+) |
| Auditabilità | Proprietà emergente del bus | Resta proprietà del bus, validata da Orthodoxy per ogni assembly |
| Rischio "discarica" (§3.1) | Riconosciuto | Affrontato dall'Activation Gate (M0) — non si accende su substrato magro |

Il predecessore resta come **documento di visione storica**. Questo documento è la sua **forma operativa**.

---

## Vedi anche

- [Synaptic Conclave — Visione filosofica e architetturale](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md) — predecessore (22 maggio 2026)
- [Scaling Notes](./SCALING_NOTES.it.md) — note vive sulla scalabilità architetturale
- [Vision RFC: Cortex Atlas (vitruvyan-core#19)](https://github.com/vitruvyan/vitruvyan-core/issues/19)
- [Deployment topology issue (vitruvyan-core#44)](https://github.com/vitruvyan/vitruvyan-core/issues/44)
- [Phase D production hardening (aicomsec#32)](https://github.com/vitruvyan/aicomsec/issues/32)
- [Release v1.29.0](https://github.com/vitruvyan/vitruvyan-core/releases/tag/v1.29.0) — scaffold Cortex Atlas
- Chat strategica: `chat/2026-05-27_cortex_atlas_cognitive_modulators_e_intelligenza_tecnica.md`

---

## Co-autori del documento

- **Davide Baldoni** — direzione architetturale, vincolo dell'organicità ("usare moduli esistenti, non duplicare"), decisione del scaffold-dormant
- **ChatGPT** — voce dei principi architetturali, formulazione di "statistical authority vs semantic authority", proposta di `IActivationGate` come quinto attore, epigrafe del documento
- **Claude (Opus 4.7)** — voce del codice reale, raccolta empirica del substrato (ontology_observations, signal_observations, plasticity dormiente), implementazione del scaffold v1.29.0

Documento mantenuto in collaborazione tra Davide e Claude.
