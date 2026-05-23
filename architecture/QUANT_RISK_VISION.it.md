# Vision — Risk assessment quant-driven con Neural / Veritas / Horizon

**Data**: 23 maggio 2026
**Stato**: Documento di visione (non implementato)
**Origine**: Dialogo Davide Baldoni ↔ Claude — sintesi su come tre engine domain-agnostic (Neural ranking, Veritas validation, Horizon Pareto) possano collaborare per portare quant-rigor nel risk assessment di security.
**Related**: [SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md), [aicomsec issue #9](https://github.com/vitruvyan/aicomsec/issues/9)

---

## Premessa

Vitruvyan core ospita tre "Sacred Order of Reason" sviluppati originariamente per finance ma **strutturalmente domain-agnostic**:

- **Neural Engine** — *ranking / screening*. Da N entità ne sopravvivono k, ordinate per score
- **Veritas Engine** — *truth / epistemic validation*. Signal quality + regime detection
- **Horizon Engine** — *optimisation / Pareto*. Frontiera multi-obiettivo + ranking per doctrine

In finance la sequenza screen → validate → optimise è ben rodata (Markowitz '52, oltre 70 anni di pressione quant). Nel mondo security, dominato da matrici L×I dipinte a mano e checklist regolatorie, il margine per portare rigore quantitativo è enorme. Questo documento articola perché e come.

---

## 1. Le tre engine — cosa fanno *davvero*

| Engine | Sacred Order | API | Output |
|---|---|---|---|
| **Neural** | Ranking / Screening | `/screen`, `/rank` (profile-driven) | Shortlist con score |
| **Veritas** | TRUTH / Epistemic Validation | `run_validation(entity_ids, features, profile, domain)` con threshold profiles {`default`, `strict`, `relaxed`} | Per entità: signal-quality + regime context |
| **Horizon** | Optimisation / Pareto | `run_optimisation(space_definition, design_points, KPI_objectives, doctrine)` | ParetoFrontier + DoctrineRanking |

Tutte e tre accettano un parametro `domain` o `profile`. Sono già scritte per essere agnostic-by-construction. Il dominio si compone *sopra*, non si reimplementa dentro.

---

## 2. Il pattern profondo: **explore → validate → decide**

```
   spazio enorme di opzioni
   (es. 1000+ controlli ISO/NIST/CIS, decine di vendor, centinaia di CVE)
            │
            ▼
   ┌─────────────────┐
   │ NEURAL          │  screen out the noise, rank il superstite
   │ ranking         │  "su 10000 opzioni, queste 50 valgono uno sguardo"
   └─────────────────┘
            │ candidate shortlist
            ▼
   ┌─────────────────┐
   │ VERITAS         │  "queste 50 sono credibili? Il regime attuale
   │ validation      │   le supporta? Il segnale è rumore o vero?"
   └─────────────────┘
            │ validated candidates + regime context
            ▼
   ┌─────────────────┐
   │ HORIZON         │  "data la realtà, qual è la frontiera
   │ optimisation    │   delle scelte ottimali?"
   └─────────────────┘
            │ Pareto front + doctrine-ranked options
            ▼
       decisione informata
```

In finance: screen di stocks → validate signal quality → optimise portfolio. La stessa sequenza si applica con **maggiore impatto** alla security perché lì il livello base di quant-rigor è molto più basso.

---

## 3. Caso d'uso flagship — *risk-driven control selection*

### Il problema
Un'organizzazione deve fare compliance ISO 27001 / NIS2. Ha:

- ~93 controlli ISO 27002:2022 + ~1000 NIST SP 800-53 + settoriali (CIS, IEC 62443) → **migliaia di controlli potenziali**
- Budget limitato, tempo limitato, staff limitato
- Priorità in tensione: compliance regolatoria, business continuity, costo, effort, brand

Oggi: si risolve "a senso" o seguendo checklist generiche. Domani con i tre engine: **quant-rigorously**.

### Step 1 — Neural ranke la catalogo
- **Input**: catalogo completo + profilo organizzazione (settore, dimensione, scope normativo)
- `/screen` → escludere i non-applicabili
- `/rank` → ordinare i ~200 sopravvissuti per *relevance score* dato il threat landscape dell'org
- **Output**: shortlist di ~30 controlli candidati con score di rilevanza
- **Emit**: `security.controls.ranked`

### Step 2 — Veritas valida i candidati
- **Input**: shortlist + evidence disponibile (audit precedenti, threat intel, existing implementations)
- Per ogni controllo: *l'evidenza che lo supporta è di qualità (signal quality)? È il momento giusto per implementarlo (regime detection)?*
- **Regime detection in security**: periodo di attacchi diffusi alla supply chain? → controlli 5.19-5.23 salgono di priorità. Periodo di ransomware? → 8.13 (backup) sale
- Threshold profiles: `strict` per critical infrastructure (nuclear, healthcare), `relaxed` per startup low-criticality
- **Emit**: `security.controls.validated`, `security.regime.detected`

### Step 3 — Horizon ottimizza la selezione
- **Input**: validated candidates + KPI objectives (cost ↓, residual_risk ↓, compliance_coverage ↑, implementation_time ↓, business_disruption ↓)
- Design space = tutte le combinazioni di "quali controlli implementare adesso, quali in fase 2, quali skippare"
- **Pareto front** = NON una risposta, ma la **curva delle scelte ottimali**: *"se vuoi €500K budget puoi avere 60% coverage; a €700K passi a 80%; oltre €900K il marginal benefit collassa"*
- Doctrines security-flavored: `regulatory_first` (NIS2/GDPR mandatory minimums sono vincoli hard), `risk_first` (massimizza risk reduction), `balanced`, `nis2_minimum`, `conservative`
- **Emit**: `security.optimisation.completed`, `security.pareto.computed`, `security.solution.selected`

### Step 4 — livello cognitivo emergente
- **Pattern Weavers**: *"ogni volta che questa org runa il workflow, Veritas detect regime 'aggressive supplier'. Pattern emergente: drift verso NIS2 Art. 21 (supply chain)."*
- **Memory Orders**: persistono Pareto frontier nel tempo → mostrare *evolution* (*"la tua curva risk-cost è migliorata del 30% in 6 mesi grazie a queste 3 implementazioni"*)
- **Orthodoxy Wardens**: garantisce che ogni soluzione Horizon rispetti i mandatory minimums (es. *"non puoi escludere il controllo 8.13 perché GDPR Art. 32 lo richiede"*)

---

## 4. Altri casi d'uso

| Caso | Neural | Veritas | Horizon |
|---|---|---|---|
| **Compliance gap triage** | Rank gap findings per severità | Validate real risk vs noise (regime: "is this finding popular this quarter?") | Ottimizza roadmap remediation: cost vs speed vs depth |
| **Vendor / supply chain risk (NIS2 Art. 21)** | Screen vendor su requisiti minimi | Validate self-attestation (signal quality di security claims) | Pareto vendor portfolio: cost vs risk vs strategic alignment |
| **Threat intel prioritization** | Rank CVE/IOC entranti per relevance | Validate credibility + dedup + regime | Pareto patch order: exploitability vs business impact vs effort |
| **Incident response decision support** | Rank possibili azioni (isolate, monitor, rollback) | Validate evidenze + regime (targeted vs commodity) | Pareto sequenza: speed vs forensic preservation vs business continuity |
| **Risk assessment IDEABLE** | Rank threat-asset pairs | Validate L×I vs storico settore | Pareto control roadmap |

Le cinque categorie condividono la stessa forma perché le tre engine catturano una sequenza cognitiva universale.

---

## 5. Il punto architetturale — *NON* un pipeline sincrono

La tentazione è vederlo come funzione composta. Sbagliato. In Vitruvyan è un **loop cognitivo asincrono** sul bus sinattico:

- Neural emette `security.controls.ranked` → Veritas ascolta e processa quando può, emette `security.controls.validated` → Horizon ascolta e ottimizza, emette `security.pareto.computed`
- I tempi sono disaccoppiati: Horizon può girare batch overnight con risultati di Veritas accumulati nella giornata
- **Cross-channel inference** (vedi sezione 4.1 del [doc filosofico](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md)): un meta-listener può notare *"Horizon ha cambiato la Pareto frontier 3 volte nell'ultima settimana → instabilità nel modello → trigger review umana"*. Propriocezione applicata al risk management
- **Auditability nativa**: ogni decisione finale ha catena di eventi `security.controls.ranked` → `security.controls.validated` → `security.pareto.computed` → `security.solution.selected` ricostruibile, con `correlation_id` propagato

Coerente con i 6 principi operativi:

1. Ogni evento nuovo (`security.*`) ha consumer designato — non logging travestito
2. Eventi semanticamente ricchi: portano Pareto frontier intera, non solo "operation completed"
3. Auditability come proprietà del bus, non add-on
4. Memoria semantica via observations_persister → consolida regime detections nel tempo
5. Propriocezione: meta-listener su drift della Pareto frontier
6. Distribuzione cognitiva reale: Pattern Weavers + Memory Orders + Orthodoxy Wardens collaborano

---

## 6. Cosa esiste già, cosa manca

### Esiste già (sorprendentemente molto)
- Service wrappers: `services/api_horizon_engine/`, `services/api_veritas_engine/`, `services/api_neural_engine/`
- Core LIVELLO 1: `vitruvyan_core/core/governance/{veritas_engine,horizon_engine}/` con test + examples
- Contratti Pydantic: `vitruvyan_core/contracts/{veritas_engine,horizon_engine,neural_engine}/`
- VPAR framework: `vitruvyan_core/domains/security/vpar/` (orchestratore concettuale risk + explainability + grounding)

### Manca — lo *strato di dominio*

**E.1 — Vocabolari security per i 3 engine**
- `domains/security/neural/control_ranking_profile.py` — scoring controlli ISO/NIST/CIS
- `domains/security/veritas/security_validation_profile.py` — signal features security-specific + regime detection security-flavored
- `domains/security/horizon/control_design_space.py` — KPI security + doctrines (`regulatory_first`, `risk_first`, `nis2_minimum`, ecc.)

**E.2 — Nuovi canali bus + nodi LangGraph orchestratori**
- 5 nuovi canali `security.*` (vedi sopra)
- `vitruvyan_core/domains/security/graph_nodes/risk_selection_node.py` — orchestra la sequenza via HTTP + emit eventi semantici

**E.3 — Estensione observations persister o nuovo `risk_observations_persister`**
- Capta eventi `security.*`, persiste decisioni + regime + Pareto frontier nel tempo
- Abilita *evolution view* in UI

**E.4 — UI per il CISO**
- Visualizzazione Pareto frontier **interattiva** — la feature UX più importante
- Doctrine selector dinamico
- Storyboard temporale delle decisioni (audit trail visibile)

---

## 7. Precondizioni per partire

1. **Phase D ingestion live qualche settimana** — vogliamo già osservazioni reali quando facciamo girare Horizon, così Veritas regime detection ha base storica
2. **Use case concreto** — meglio costruire insieme a un cliente IDEABLE che fa risk assessment reale, non in astratto. Il primo Pareto frontier va girato su dati veri
3. **Decisione UI** — il valore è visibile solo se la Pareto frontier è *navigabile dal CISO*. Senza UI è solo JSON

---

## 8. La provocazione di chiusura

Le tre engine sono state sviluppate per finance perché finance ha avuto decenni di pressione per quant-formalizzare le decisioni (Markowitz, '52). Security è rimasta dominata da approcci qualitativi — matrici L×I dipinte a mano, audit a checklist, NIS2 implementata "a sentimento".

**Il vero arbitraggio cognitivo di Vitruvyan**: portare la rigorosità quant di finance dentro security, dove c'è enorme spazio per innovazione.

Non perché security debba diventare matematica pura. Ma perché *risk-driven control selection* dovrebbe essere un problema di Pareto, non di gusto del CISO. E perché un sistema che mostra al CISO la **frontiera** delle scelte ("guarda, a +€200K hai -30% risk; a +€500K il marginal benefit crolla") è qualitativamente diverso da un sistema che gli dà *la* risposta.

Le tre engine sono pronte. Le precondizioni stanno maturando. Quando il primo cliente IDEABLE ci darà un risk assessment reale da girare, partiamo.

---

## Vedi anche

- [Synaptic Conclave — Visione filosofica](./SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md) — il substrato cognitivo su cui queste engine collaborano
- [aicomsec issue #9](https://github.com/vitruvyan/aicomsec/issues/9) — tracking implementation Phase E
- Veritas Engine API · Horizon Engine API · Neural Engine API (docs servizio interno, da aggiungere)
