# Epistemic Routing — Phase 2: Signal Inventory

> **Last updated**: May 10, 2026 — 13:00 UTC  
> **Scope**: Catalog all epistemic signals currently available in the runtime state, verify runtime population status, identify which are already usable for routing and which are not yet connected.  
> **Method**: Direct source reading of `base_state.py`, `cognitive_node.py`, `confidence_aggregator.py`, `orthodoxy_node.py`, `semantic_grounding_node.py`, `qdrant_node.py`, `pw_compile_node.py`, `event_envelope.py`, `contracts/cognition.py`.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Signal populated in runtime, value confirmed in code |
| ⚠️ | Signal defined in state schema, population conditional or partial |
| ❌ | Signal designed, node exists, but node is NOT wired in `build_graph()` |
| 🔒 | Signal produced AFTER the routing decision point — not available for pre-routing |

---

## 1. Intent & Language Signals

Source nodes: `intent_detection_node`, Babel Gardens API

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `intent` | `str` | ✅ | Primary routing signal. Populated by `intent_detection_node`. |
| `intent_confidence` | `float` | ⚠️ | Set inside `intent_detection_node` if LLM returns confidence. Not always present — depends on LLM response parsing. Field not declared in `BaseGraphState`, only in `GraphState` implicitly. |
| `language_detected` | `str` | ✅ | ISO code. Populated via Babel Gardens API in `intent_detection_node`. |
| `language_confidence` | `float` | ✅ | Populated by Babel Gardens response. Preserved in `state_preserv.py`. |
| `needs_clarification` | `bool` | ⚠️ | Set by `intent_detection_node` when ambiguous. Not yet used for routing depth. |
| `clarification_reason` | `str` | ⚠️ | Set alongside `needs_clarification`. Not yet used. |

**Routing gap**: `intent_confidence` is available in the LLM response but is not consistently extracted and exposed as a clean float in state. `needs_clarification=True` does not currently trigger any path change — it reaches `compose_node` as an annotation only.

---

## 2. Emotion Signals

Source node: `babel_emotion_node` (HTTP adapter to Babel Gardens)

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `emotion_detected` | `str` | ✅ | Primary emotion label. |
| `emotion_confidence` | `float` | ✅ | Detection confidence. Preserved across Sacred Orders pipeline. |
| `emotion_intensity` | `str` | ✅ | `low / medium / high` |
| `emotion_secondary` | `str` | ⚠️ | Secondary emotion, if present. |
| `emotion_reasoning` | `str` | ⚠️ | Why this emotion was detected. |
| `babel_status` | `str` | ✅ | `success / degraded / failed / idle` |
| `emotion_sentiment_label` | `str` | ⚠️ | Sentiment from emotion module (separate from Babel main). |
| `emotion_sentiment_score` | `float` | ⚠️ | Score from emotion sentiment. |

**Routing gap**: `emotion_confidence` is available but not used for routing. High-intensity negative emotion (`frustration`, `anxiety`) could be a valid signal for the governance path — but no router reads it.

---

## 3. Semantic Grounding Signals (VSGS)

Source node: `semantic_grounding_node` → `VSGSEngine`  
Source types: `vsgs/types.py` (`GroundingResult`, `SemanticMatch`)

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `semantic_matches` | `List[Dict]` | ✅ | Top-k matches from `semantic_states` collection. Each match has `score`, `quality`, `text`, `intent`, `trace_id`. |
| `vsgs_status` | `str` | ✅ | `enabled / disabled / error / skipped` |
| `vsgs_elapsed_ms` | `float` | ✅ | Processing time. |
| `vsgs_error` | `str` | ⚠️ | Only present on error. |

**Derived metrics** (computable from existing state, not yet extracted):

| Derived metric | Formula | Notes |
|----------------|---------|-------|
| `grounding_top_score` | `semantic_matches[0]["score"] if semantic_matches else 0.0` | Best cosine similarity. Range [0.0–1.0]. |
| `grounding_match_count` | `len(semantic_matches)` | Zero = no grounding found. |
| `grounding_quality` | `semantic_matches[0]["quality"] if semantic_matches else "none"` | `high / medium / low / none` |
| `grounding_score` | Composite (see Phase 3) | Not yet computed anywhere. |

**VSGS thresholds** (from `GroundingConfig`):
- `score > 0.8` → quality `"high"`
- `score > 0.6` → quality `"medium"`
- `score <= 0.6` → quality `"low"`
- `score == 0.0` (no matches) → zero grounding = maximum epistemic risk

**Routing gap**: VSGS runs before `params_extraction` and `decide`. The grounding result is in state by the time routing happens. It is never read by `route_node`. Zero matches should trigger `semantic_fallback` or at minimum `deep_epistemic_path` — currently it does not.

---

## 4. Pattern Weavers Semantic Compilation Signals

Source node: `pw_compile_node` (active when `PATTERN_WEAVERS_V3=1`)  
Source node: `pattern_weavers_node` (v2 default, embedding-based)

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `ontology_payload` | `Dict` | ⚠️ | Full `OntologyPayload` from `/compile`. Only when `PATTERN_WEAVERS_V3=1`. |
| `weave_confidence` | `float` | ⚠️ | Gate confidence from Pattern Weavers compilation. Range [0.0–1.0]. Set to `0.0` on fallback. |
| `weaver_context` | `Dict` | ⚠️ | Semantic context produced by v2 node. |

**From `ontology_payload`** (when v3 active):
- `ontology_payload["gate"]["confidence"]` — compilation confidence gate
- `ontology_payload["gate"]["verdict"]` — `pass / warn / block`
- `ontology_payload["matched_concepts"]` — list of matched ontology concepts
- `ontology_payload["complexity"]` — query complexity score (not explicitly defined in code found, but referenced in design docs)

**Routing gap**: `weave_confidence` is written to state by `pw_compile_node` before `params_extraction`. Route node never reads it. A `weave_confidence < 0.3` or `gate.verdict == "block"` should trigger a deeper epistemic path.

---

## 5. RAG Retrieval Quality Signals

Source node: `qdrant_node` (only active when route is `semantic_fallback`)

| State field path | Type | Status | Notes |
|-----------------|------|--------|-------|
| `result["rag_eval"]["faithfulness"]` | `float` | ⚠️ | Only when `RAG_METRICS=1`. LLMRAGEvaluator. |
| `result["rag_eval"]["relevance"]` | `float` | ⚠️ | Only when `RAG_METRICS=1`. |
| `result["rag_eval"]["context_precision"]` | `float` | ⚠️ | Only when `RAG_METRICS=1`. |

**Architecture note**: RAG eval is produced **inside the semantic_fallback route**, meaning it is only available **after** routing is decided. These signals cannot influence pre-routing decisions — they can only influence post-retrieval processing (e.g., whether to escalate from qdrant to a deeper path via an additional conditional edge).

**Routing gap**: No conditional edge exists from `qdrant` back to a deeper path based on low RAG metrics. Low `faithfulness` (< 0.4) should trigger escalation — currently the result flows directly to `output_normalizer` regardless of quality.

---

## 6. Orthodoxy Wardens Signals

Source node: `orthodoxy_node`  
Layer: LIVELLO 1 consumers (Confessor → Inquisitor → VerdictEngine)

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `orthodoxy_verdict` | `str` | ✅ 🔒 | `blessed / purified / non_liquet / heretical`. Set after `vault`. |
| `orthodoxy_confidence` | `float` | ✅ 🔒 | Tribunal confidence [0.0–1.0]. |
| `orthodoxy_findings` | `int` | ✅ 🔒 | Number of detected heresies. |
| `orthodoxy_should_send` | `bool` | ✅ 🔒 | Whether response should be sent. Currently always True (gate informativo). |
| `orthodoxy_status` | `str` | ✅ 🔒 | Mirrors verdict. |
| `orthodoxy_message` | `str` | ✅ 🔒 | Human-readable verdict explanation. |
| `orthodoxy_timestamp` | `str` | ✅ 🔒 | ISO timestamp of audit. |
| `orthodoxy_duration_ms` | `float` | ✅ 🔒 | Audit latency. |
| `orthodoxy_what_we_know` | `tuple` | ⚠️ 🔒 | Only present when `non_liquet`. |
| `orthodoxy_what_is_uncertain` | `tuple` | ⚠️ 🔒 | Only present when `non_liquet`. |
| `orthodoxy_ruleset_version` | `str` | ✅ 🔒 | Ruleset version used. |

**Current gate level**: Informativo (Level 1 of 3). Response is NEVER blocked. Verdict is metadata only.  
**Planned gates**: Soft (Level 2 — disclaimer injection), Hard (Level 3 — response replacement/refusal).

**Cross-session signals** (via `plasticity_adapter`):
- Orthodoxy records each verdict to plasticity store (non-blocking, fire-and-forget).
- Historical `orthodoxy_confidence` per user/tenant is computable from plasticity store but not currently exposed as a routing signal.

**Routing gap**: Orthodoxy runs **after** routing and **after** compose. Its verdict has no effect on routing. Cross-session `historic_heresy_rate` and `historic_orthodoxy_confidence` are not exposed as pre-routing inputs. Gate Level 2 and 3 are not implemented.

---

## 7. Cognitive Layer Signals

Source node: `cognitive_node` (March 17, 2026)  
**CRITICAL STATUS**: Node is implemented but **NOT registered in `build_graph()`**. All signals below are unreachable in the current runtime.

### 7.1 Confidence Gradients

Source: `confidence_aggregator.py` → called by `cognitive_node._apply_confidence()`

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `confidence_report` | `Dict` | ❌ | Full `ConfidenceReport.to_dict()`. Contains `overall`, `requires_deliberation`, per-classifier scores. |
| `confidence_report["overall"]` | `float` | ❌ | Weighted mean of intent (0.40), entity (0.25), language (0.20), emotion (0.15). |
| `confidence_report["requires_deliberation"]` | `bool` | ❌ | True when `overall < 0.45` (DELIBERATION_THRESHOLD). |
| `confidence_report["intent"]["confidence"]` | `float` | ❌ | Intent classifier confidence. |
| `confidence_report["intent"]["alternatives"]` | `list` | ❌ | Alternative intents with scores. |
| `confidence_report["intent"]["is_ambiguous"]` | `bool` | ❌ | True when top alternative within 0.15 of primary. |

**Weights** (from `confidence_aggregator.py`):
```python
_WEIGHTS = {"intent": 0.40, "emotion": 0.15, "language": 0.20, "entity_resolution": 0.25}
DELIBERATION_THRESHOLD = 0.45
```

### 7.2 Deliberation

Source: `deliberation_consumer.py` → called by `cognitive_node._apply_deliberation()`  
Triggered when: `confidence_report["requires_deliberation"] == True`

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `deliberation_result` | `Dict` | ❌ | `DeliberationResult.to_dict()` |
| `deliberation_result["selected"]["interpretation"]` | `str` | ❌ | Best interpretation selected. |
| `deliberation_result["selected"]["confidence"]` | `float` | ❌ | Selected hypothesis confidence. |
| `deliberation_result["disagreement_score"]` | `float` | ❌ | Entropy of confidence distribution [0.0–1.0]. |
| `deliberation_result["recommendation"]` | `str` | ❌ | `auto_select / user_clarify / escalate` |
| `deliberation_result["is_contested"]` | `bool` | ❌ | True when `disagreement_score > 0.4` |

### 7.3 Working Memory

Source: `session_reconstructor.py` → called by `cognitive_node._apply_working_memory()`

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `session_context` | `Dict` | ❌ | `SessionContext` serialized. |
| `session_context["session_depth"]` | `int` | ❌ | Number of prior exchanges in this session. |
| `session_context["prior_intents"]` | `list` | ❌ | Prior intent history. |
| `session_context["prior_topics"]` | `list` | ❌ | Prior topics. |

### 7.4 Temporal Metacognition

Source: `metacognition.py` → called by `cognitive_node._apply_metacognition()`

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `metacognition_snapshot` | `Dict` | ❌ | Serialized `MetacognitionSnapshot`. |
| `metacognition_snapshot["is_drifting"]` | `bool` | ❌ | True if confidence declining over time. |
| `metacognition_snapshot["trend"]` | `str` | ❌ | `declining / stable / improving` |
| `metacognition_snapshot["drift_alert"]` | `bool` | ❌ | Urgent signal — confidence drop detected. |

### 7.5 Linguistic Plasticity

Source: `linguistic_plasticity.py` → called by `cognitive_node._apply_plasticity()`

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `linguistic_correction` | `Dict` | ❌ | `LinguisticCorrection` if user is correcting the system. |

---

## 8. Causal Chain Signals

Source: `CognitiveEvent` (`event_envelope.py`)

| Field | Layer | Status | Notes |
|-------|-------|--------|-------|
| `trace_id` | `BaseGraphState` | ✅ | Root of causal tree. Used as `correlation_id` in StreamBus telemetry. |
| `causation_id` | `CognitiveEvent` | ⚠️ | Exists in `CognitiveEvent` but **NOT in `BaseGraphState`**. Not propagated through graph state. |
| `correlation_id` | `CognitiveEvent` | ⚠️ | Same — exists at bus level, not in graph state. |

**Gap**: `trace_id` is in state and is used as bus `correlation_id`. But `causation_id` (which request caused this one) and `correlation_id` (session grouping) are available in `CognitiveEvent` but never surfaced in graph state. A replay-aware router would need `causation_id` to know "this is a retry of a previous failed request."

---

## 9. Veritas / VEE Signals

| State field | Type | Status | Notes |
|-------------|------|--------|-------|
| `veritas_confidence` | `Dict` | ⚠️ | Declared in `GraphState`. Not populated by any currently wired node. |

VEE (Vitruvyan Explainability Engine) is domain-specific (finance vertical). In `vitruvyan-core`, VEE is not wired. `veritas_confidence` is a reserved state slot for future integration.

---

## 10. Telemetry Signals (Already on Bus)

Source: `instrumentation.py` — emitted on Cognitive Bus (Redis Streams)

| Channel | Payload fields | Status |
|---------|---------------|--------|
| `graph.node.entered` | `node`, `timestamp`, `trace_id` | ✅ |
| `graph.node.completed` | `node`, `duration_ms`, `timestamp`, `trace_id` | ✅ |
| `graph.node.failed` | `node`, `duration_ms`, `error_type`, `error_msg`, `trace_id` | ✅ |
| `graph.route.decided` | `intent`, `route`, `proposed_exec`, `timestamp`, `trace_id` | ✅ |
| `graph.pipeline.completed` | `duration_ms`, `nodes_traversed`, `route`, `trace_id` | ✅ |

**Missing channels** (needed for epistemic observability):

| Channel | Purpose |
|---------|---------|
| `graph.epistemic.route_decided` | Emit `epistemic_route`, `epistemic_risk_score`, `routing_confidence`, `routing_reasons` |
| `graph.epistemic.escalated` | When governance path is selected |
| `graph.confidence.propagated` | Full `confidence_report` with per-classifier breakdown |
| `graph.orthodoxy.intervened` | When orthodoxy verdict is non-blessed |
| `graph.grounding.missed` | When zero VSGS matches found |

---

## 11. Signal Availability Matrix

This table answers: "Which signals are available to a router placed between `params_extraction` and `decide`?"

| Signal | Available pre-routing? | Source node | Reliable? |
|--------|----------------------|------------|----------|
| `intent` | ✅ Yes | `intent_detection` | High |
| `intent_confidence` | ⚠️ Conditional | `intent_detection` | Medium — parsing dependent |
| `language_detected` | ✅ Yes | `intent_detection` | High |
| `language_confidence` | ✅ Yes | `intent_detection` | High |
| `emotion_detected` | ✅ Yes | `babel_emotion` | High |
| `emotion_confidence` | ✅ Yes | `babel_emotion` | High |
| `emotion_intensity` | ✅ Yes | `babel_emotion` | High |
| `semantic_matches` | ✅ Yes | `semantic_grounding` | Medium — requires VSGS enabled |
| `vsgs_status` | ✅ Yes | `semantic_grounding` | High |
| `grounding_top_score` | ✅ Computable | Derived from `semantic_matches` | High |
| `weave_confidence` | ⚠️ Conditional | `pw_compile_node` (v3 only) | Medium |
| `needs_clarification` | ✅ Yes | `intent_detection` | Medium |
| `confidence_report` | ❌ Not wired | `cognitive_node` (unwired) | — |
| `deliberation_result` | ❌ Not wired | `cognitive_node` (unwired) | — |
| `session_context` | ❌ Not wired | `cognitive_node` (unwired) | — |
| `metacognition_snapshot` | ❌ Not wired | `cognitive_node` (unwired) | — |
| `orthodoxy_confidence` | 🔒 Post-routing | `orthodoxy_node` | High |
| `rag_eval` | 🔒 Post-routing (inside fallback path) | `qdrant_node` | Medium |
| `causation_id` | ⚠️ Not in state | `CognitiveEvent` only | — |
| `veritas_confidence` | ❌ Not populated | Not wired | — |

---

## 12. Immediate Unlocks — Zero New Code Required

The following signals are **already computable from existing state** without wiring `cognitive_node`:

```python
# In a future epistemic_router_node, these are immediately readable:

grounding_score = (
    state["semantic_matches"][0]["score"]
    if state.get("semantic_matches")
    else 0.0
)

grounding_count = len(state.get("semantic_matches") or [])

grounding_quality = (
    state["semantic_matches"][0]["quality"]
    if state.get("semantic_matches")
    else "none"
)

intent_is_ambiguous = state.get("needs_clarification", False)

weave_confidence = state.get("weave_confidence", 1.0)  # 1.0 default = no degradation if v3 off

emotion_intensity = state.get("emotion_intensity", "low")

vsgs_is_disabled = state.get("vsgs_status") in ("disabled", "error", "skipped")
```

These alone are sufficient to implement `fast_path` vs `standard_path` routing (Phase 3).

---

## 13. Signals Requiring `cognitive_node` to be Wired (Phase 4)

Once `cognitive_node` is added to `build_graph()`, the following become available:

| Signal | Unlocks |
|--------|---------|
| `confidence_report["overall"]` | Confidence-aware path selection |
| `confidence_report["requires_deliberation"]` | Automatic deliberation trigger |
| `confidence_report["intent"]["is_ambiguous"]` | Ambiguity detection |
| `deliberation_result["recommendation"]` | `escalate` → governance path |
| `session_context["session_depth"]` | Session-aware routing |
| `metacognition_snapshot["is_drifting"]` | Drift-aware path deepening |
| `metacognition_snapshot["trend"]` | Longitudinal confidence signal |

---

## 14. Phase 2 Findings

### Confirmed population in runtime (pre-routing available)
- Intent, language, emotion signals: all populated and reliable.
- VSGS grounding signals: reliable when `VSGS_ENABLED=1`.
- `weave_confidence`: available when `PATTERN_WEAVERS_V3=1`.
- `needs_clarification`: present but unused for routing.

### Built but not wired
- `cognitive_node` with all cognitive capabilities (confidence, deliberation, metacognition, plasticity, working memory).
- This is the single largest gap. All cognitive signals are ❌ in the matrix above because this one node is missing from `build_graph()`.

### Post-routing signals not yet retroactive
- Orthodoxy confidence: produced after routing, not fed back.
- RAG eval metrics: produced inside `semantic_fallback` route, not escaping back.
- No conditional edge from `qdrant` for low-quality retrieval escalation.

### Missing state fields
- `causation_id` / `correlation_id` not in `BaseGraphState` — replay-aware routing not possible without adding them.
- `epistemic_risk_score`, `epistemic_path`, `routing_confidence`, `routing_reasons` — not declared anywhere. Must be added.

### Missing telemetry channels
- No `graph.epistemic.*` channels.
- No confidence propagation events.
- Existing `graph.route.decided` payload does not include routing confidence or reasons.

---

## Next Step: Phase 3

Phase 3 will design:
1. `EpistemicRoutingDecision` contract (pure dataclass, LIVELLO 1).
2. `epistemic_router_node` — scoring logic and path selection.
3. `graph_flow.py` wiring changes.
4. New `BaseGraphState` fields.
5. New telemetry event definitions.
