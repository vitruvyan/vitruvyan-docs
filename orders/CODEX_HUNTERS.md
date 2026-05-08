# Codex Hunters

> **Last Updated**: March 17, 2026

## What it does

- Discovers/validates entities from sources and turns payloads into canonical domain objects
- Normalizes and quality-scores data before persistence
- Binds entities for storage (dedupe keys + storage refs; service executes I/O)

- **Epistemic Layer**: Perception (Data Acquisition / Canonicalization)
- **Mandate**: acquire raw knowledge from sources and normalize it into canonical records
- **Verticalization**: domain pack binds `entity_id`, sources, and stream namespace

## Start here

The authoritative component README (code-co-located) is:

- `vitruvyan_core/core/governance/codex_hunters/README.md`

Finance pilot “domain pack”:

- `examples/verticals/finance/CODEX_HUNTERS_DOMAIN_PACK.md`

## Interfaces

### Service (LIVELLO 2)
- `services/api_codex_hunters/` — API + adapters + Streams listener

### Orchestration hook (finance)
- `vitruvyan_core/domains/finance/graph_plugin.py` routes to `codex_expedition` when discovery is required.

## Verticalization (finance pilot)

Concrete artifacts:

- Config: `examples/verticals/finance/config/codex_hunters_finance.yaml`
- Normalizer example: `examples/verticals/finance/codex_hunters_domain_pack.py`

## Entity Relations (v3.1, March 2026)

### Relational binding seam

Codex Hunters now supports **relational data persistence** during the binding phase. When a `BoundEntity` carries `EntityRelationRef` entries (populated by domain normalizers during Restore or by ingestion plugins), the `BusAdapter.process_bind()` method automatically persists them to the `entity_relations` PostgreSQL table.

### Domain model

```python
@dataclass(frozen=True)
class EntityRelationRef:
    target_entity_id: str       # e.g. "customer_456", "ticket_789"
    relation_type: str          # "owns", "part_of", "represents", etc.
    confidence: float = 0.5
    source: str = "codex"       # provenance

@dataclass(frozen=True)
class BoundEntity:
    # ... existing fields ...
    relations: Tuple[EntityRelationRef, ...] = ()
```

### Ingestion flow (Oculus → Codex → Relations)

1. **Oculus Prime** (Perception) acquires raw evidence from external APIs (Zendesk, Odoo, HubSpot). Evidence Pack preserves full source metadata including FK references.
2. **Track phase** (TrackerConsumer): validates source, creates `DiscoveredEntity` with `raw_data` preserved.
3. **Restore phase** (RestorerConsumer): domain-specific normalizers can extract FK-based relations from `normalized_data`. E.g., an Odoo normalizer finds `customer_id → company_name` and creates `EntityRelationRef("company_name", "represents", 1.0, "codex")`.
4. **Bind phase** (BinderConsumer): constructs `BoundEntity` with relations from Restore phase.
5. **Persistence** (BusAdapter LIVELLO 2): calls `PersistenceAdapter.store_entity_relations()` to INSERT/UPSERT into `entity_relations` table.

### `represents` relation type

Key for enterprise multi-source scenarios: when an Odoo customer record, a Zendesk contact, or a HubSpot company all refer to the same canonical entity, the `represents` relation links them. This enables cross-source entity resolution without a graph database.

### Persistence API

```python
# Store relations (UPSERT on unique triple)
persistence.store_entity_relations([
    {"source_entity": "odoo_customer_123", "target_entity": "Acme Corp",
     "relation_type": "represents", "confidence": 1.0, "source": "codex",
     "context": "codex_bind:odoo"}
])

# Query known relations for an entity
relations = persistence.fetch_entity_relations("Acme Corp", direction="both")
```
