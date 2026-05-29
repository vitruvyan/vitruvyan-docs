# Babel Gardens

> **Last Updated**: May 29, 2026 (v3.2)

<p class="kb-subtitle">Sacred Order #2 — Perception. Turns unstructured text into structured, auditable semantic signals with explainability.</p>

## What it does

Babel Gardens is the **linguistic substrate** of Vitruvyan. It runs at the front of the chat pipeline (Phase 0) and on every ingested document, extracting structured signals that all downstream Orders consume.

- **Detects language** (ISO 639-1, ~100 languages via EmbeddingGemma cascade)
- **Extracts security threat signals** (severity, exploit imminence, MITRE attack phase, target asset, mitigation urgency, compliance implication)
- **Reads analyst posture** (operational urgency + stance + assertion confidence — replaces "sentiment" in security context)
- **Optionally emits conversational sentiment** (skip-if-neutral, deterministic local model)
- **Emits every signal on the Cognitive Bus** with a full explainability trace, no raw text retained (Sacred Law #2)

- **Epistemic layer**: Perception (Linguistic Processing / Semantic Grounding)
- **Mandate**: turn multilingual text into **structured, auditable signals** + multilingual embeddings
- **Outputs**: 4 signal families (threat / posture / sentiment / language) + embeddings + cascade traces

## Charter

### Mandate

- detect the language of the incoming text (cascade: Unicode → Qdrant/Gemma → Redis cache → LLM)
- extract per-family signals via the **ISignalContributor** pattern (one contributor per concern)
- emit every signal on the bus with `extraction_trace`, `confidence`, `method_used`, `interpretation` (relative_ranking vs absolute_ground_truth)
- expose multilingual embeddings (cooperative path to api_embedding for the corpus; in-process EmbeddingGemma for language detection)
- never store raw text — every payload carries only `text_hash = sha256(text[:200])`

### Non-goals

- no business decisions (ranking and risk scoring belong to the verticals)
- no domain ontology resolution (Pattern Weavers)
- no storage governance (Vault Keepers / Memory Orders)
- no legacy `/v1/sentiment/analyze` or `/v1/emotion/detect` endpoints (retired in v3.0 — see history below)

## The four signal families (v3.0+)

```
/v1/signals/extract  →  contributors run in parallel  →  4 family payloads + bus events

┌───────────────────────────┬───────────────────────────────────────────────┐
│ Family                    │ Signals (vertical-defined, security shown)    │
├───────────────────────────┼───────────────────────────────────────────────┤
│ security_threat           │ threat_severity, exploit_imminence,           │
│ (SecBERT + LLM enum)      │ attack_surface_exposure, threat_type,         │
│                           │ attack_phase (MITRE), target_asset,           │
│                           │ mitigation_urgency, compliance_implication    │
├───────────────────────────┼───────────────────────────────────────────────┤
│ analyst_posture           │ operational_urgency (0..1),                   │
│ (LLM-as-classifier)       │ analyst_stance (enum: investigative /         │
│                           │ reactive / exploratory / validating /         │
│                           │ escalating / preventive),                     │
│                           │ assertion_confidence (0..1)                   │
├───────────────────────────┼───────────────────────────────────────────────┤
│ conversational_sentiment  │ sentiment_valence (-1..1),                    │
│ (cardiff-nlp roberta)     │ sentiment_magnitude (0..1)                    │
│                           │ — skip-if-neutral (magnitude < 0.2)           │
├───────────────────────────┼───────────────────────────────────────────────┤
│ language                  │ language_detected (ISO 639-1)                 │
│ (cascade)                 │ via Unicode → Qdrant/Gemma → cache → LLM      │
└───────────────────────────┴───────────────────────────────────────────────┘
```

Each contributor returns one or more `SignalEvidence` records. Every record carries:

- `signal_name`, `value`, `confidence`
- `extraction_trace.method` (e.g. `model:jackaduma/SecBERT`, `llm:gpt-4o-mini`, `cascade:unicode-qdrant-cache-llm`)
- `extraction_trace.interpretation` — `relative_ranking` (e.g. SecBERT pending fine-tune) or `absolute_ground_truth`
- `extraction_trace.timestamp`

Verticals declare which signals exist via YAML at `domains/<vertical>/babel_gardens/signals_<vertical>.yaml` (`SignalSchema` framework). Aicomsec ships `signals_security.yaml` with the 14 signals above.

## The language cascade (v3.1+)

Language is the 4th signal family — same plumbing as the others, no separate endpoint. The implementation is a 4-tier cascade:

```
Tier A — Unicode script        <1 ms   30 langs with unique scripts
Tier B — Qdrant semantic     ~20 ms   embeds via in-process EmbeddingGemma,
                                       searches `language_samples` collection,
                                       weighted majority vote over top-5
                                       hits with 0.1 margin guard
Tier C — Redis cache          <1 ms   text_hash → ISO 639-1, 24h TTL
Tier D — LLM fallback       150 ms   gpt-4o-mini, JSON mode, terminating
                                       guarantee (always returns a valid code)
```

Runtime order: cache → unicode → qdrant → llm. The cascade always terminates with a valid ISO 639-1 code; `auto` / `null` / `unknown` are explicitly rejected (per `docs/foundational/VITRUVYAN_OVERVIEW.md:140`).

`extraction_trace.cascade_trace` records every tier attempted, the score, the elapsed_ms, and which tier won (`method_used`).

`extraction_trace.embedding_model` reports the actually-loaded multilingual model (Gemma, or the MiniLM/mpnet fallback when the gated repo isn't accessible).

## Phase 0 — how the chat consumes signals

The chat orchestrator (`/run/stream`) runs `POST /v1/signals/extract` as Phase 0, before any LangGraph node. The response populates the LangGraph state:

- `state["language_detected"]` ← language signal value
- `state["analyst_posture"]` ← posture signals dict
- `state["security_signals"]` ← threat signals dict
- `state["sentiment"]` ← sentiment signals (may be empty if skip-if-neutral fired)

Downstream nodes never re-detect; they consume from state. `compose_node` adapts response tone (urgent + reactive → action-first; exploratory → didactic). The chat synthesis picks the right prompt template via `PromptRegistry.get_lang_instruction(language_detected)`.

Phase 0 budget: ~6-7s wall-clock when contributors are cold; <50ms when results are cached. Non-fatal on failure — if Babel is unreachable the graph runs with `signals=None` and falls back to default behavior.

## Event contract (Cognitive Bus)

Canonical channels (declared in `vitruvyan_core/core/cognitive/babel_gardens/events/__init__.py`):

| Channel | Emitter | Consumer | Purpose |
|---|---|---|---|
| `babel.signals.extracted` | `/v1/signals/extract` (per family + contributor) | `signal_observations` (Babel persister) | One row per `(text_hash, family, contributor)`; UPSERT-merge |
| `babel.signals.fused` | `/v1/signals/extract` (once per request) | (free) | Aggregate summary — wire telemetry sinks here |

Legacy channels (`babel.sentiment.*`, `babel.emotion.*`, `babel.linguistic.*`) remain declared for compatibility but are no longer emitted. The retired `/v1/emotion/detect` HTTP endpoint and `babel_emotion` LangGraph node were removed in v3.0.

Every event payload carries:

- `text_hash` (sha256 of text[:200]) — Sacred Law #2 compliance, never raw text
- `correlation_id`, `tenant_id`
- `signal_family`, `contributor`, `signals[]`
- `timestamp` (UTC ISO 8601)

## Persistence — `signal_observations`

The Babel persister (`signal_observations_persister`, container `aicomsec_babel_signal_observations`) consumes `babel.signals.extracted` and upserts into PostgreSQL:

```
signal_observations
  text_hash, signal_family, contributor       — unique key (UPSERT-merge)
  signals (jsonb)                              — latest values
  payload (jsonb)                              — full event envelope
  correlation_id, tenant_id
  occurrences                                  — incremented on repeat
  first_seen_at, last_seen_at
```

The persister drains its PEL (Pending Entries List) on startup via `StreamBus.drain_pel()`, so messages stuck pending after a crash or restart are re-processed before normal consumption resumes. Same pattern is applied to the Pattern Weavers ontology persister.

## Code map

### LIVELLO 1 (pure, no I/O) — `vitruvyan_core/core/cognitive/babel_gardens/`

- `domain/signal_schema.py` — `SignalSchema` (enum + multi-enum support), `SignalConfig.from_yaml`, `enum_values_source` resolver for long enums (ISO 639-1 etc.)
- `domain/__init__.py` — re-exports `load_config_from_yaml` from `signal_schema` (canonical SignalConfig with `.signals` and `.get_signal()`)
- `events/__init__.py` — bus channel constants
- `signal_observations_persister.py` — standalone persister entry point
- `philosophy/charter.md` — Sacred Order charter (sanitized of vertical model names in v3.0)

### LIVELLO 2 (service + adapters) — `services/api_babel_gardens/`

- `main.py` — FastAPI lifespan: HuggingFace login process-wide, eager preload of `gemma_multilingual`, signal contributor registration (gated on `BABEL_DOMAIN=security`)
- `api/routes_signals.py` — `POST /v1/signals/extract` (contributors run via `asyncio.to_thread` + `asyncio.gather`)
- `api/routes_embeddings.py` — `/v1/embeddings/create`, `/v1/embeddings/multilingual`, `/v1/embeddings/gemma` (direct EmbeddingGemma wrapper, used by the language sample seed script)
- `plugins/secbert_contributor.py` — SecBERT model wrapping (threat signals, numeric)
- `plugins/security_threat_enums_contributor.py` — LLM-as-classifier for the 5 enum threat signals
- `plugins/analyst_posture_contributor.py` — LLM-as-classifier for the 3 posture signals
- `plugins/sentiment_contributor.py` — cardiffnlp roberta (deterministic, local)
- `plugins/language_contributor.py` — language cascade (Unicode → Qdrant/Gemma → cache → LLM)
- `shared/model_manager.py` — singleton model loader; `gemma_multilingual` alias resolves `google/embeddinggemma-300m` (with MiniLM/mpnet fallback when the gated repo isn't accessible)

### Vertical schemas — `vitruvyan_core/domains/security/babel_gardens/`

- `signals_security.yaml` — the 14 signals (3 families × N signals + language)
- `security_config.py` — `ISO_639_1_CODES` constant (184 codes), `MITIGATION_URGENCY_ORDINAL`, cascade thresholds, LLM model names, fusion weights
- `language_samples.yaml` — 150 phrases × 15 languages, seed dataset for the Qdrant Tier B step

## Verticalization

A new vertical binds Babel Gardens by providing:

- a **signal schema YAML** at `vitruvyan_core/domains/<vertical>/babel_gardens/signals_<vertical>.yaml` (defines families + per-signal value_type + enum_values_source)
- a **vertical_config.py** (model names, cascade thresholds, fusion weights, enum constants)
- (optional) **service plugins** under `services/api_babel_gardens/plugins/<vertical>_*.py` implementing `ISignalContributor`

The Charter rule still holds: **the schema lives in the vertical**, not in the Babel Gardens core. The core stays domain-agnostic. Verticals just plug.

## Version history

- **v3.2 (May 2026)** — `signal_observations_persister` (closes the propriocezione loop), `StreamBus.drain_pel()` safety net, `babel_emotion` graph node retired, `domain/__init__.py` redirects `load_config_from_yaml` to `signal_schema`
- **v3.1 (May 2026)** — language as the 4th signal family, full cascade (Unicode/Qdrant/Gemma/Redis/LLM), EmbeddingGemma 300m loaded in-process, `/v1/embeddings/gemma` endpoint, `LanguageCode` enum deleted (replaced by ISO 639-1 string validation), 14 violation sites cleaned across the graph (no more `or "it"` literal fallbacks)
- **v3.0 (May 2026)** — three signal families (security_threat / analyst_posture / conversational_sentiment), Phase 0 wiring in `/run/stream`, parallel contributors, `/v1/sentiment/analyze` and `/v1/emotion/detect` HTTP endpoints retired, FinBERT references removed from core (was finance-vertical leftover; replaced with deterministic SecBERT + LLM enum classifier for the security vertical)
- **v2.1 (Feb 2026)** — `SignalSchema` abstraction, removed hardcoded sentiment/emotion in core
- **v2.0 (Feb 2026)** — SACRED_ORDER_PATTERN refactoring, domain-agnostic
- **v1.0 (Nov 2025)** — initial implementation

For the architectural rationale, see [Semantic & Ontology Architecture](../architecture/SEMANTIC_ONTOLOGY_ARCHITECTURE.md) and [Synaptic Conclave Philosophy](../architecture/SYNAPTIC_CONCLAVE_PHILOSOPHY.md).
