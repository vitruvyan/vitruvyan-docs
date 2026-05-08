# Pattern Weavers

> **Last Updated**: March 17, 2026

## What it does

- Resolves free text into taxonomy categories (concepts, sectors, regions, …)
- Extracts concepts for downstream pipelines
- Provides keyword fallback when semantic search is unavailable
- **(v3)** Compiles queries into strict `OntologyPayload` via single LLM call (gate + entities + intent + topics + sentiment)

- **Epistemic Layer**: Reason (Ontology Resolution / Semantic Contextualization)
- **Mandate**: resolve user text into structured taxonomy matches (concepts, sectors, regions, entities)
- **Hard boundary**: extract structure, never interpret meaning (no risk/scoring here)

## Charter (Mandate + Non-goals)

### Mandate
Provide domain-agnostic ontology resolution via YAML-driven taxonomies (v2) or LLM semantic compilation (v3) with explainable, schema-validated output.

### Non-goals
- Not a scoring engine (Neural Engine responsibility).
- Not a signal extractor (Babel Gardens responsibility).

## Interfaces

### Event contract (Cognitive Bus)
Defined in `vitruvyan_core/core/cognitive/pattern_weavers/events/__init__.py` (selected):

- `pattern.weave.request` → `pattern.weave.response`
- `pattern.weave.error`

### Service (LIVELLO 2)
- `services/api_pattern_weavers/` — adapters for embedding + Qdrant (v2) and LLM compilation (v3), HTTP API

## Pipeline

### v2 (default — `PATTERN_WEAVERS_V3=0`)
1. Query text → embedding (via Babel Gardens/service adapter)
2. Similarity search (Qdrant) + keyword fallback
3. `WeaveResult` with explainable matches (scores, match_type, metadata)

### v3 (feature-flagged — `PATTERN_WEAVERS_V3=1`)
1. Query text → domain plugin system prompt → LLM (`complete_json`)
2. JSON → `LLMCompilerConsumer.process()` → `OntologyPayload` (strict schema, `extra="forbid"`)
3. Domain plugin `validate_payload()` (e.g., ticker normalization in finance)
4. `CompileResponse` with gate verdict, entities, intent, topics, sentiment, language

## Code map

### LIVELLO 1 (pure)
- `vitruvyan_core/core/cognitive/pattern_weavers/domain/entities.py` (WeaveRequest/WeaveResult)
- `vitruvyan_core/core/cognitive/pattern_weavers/domain/config.py` (taxonomy YAML)
- `vitruvyan_core/core/cognitive/pattern_weavers/consumers/weaver.py`
- `vitruvyan_core/core/cognitive/pattern_weavers/consumers/keyword_matcher.py`
- **(v3)** `vitruvyan_core/core/cognitive/pattern_weavers/consumers/llm_compiler.py` (JSON→OntologyPayload parser)
- **(v3)** `vitruvyan_core/core/cognitive/pattern_weavers/governance/semantic_plugin.py` (plugin registry)
- **(v3)** `vitruvyan_core/contracts/pattern_weavers.py` (OntologyPayload, ISemanticPlugin ABC)

### LIVELLO 2 (adapters)
- `services/api_pattern_weavers/adapters/` (Qdrant + embedding I/O boundary)
- **(v3)** `services/api_pattern_weavers/adapters/llm_compiler.py` (LLMAgent orchestration)

### Graph node
- **(v2)** `core/orchestration/langgraph/node/pattern_weavers_node.py`
- **(v3)** `core/orchestration/langgraph/node/pw_compile_node.py`

## Verticalization (finance pilot)

Finance provides:

- a taxonomy YAML (sectors, instruments, regions) used by Pattern Weavers v2
- **(v3)** `FinanceSemanticPlugin` (`domains/finance/pattern_weavers/finance_semantic_plugin.py`) — 11 entity types, 11 intents, ticker uppercase normalization, multilingual (en/it/es/fr/de)
- optional keyword lists to improve deterministic recall

Rule:
domain taxonomies (v2) and semantic plugins (v3) live outside the core; the core is only the resolver.

## Comprehension Engine v3

With `BABEL_COMPREHENSION_V3=1`, Pattern Weavers' ontology resolution is unified with Babel Gardens' semantic extraction in a **single LLM call** — the Comprehension Engine. The `OntologyPayload` (owned by PW) and `SemanticPayload` (owned by BG) are produced together but remain architecturally separate contracts.

PW continues to own the ontology dimension (gate, entities, intent, topics) while BG owns semantics (sentiment, emotion, linguistic register). The `comprehension_node` in the graph replaces both `pw_compile_node` and `emotion_detector_node` with full backward compatibility.

For the full architectural rationale, see [Semantic & Ontology Architecture](../architecture/SEMANTIC_ONTOLOGY_ARCHITECTURE.md).

## Ontological Relations v3.1 (March 2026)

### Overview

v3.1 introduces **first-class entity relations** — typed, directed edges between `OntologyEntity` instances within `OntologyPayload`. This is the first layer of structural cognition: Pattern Weavers evolves from semantic classifier to **ontology engine**.

### Key contract additions (`contracts/pattern_weavers.py`)

| Component | Description |
|-----------|-------------|
| `CORE_RELATION_TYPES` | Canonical vocabulary (7 types): `owns`, `part_of`, `competes_with`, `depends_on`, `affects`, `represents`, `related_to` |
| `EntityRelation` | Pydantic model (`extra="forbid"`): target, relation_type, confidence, source |
| `OntologyEntity.relations` | `List[EntityRelation]` field (default empty) |

### Directionality semantics

| Direction | Types | Interpretation |
|-----------|-------|----------------|
| `directed` | owns, part_of, depends_on, affects, represents | A → B only |
| `bidirectional` | competes_with | A ↔ B (stored once, implied both ways) |
| `weak` | related_to | Undirected, low-confidence fallback |

### `represents` relation type

Cross-source identity linking: when an entity from a source system (e.g., an Odoo customer, a Zendesk ticket, a HubSpot contact) maps to a canonical entity. Populated by Codex Hunters during the binding phase with `source="codex"`, confidence=1.0.

### Data flow

```
LLM Comprehension → EntityRelation (source="llm")
     ↓
comprehension_consumer preserves relations
     ↓
CAN node reads & injects into narrative context
     ↓
entity_resolver enriches with known relations from PostgreSQL
     ↓
entity_relations table (PostgreSQL, UPSERT on unique triple)
```

### Ingestion pipeline integration (Oculus → Codex)

```
Oculus Prime (Perception) → Evidence Pack
     ↓ oculus_prime.evidence.created
Codex Hunters Track → Restore → Bind
     ↓ BoundEntity.relations (from normalizer or domain plugin)
BusAdapter.process_bind → PersistenceAdapter.store_entity_relations
     ↓
PostgreSQL entity_relations table
```

### Key constraints

- Relations are **grounding, not reasoning** — they record structural facts, not inferences
- Anti-hallucination: LLM prompt uses closed vocabulary with minimum confidence >= 0.7
- `extra="forbid"` rejects any LLM-hallucinated extra fields
- Domain plugins MAY extend `CORE_RELATION_TYPES` with domain-specific types
