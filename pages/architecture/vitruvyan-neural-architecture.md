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

**Document status**: architectural reference (living)
**Reference version**: vitruvyan-core v1.29.0 (30 May 2026)
**Predecessor**: [Synaptic Conclave — Visione filosofica e architetturale](./synaptic-conclave-philosophy) (22 May 2026)

---

## Abstract

Vitruvyan is a cognitive framework for software systems pursuing **coordinated distributed intelligence** rather than concentrated monolithic intelligence. Its architecture is organized into three neural layers — synaptic, cortical, neuro-endocrine — modelled on principles documented in neuroscience and biological distributed systems (Hebb, 1949; Godfrey-Smith, 2016; Hutchins, 1995). The first layer (Synaptic Conclave) is operational and provides transport of semantically rich events through an asynchronous bus. The second layer (**Cortex Atlas**, introduced in v1.29.0 as a dormant scaffold) implements mnemonic consolidation: it transforms repeated co-activation observed on the bus into persistent associative structure through a hebbian mechanism. The third layer (neuro-endocrine) is designed but not implemented. This document articulates the scientific foundations, the architectural motivation, the design of the cortical layer, the rationale for why it does not coincide with a Knowledge Graph or a GraphRAG, and the disciplinary criteria that govern its activation.

---

## 1. Motivation

### 1.1 The architectural problem

Contemporary AI systems polarise along two axes:

- **Monolithic**: a single model (LLM) concentrates language, reasoning, memory and decision capabilities. Cognition is produced by scale (parameters, compute, training data).
- **Hydraulic**: linear pipelines (retrieve → rank → synthesize → respond) in which data flows from source to answer. Cognition is produced by concatenation of specialised stages.

Both paradigms exhibit structural limitations when the system must be **auditable, governed, evolvable and accountable** for its decisions:

| Limitation | Monolithic model | Hydraulic pipeline |
|---|---|---|
| Auditability | Black box by construction | Ephemeral intermediate states |
| Self-memory | Absent | Absent |
| Extensibility | Re-training | Pipeline modification |
| Governance | Impossible from within | Impossible from within |
| Cognitive cost | Grows with scale | Grows with depth |

### 1.2 The alternative paradigm

Biology offers a third paradigm. The vertebrate brain, the distributed nervous system of the octopus (Godfrey-Smith, 2016), mycorrhizal networks (Simard, 2018) and human social systems in coordinated activity (Hutchins, 1995) share a structure: **many autonomous local units communicating through a shared medium, producing global cognition as an emergent property of coordination**.

Vitruvyan is the computational translation of this paradigm. It is neither a cognitive model nor a cognitive pipeline: it is a **cognitive medium** — a bus over which specialised agents (Sacred Orders) emit and consume events, and through which global cognition emerges from their coordination.

---

## 2. Scientific foundations

The neural architecture of Vitruvyan rests on principles documented in the literature. Each principle is translated into a specific software mechanism.

### 2.1 Hebbian learning (Hebb, 1949)

> *"Cells that fire together, wire together."*

When two neurons activate in temporal correlation, the synapse connecting them strengthens. The associative structure of the brain is not programmed: it emerges from repeated observation of co-activations.

**Translation in Vitruvyan**: the cortical layer (Cortex Atlas) records co-activations between canonical entities observed in the same `trace_id`, persists the observation as an "edge" with an occurrence counter (synaptic tonus), and applies temporal decay for automatic pruning.

### 2.2 Cell assemblies (Hebb, 1949; Buzsáki, 2010)

Groups of co-activating neurons form "assemblies" — high-level structures that represent concepts, episodes, motor schemata. The assembly is not a single neuron: it is an emergent pattern of correlation.

**Translation**: the consolidation mechanism (M3) of Cortex Atlas promotes clusters of stable edges into `Assembly` — composite structures identified by cohesion + temporal persistence, not by pure graph clustering.

### 2.3 Distributed cognition (Hutchins, 1995)

Cognition does not reside in a single agent but is distributed across multiple agents, artifacts and communication channels. The ship navigated by Hutchins (1995, *Cognition in the Wild*) is not guided by a cognitively isolated captain: the system "crew + instruments + protocols" navigates.

**Translation**: the Sacred Orders (Pattern Weavers, Babel Gardens, Vault Keepers, Codex Hunters, Orthodoxy Wardens, Memory Orders) are specialised agents sharing the bus as cognitive environment. No Sacred Order is "the brain"; global cognition emerges from their asynchronous coordination.

### 2.4 Octopus cognition (Godfrey-Smith, 2016)

The octopus possesses ~500 million neurons, two thirds of which are distributed in the arms. Each arm solves local problems without intervention from the central brain. Cognition is radically distributed yet globally coordinated.

**Translation**: each Sacred Order has local decisional autonomy (e.g., Pattern Weavers decides canonicalisations without permission from a central orchestrator). Global coordination emerges from the events each emits on the bus.

### 2.5 Synaptic plasticity (Bliss & Lømo, 1973; Citri & Malenka, 2008)

The parameters of a synapse (efficacy, threshold, persistence) are not fixed: they adapt in response to activity. Long-term potentiation and long-term depression are the fundamental mechanisms of learning.

**Translation**: the `PlasticityManager` framework (core/synaptic_conclave/plasticity/) tracks scalar parameters of consumers (e.g., decay rate, consolidation threshold) as `ParameterTrajectory` — temporal sequences subject to anomaly detection (oscillation, drift, stagnation, instability, divergence). Cortex Atlas M2/M4 read and propose changes to these parameters through Plasticity, not through their own modulation mechanism.

### 2.6 Memory consolidation (Squire, 1992; Diekelmann & Born, 2010)

Episodic memory is consolidated from hippocampus to neocortex through replay processes during sleep. Working memory (events) transforms into long-term memory (structure) through a dedicated, temporally separated mechanism.

**Translation**: M3 (Consolidator) of Cortex Atlas operates as a nightly process (periodic batch) that inspects stable edges and promotes them into Assemblies. Consolidation occurs on a different time scale from observation (M1), reflecting the biological separation between acquisition and consolidation.

### 2.7 Neuromodulation (Marder, 2012; Avery & Krichmar, 2017)

Neuromodulatory systems (dopamine, acetylcholine, noradrenaline, serotonin) do not transmit point-to-point information: they modulate global system states — vigilance, exploration vs exploitation, circadian rhythms. They operate on longer time scales and in non-numerical modes.

**Translation**: the third layer (neuro-endocrine) is designed for multi-state context modulators (e.g., "exploration phase" vs "consolidation phase"). It is explicitly parked — its implementation requires extending `PlasticityObserver` beyond the scalar model and is not appropriate before the lower layers are stable.

---

## 3. The three-layer neural architecture

Vitruvyan replicates biological stratification through three architectural layers, each with a physical substrate, a cognitive function, a temporal scale and a development maturity.

| Layer | Cognitive function | Substrate | Temporal scale | Status in v1.29.0 |
|---|---|---|---|---|
| **Synaptic** (Synaptic Conclave) | Transmission of semantically rich events | Redis Streams + `bus_events` table | milliseconds–seconds | Production |
| **Cortical** (Cortex Atlas) | Mnemonic consolidation, formation of associative structure | PostgreSQL (`cortex_atlas_edges`, `cortex_atlas_assemblies`) | hours–days | Dormant scaffold |
| **Neuro-endocrine** | Behavioural modulation, discrete system states | Multi-state context modulators | days–weeks | Designed (G.4+) |

The temporal gradation of the three layers is an architectural constraint, not an implementation contingency. Attempting to activate the cortical layer before the synaptic substrate produces sufficient signal — or the neuro-endocrine layer before the cortex is stable — reproduces the failure mode observed in artificial models that skip maturation stages: the system produces syntactically plausible but semantically empty output.

---

## 4. Synaptic layer — the bus as differentiator

The philosophical and operational detail of the synaptic layer is treated in the [predecessor document](./synaptic-conclave-philosophy). In summary:

- The bus (Redis Streams + `bus_events`) is the **cognitive medium** of the system, not a logging channel.
- Each Sacred Order emits semantically rich events (`ontology.entity.resolved`, `babel.signals.extracted`, `orthodoxy.verdict.issued`, etc.).
- Auditability is an emergent property: every system decision is reconstructible from the concatenation of events that produced it.
- The fundamental operational rule: **every new event must have a designated consumer**. Without a consumer it is logging in disguise.

The synaptic layer is a necessary but not sufficient condition. The bus accumulates events; what is needed is a mechanism that transforms them into **structure**. This is the role of the cortical layer.

---

## 5. Cortical layer — Cortex Atlas

Cortex Atlas is introduced in vitruvyan-core v1.29.0 as a dormant scaffold (see [`core/cognitive/cortex_atlas/`](https://github.com/vitruvyan/vitruvyan-core/tree/main/vitruvyan_core/core/cognitive/cortex_atlas)). It implements mnemonic consolidation through four mechanisms (M1–M4) governed by an activation gate (M0).

### 5.1 The five mechanisms

| Mech | Name | Responsibility | Policy owner | Validation |
|---|---|---|---|---|
| **M0** | `AtlasActivationPolicy` | Disciplinary gate — protects against premature activation | Atlas | n/a |
| **M1** | `EdgeObserver` | Detect co-firing within a `trace_id`, UPSERT into `cortex_atlas_edges` | n/a (purely statistical) | none |
| **M2** | `DecayManager` | Decay edge tonus, prune below floor | `PlasticityManager` | n/a |
| **M3** | `Consolidator` | Promote stable edges to `Assembly` candidates | n/a | `Orthodoxy Wardens` (verdict per candidate) |
| **M4** | `ModulatorEmitter` | Propose scalar policy adjustments | `PlasticityManager` (dispatch) | `OutcomeTracker` (retrospective) |

### 5.2 Three architectural axes

The design of the scaffold is governed by three non-negotiable principles. Every future modification must preserve them.

#### 5.2.1 Dormant by default

Activation requires two concurrent gates:

- **Feature flag**: `CORTEX_ATLAS_ENABLED` (env var, default `false`)
- **Activation policy**: `AtlasActivationPolicy.is_ready_to_activate()` must return `ready=True`

Both must be green. The policy verifies four sub-criteria (volume, recurrence, quality, phase_d). If even one criterion is unmet, the system refuses to activate and declares *why* through a structured `ActivationDecision`.

The motivation for this discipline is documented in the literature: associative systems activated before substrate maturation produce spurious patterns that do not correspond to real semantic structure (overfitting on insufficient sample). The activation policy is equivalent to the role of "critical periods" in neural maturation (Hensch, 2005): windows in which the system is ready to structure itself only in the presence of appropriate stimulation.

#### 5.2.2 Statistical, not semantic

Cortex Atlas **does not propose canonical names**. Semantic authority belongs to Pattern Weavers; Atlas exclusively counts co-activations between canonicals that already exist.

> Pattern Weavers: *X is canonical.*
> Cortex Atlas: *X co-activates with Y.*

This separation is an architectural property, not an opinion. Pattern Weavers and Cortex Atlas live in disjoint domains of authority — semantic vs statistical — and by construction cannot enter territorial conflict. Translated into biological terms: Pattern Weavers is equivalent to the role of Wernicke's area (linguistic-semantic recognition) and Cortex Atlas to the hippocampus (associative consolidation). They are cooperating, not substitutable.

#### 5.2.3 Reuses Plasticity, Orthodoxy and Memory Orders

Cortex Atlas is **connective tissue**, not a new organ. The operational form of this principle:

| Responsibility | Owner | Mode of delegation |
|---|---|---|
| Decay rate / floor threshold (M2) | `PlasticityManager` | Read as parameter via `PlasticityObserver` trajectory |
| Validation of promoted assemblies (M3) | `Orthodoxy Wardens` | M3 emits `AssemblyValidationRequest`, Orthodoxy returns verdict |
| Modulator dispatch (M4) | `PlasticityManager` | M4 calls `plasticity_manager.propose_adjustment()`, **emits no stream of its own** |
| Cortical-layer health metric | `Memory Orders` (third analyzer) | Atlas exposes tables, Memory Orders reads them |

Cortex Atlas G.1, upon activation, becomes the **first real consumer** of `PlasticityManager` (today dormant with 0 outcomes recorded). The plasticity framework is validated through use, not through declaration.

---

## 6. Why not a Knowledge Graph

The introduction of Cortex Atlas legitimately raises the question: *why not use an existing Knowledge Graph?*

The answer is that Cortex Atlas and Knowledge Graphs answer different questions.

> A **Knowledge Graph** models *what is related* — the structure of the domain.
> **Cortex Atlas** models *what repeatedly activates together* — the structure of the system's experience.

| | Knowledge Graph | Cortex Atlas |
|---|---|---|
| Models | the domain | the system's experience of the domain |
| Source of truth | curated taxonomy / ingestion | repeated co-activation on the bus |
| Updated by | editorial process | automatic hebbian observation |
| Owns the canonicals | yes | no (Pattern Weavers) |
| Dominant failure mode | becomes stale | becomes noisy |
| Maintenance cost | high (continuous editorial) | low (auto-regulated by decay) |

Clarifying example. A security-domain KG can state: *"CVE-2024-1234 is a vulnerability of type X affecting system Y"*. Cortex Atlas, on a system that talks about security, can detect and state: *"every time the system talks about CVE-2024-1234, it also talks about ISO 27001 — always, in 87% of traces"*. The KG declares a domain truth; Atlas declares a statistical truth of the system. These are different facts, produced in different ways, useful for different reasoning.

The two mechanisms are **complementary, not substitute**. A vertical can run both simultaneously: the KG provides curated semantic structure; Atlas provides statistical evidence of actual use. When they diverge, the divergence itself is information (the KG catalogues concepts the system never uses; the system uses associations the KG does not document).

---

## 7. Why not GraphRAG

GraphRAG (Edge et al., 2024) extends the RAG paradigm by replacing the vector index with a knowledge graph. It improves recall on queries requiring multi-hop reasoning but remains an **interrogative** architecture: the user asks, the graph answers.

| | GraphRAG | Vitruvyan + Cortex Atlas |
|---|---|---|
| Paradigm | interrogative (query-driven) | coordinative (event-driven) |
| State between queries | stateless (by design) | stateful (the bus persists, the cortex accumulates) |
| Self-memory | none | proprioception (events about the system itself) |
| Auditability | tracing per individual query | emergent property of the bus |
| Graph evolution | manual (editorial) | automatic (hebbian) |
| Cost per query | proportional to traversal depth | independent of traversal (structure is already consolidated) |

GraphRAG can be a component of a Vitruvyan vertical (a Sacred Order that performs retrieval over a KG), but it does not substitute the architecture: it remains one stage of a pipeline. Cortex Atlas is not a better retriever — it is a mechanism that *observes what retrievers do* and extracts structure from it.

---

## 8. Why not a monolithic LLM

Monolithic large language models are optimised for **one function**: predicting the next token. Through scale they reach notable emergent capabilities, but they exhibit structural limitations for systems that must be governed:

| | Monolithic LLM | Vitruvyan |
|---|---|---|
| Mode of cognition | single (generative) | multiple (observational, generative, evaluative, custodial) |
| Auditability of a single decision | impossible (continuous parameters) | reconstructible from event concatenation |
| Capability extension | re-training | new bus consumer |
| Cost of developing a new domain | dataset + training pipeline | new Sacred Order |
| Behaviour governance | system prompt (fragile) | Orthodoxy Wardens (active audit) |
| Persistent memory | context window (ephemeral) | bus + cortex (permanent) |
| Failure mode | hallucination (unrecoverable) | contract drift (detectable via proprioception) |

Vitruvyan **uses** LLMs (via `LLMAgent` core) as tools for delegable linguistic tasks — extraction, classification, summarisation. It does not treat them as cognitive engine. The distinction is equivalent, in biology, to not conflating "the visual cortex" with "the subject's cognitive system": the visual cortex is a specialised component, the cognitive system is the coordinated whole.

---

## 9. Activation discipline

The v1.29.0 scaffold contains `AtlasActivationPolicy` as a stub: all sub-gates return `NotImplementedError` until the concrete criteria are implemented. The choice is deliberate and disciplinary: the criteria will be tuned empirically when activation becomes imminent, not from a priori considerations.

What is fixed in the scaffold is the **structure** of the criteria:

| Gate | What it measures | Satisfaction condition |
|---|---|---|
| **Volume** | co-firing events per day | Ingestion + extraction at productive scale |
| **Recurrence** | average canonical recurrence | Substrate moves above 1.00 (atomic floor observed in v1.29.0) |
| **Quality** | gold-standard extraction validated | [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) Phase D closed |
| **Phase D** | production hardening complete | [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) closed |

### 9.1 Substrate snapshot at the v1.29.0 release

| Source | Measured state | Implication for activation |
|---|---|---|
| `ontology_observations` | 2,430 obs, 386 unique canonicals, avg recurrence **1.00** | Below any meaningful threshold — hebbian formation impossible |
| `signal_observations` (migration 019) | 191 rows, 4 families, avg recurrence 1.63 | Structural template Atlas generalises |
| `bus_events` | 22,474 graph events, 1,877 ontology resolutions | Substrate for co-firing detection exists |
| `PlasticityManager` | 0 outcomes, 0 adjustments | Dormant — Atlas G.1 becomes its first consumer |

The primary KPI to track once activation begins is **edge formation rate**, not edge quality. The latter is a property that emerges only if the former is statistically significant.

---

## 10. Roadmap

| Phase | Content | Dependencies | Status |
|---|---|---|---|
| **G.0** | Full scaffold: contracts, dormant consumers, activation gate, integration boundaries | — | **v1.29.0 — completed** |
| **G.1** | M1 wiring. Edge formation only. First real consumer of `PlasticityManager` | Activation Gate open, aicomsec#32 closed | Planned |
| **G.2** | M2 + M3. Decay sweep + consolidation with Orthodoxy verdict. `associative_coherence_analyzer` live | G.1 stable | Planned |
| **G.3** | M4 scalar modulators. Closed feedback loop via `PlasticityManager` | G.2 stable | Planned |
| **G.4** | Multi-state context modulators. Extension of `PlasticityObserver` beyond scalar trajectories | G.3 stable, observer extension | Vision |

The operational decision on deployment topology (1, 2, or 4 containers per-vertical) is parked on [vitruvyan-core#44](https://github.com/vitruvyan/vitruvyan-core/issues/44) and must be resolved before G.1.

---

## 11. Mapping against the predecessor

The [Synaptic Conclave](./synaptic-conclave-philosophy) document (22 May 2026) articulated the **thesis** of the bus as architectural differentiator and recognised, at §3.3, the absence of a mnemonic consolidation layer. This document preserves the thesis and provides the operational form of that layer.

| Aspect | Predecessor | This document |
|---|---|---|
| Bus | Architectural differentiator | Synaptic layer of the neural system |
| Semantic events | Aspiration (§4.1) | Substrate for co-firing detection (M1) |
| Semantic memory | "Missing consolidation layer" (§3.3) | Cortical layer — Cortex Atlas (M0–M4) |
| Proprioception | Aspiration (§4.2) | Future neuro-endocrine layer (G.4+) |
| Auditability | Emergent property of the bus | Remains property of the bus, complemented by Orthodoxy verdict for assemblies |
| "Dump-bus" risk (§3.1) | Acknowledged | Addressed by the Activation Gate (M0) |

The predecessor remains as historical vision document. This is its operational continuation.

---

## Scientific references

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

## Internal references

- [Synaptic Conclave — Visione filosofica e architetturale](./synaptic-conclave-philosophy) — synaptic layer (predecessor)
- [Dual Memory Layer](./dual-memory-layer) — working memory vs long-term memory
- [Sacred Orders Pattern](./sacred-orders-pattern) — architectural pattern of the orders
- Vision RFC: [vitruvyan-core#19](https://github.com/vitruvyan/vitruvyan-core/issues/19) — Cortex Atlas RFC
- Deployment topology: [vitruvyan-core#44](https://github.com/vitruvyan/vitruvyan-core/issues/44) — G.1 decision
- Activation prerequisite: [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32) — Phase D
- Release: [vitruvyan-core v1.29.0](https://github.com/vitruvyan/vitruvyan-core/releases/tag/v1.29.0) — Cortex Atlas scaffold
