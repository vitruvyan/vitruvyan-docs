---
tags:
  - cognitive
  - architecture
  - pipeline
  - admin
---

# 🧠 Cognitive Layer — Sentient Capabilities

> **Last Updated**: March 18, 2026

<p class="kb-subtitle">Seven cognitive capabilities — plus a Cognitive Discipline layer that adds reason attribution, relevance gating, soft throttling, and source-aware relation confidence — transform Vitruvyan from a classifier pipeline into an epistemic being.</p>

## What it does

The Cognitive Layer adds **self-awareness** to the LangGraph pipeline. Instead of blindly passing data through nodes, Vitruvyan now:

- **Remembers** prior interactions within a session (Working Memory)
- **Notices** spontaneous connections between entities (Active Correlation)
- **Knows** how confident it is in each classification (Confidence Gradients)
- **Deliberates** when uncertain, generating competing hypotheses (Deliberation)
- **Learns** from user corrections to improve future understanding (Linguistic Plasticity)

All seven capabilities are orchestrated by a **single LangGraph node** (`cognitive_node`) placed after `entity_resolver` and before `babel_emotion`.

## Architecture

### Pipeline position

```
parse → intent_detection → weaver → entity_resolver
  → 🧠 cognitive → babel_emotion → semantic_grounding
  → params_extraction → decide → [routes]
  → output_normalizer → orthodoxy → vault → compose
  → can → [advisor] → END
```

### Design principles

| Principle | Implementation |
|-----------|---------------|
| **Pure computation (LIVELLO 1)** | All consumers are zero-I/O. Testable standalone. |
| **Feature-flagged** | Each capability has an independent env var toggle. |
| **Callback injection** | I/O (Qdrant/PG) injected via `configure()` at boot — same as entity_resolver. |
| **Single node** | One node in the DAG, five internal handlers — minimal graph complexity. |
| **Contract-driven** | All types are frozen dataclasses in `contracts/cognition.py`. |
| **Disciplined output** | Proactive insights are relevance-gated, throttled, and priority-ordered. |

### Feature flags

| Environment Variable | Default | Effect |
|---------------------|---------|--------|
| `COGNITIVE_ENABLED` | `"1"` | Master switch for entire cognitive layer |
| `COGNITIVE_SESSION` | `"1"` | Enable Working Memory |
| `COGNITIVE_CORRELATION` | `"1"` | Enable Active Correlation |
| `COGNITIVE_CONFIDENCE` | `"1"` | Enable Confidence Gradients |
| `COGNITIVE_DELIBERATION` | `"1"` | Enable Deliberation |
| `COGNITIVE_PLASTICITY` | `"1"` | Enable Linguistic Plasticity |
| `COGNITIVE_METACOGNITION` | `"1"` | Enable Temporal Metacognition |
| `COGNITIVE_INITIATIVE` | `"1"` | Enable Autonomous Initiative |

---

## The Seven Capabilities

### 1. Working Memory (Session Continuity)

**Problem**: Without session context, every query starts from zero. Vitruvyan has no memory of what was discussed 30 seconds ago.

**Solution**: `SessionReconstructorConsumer` (Memory Orders, LIVELLO 1) rebuilds a `SessionContext` from pre-fetched session data:

- **Prior topics**: what was discussed in earlier exchanges
- **Prior entities**: which entities the user has interacted with
- **Prior intents**: the sequence of intents in this session
- **Conversation summary**: a brief summary of the most recent exchange
- **Session depth**: how many exchanges have occurred

**Consumer**: [`session_reconstructor.py`](../../../vitruvyan_core/core/governance/memory_orders/consumers/session_reconstructor.py)

**State field**: `session_context` → consumed by CAN node for narrative generation.

**I/O hook**: `configure(session_data_fetcher=...)` — LIVELLO 2 provides a callback that fetches prior conversations from Qdrant and entity relations from PostgreSQL.

---

### 2. Active Correlation (Spontaneous Discovery)

**Problem**: Vitruvyan only surfaces information the user explicitly requests. It never says "by the way, this entity you asked about is connected to another entity that just changed."

**Solution**: `discover_correlations()` compares current query entities against known relations, detecting:

- **Recent change alerts**: a related entity has recently been modified
- **Transitive relations**: two entities in the current query are connected through a third

**Consumer**: [`correlation_watcher.py`](../../../vitruvyan_core/core/cognitive/correlation_watcher.py)

**State field**: `correlation_discoveries` → CAN node renders alerts in the narrative.

**Example alert**:
> "Widget Inc (owned by Acme Corp) has recently updated its status. This may affect Acme Corp."

---

### 3. Confidence Gradients (Weighted Classification)

**Problem**: Classifiers produce bare values ("intent=greeting") without confidence signals. The system treats a 95% confident classification the same as a 51% one.

**Solution**: `aggregate_confidence()` reads all classifier outputs and builds a `ConfidenceReport`:

- **Per-classifier confidence**: intent (40% weight), entity resolution (25%), language (20%), emotion (15%)
- **Weighted overall score**: single number summarizing system confidence
- **Deliberation trigger**: if overall < 0.45 or intent is ambiguous, flags `requires_deliberation`

**Consumer**: [`confidence_aggregator.py`](../../../vitruvyan_core/core/cognitive/confidence_aggregator.py)

**State field**: `confidence_report` → read by deliberation handler and CAN node.

**Contract**: `ClassificationResult` — every classifier should eventually produce this instead of bare strings, enabling the confidence pipeline.

---

### 4. Deliberation (Multi-Hypothesis Reasoning)

**Problem**: When uncertain, Vitruvyan guesses. It picks the top classification even when alternatives are nearly as likely.

**Solution**: When `requires_deliberation` is true, the cognitive node:

1. Builds a deliberation prompt with `build_deliberation_prompt()`
2. Calls LLM (`llm.complete_json()`) for 2-3 competing interpretations
3. Processes hypotheses with `process_deliberation()`:
   - Normalizes confidence to sum to 1.0
   - Calculates **Shannon entropy** as disagreement score
   - Selects winner or recommends `user_clarify` if entropy > 0.7

**Consumer**: [`deliberation_consumer.py`](../../../vitruvyan_core/core/cognitive/deliberation_consumer.py)

**State field**: `deliberation_result` → CAN node renders ambiguity information.

**Recommendations**:

| Disagreement | Action | CAN behavior |
|-------------|--------|-------------|
| < 0.4 | `auto_select` | Proceeds with top hypothesis |
| 0.4–0.7 | `auto_select` + note | Proceeds but notes uncertainty |
| > 0.7 | `user_clarify` | Presents options to user |

---

### 5. Linguistic Plasticity (Evolving Understanding)

**Problem**: When a user corrects Vitruvyan ("no, I meant comparison not analysis"), the correction is lost. The system makes the same mistake next time.

**Solution**: Two-phase learning:

**Phase 1 — Detection**: `detect_correction()` checks for correction markers in 6 languages (en, it, es, fr, de + fallback). Returns `LinguisticCorrection` with the original and corrected intent.

**Phase 2 — Adaptation**: `propose_adaptation()` accumulates corrections over time (via LIVELLO 2 persistence). When evidence is sufficient (3+ corrections for same pattern, success rate < 85%), proposes a bounded `LinguisticAdaptation`.

Hot-reload: `PromptRegistry.update_scenario()` enables runtime prompt updates without restart.

**Consumer**: [`linguistic_plasticity.py`](../../../vitruvyan_core/core/cognitive/linguistic_plasticity.py)

**State field**: `linguistic_correction` → emitted as bus event for persistence.

**Supported languages**: English, Italian, Spanish, French, German (correction markers).

---

### 6. Temporal Metacognition (Self-Awareness Over Time)

**Problem**: Vitruvyan has no self-awareness of how its own performance is changing. It doesn't know if it's becoming less accurate over time (domain drift, novel input patterns).

**Solution**: `build_metacognition()` compares the current `ConfidenceReport` against historical snapshots (fetched from persistence via callback):

- **Per-classifier trends**: tracks confidence slope for intent, emotion, language, entity resolution
- **Drift detection**: flags classifiers with trend_slope < -0.05 over 3+ samples
- **Human-readable insight**: generates a metacognitive summary ("Confidence is declining for: intent")

**Consumer**: [`metacognition_tracker.py`](../../../vitruvyan_core/core/cognitive/metacognition_tracker.py)

**State field**: `metacognition_snapshot` → consumed by CAN node and initiative detector.

**I/O hook**: `configure(confidence_history_fetcher=...)` — LIVELLO 2 provides a callback that fetches prior confidence reports from PostgreSQL.

**Key contract**: `ConfidenceTrend` — per-classifier current vs. historical mean with linear trend slope, drift `reason`, and `reason_confidence`.

**Reason attribution** (v1.1): Each trend now includes a heuristic classification of *why* confidence is changing:

| Reason | Condition | Confidence |
|--------|-----------|------------|
| `data_sparsity` | < 3 historical samples | 0.90 |
| `conflicting_evidence` | Variance > 0.02 | 0.75 |
| `novel_input` | Current deviates > 0.3 from mean (5+ samples) | 0.70 |
| `gradual_drift` | abs(slope) > 0.05, low variance | 0.80 |
| `stable` | No anomaly detected | 0.95 |

---

### 7. Autonomous Initiative (Proactive Insight Generation)

**Problem**: Vitruvyan only responds to user queries. It never volunteers observations, even when it has accumulated enough evidence to say something useful.

**Solution**: `detect_proactive_insights()` evaluates three sources of voluntary communication:

1. **Correlation accumulation**: an entity pair keeps appearing together (3+ times) → "I've noticed X and Y keep appearing together. Want me to analyze their relationship?"
2. **Confidence drift**: metacognition detects persistent degradation → "I'm noticing a decline in my accuracy. Would corrections help me improve?"
3. **Session patterns**: recurring intent sequences suggest a workflow → "I notice you tend to follow analysis → comparison. Want me to anticipate the next step?"

**Consumer**: [`initiative_detector.py`](../../../vitruvyan_core/core/cognitive/initiative_detector.py)

**State field**: `proactive_insights` → CAN node renders as proactive observations.

**I/O hook**: `configure(accumulated_correlations_fetcher=...)` — LIVELLO 2 provides historical correlation counts.

**Quality gate**: Only insights passing all three gates are shared (`is_worth_sharing` property):

- `confidence >= 0.6`
- `evidence_count >= 2`
- `user_relevance >= 0.5`

**User relevance scoring** (v1.1): Each insight receives a `user_relevance` score (0.0–1.0) computed from 4 weighted signals:

| Signal | Weight | Source |
|--------|--------|--------|
| Entity overlap with current query | 0.30 | Current entities vs. insight entities |
| Session history overlap | 0.20 | Session entities vs. insight entities |
| Session depth | 0.20 | `depth / 10.0` (capped at 1.0) |
| Intent alignment | 0.30 | Current intent compatible with insight category |

**Category-specific floors**: `confidence_drift` insights get a minimum relevance of 0.6 (system health is always relevant), `session_pattern` gets 0.5 (user's own workflow is inherently relevant).

**Soft throttling** (v1.1): The cognitive node limits proactive output to prevent noise:

- **Max 1 insight per turn** (highest priority wins)
- **Cooldown**: 3 turns between proactive insights (`_PROACTIVE_COOLDOWN`)
- **Priority ordering**: `confidence_drift` (0) > `correlation_accumulation` (1) > `session_pattern` (2)
- **Critical bypass**: A drift with `evidence_count >= 8` bypasses cooldown (severe degradation must not be silenced)

---

## Contracts

All cognitive types are frozen dataclasses in [`contracts/cognition.py`](../../../vitruvyan_core/contracts/cognition.py):

| Contract | Purpose |
|----------|---------|
| `SessionContext` / `SessionEntity` | Working Memory output |
| `CorrelationDiscovery` | Active Correlation output |
| `ClassificationResult` | Single classifier with confidence + alternatives |
| `ConfidenceReport` | Aggregated confidence across all classifiers |
| `Hypothesis` / `DeliberationResult` | Multi-hypothesis reasoning result |
| `LinguisticCorrection` / `LinguisticAdaptation` | Plasticity input/output |
| `ConfidenceTrend` / `MetacognitionSnapshot` | Temporal self-awareness (with `reason`, `reason_confidence`) |
| `ProactiveInsight` | Autonomous initiative output (with `user_relevance`) |
| `CognitiveChannels` | Event bus channel constants (13 channels) |

---

## Bus Integration (Synaptic Conclave)

The cognitive layer emits events on dedicated channels. The bus remains **payload-blind** — these are standard `TransportEvent` envelopes.

| Channel | Trigger |
|---------|---------|
| `cognitive.session.started` | Session reconstruction begins |
| `cognitive.session.context_loaded` | Session context injected into state |
| `cognitive.correlation.discovered` | Spontaneous correlation found |
| `cognitive.confidence.aggregated` | Confidence report built |
| `cognitive.confidence.low_detected` | Confidence below threshold |
| `cognitive.deliberation.requested` | Deliberation triggered |
| `cognitive.deliberation.resolved` | Deliberation hypothesis selected |
| `cognitive.linguistics.correction_detected` | User correction detected |
| `cognitive.linguistics.adaptation_proposed` | Enough evidence for adaptation |
| `cognitive.metacognition.snapshot` | Metacognition snapshot built |
| `cognitive.metacognition.drift_detected` | Confidence drift detected |
| `cognitive.initiative.insight_ready` | Proactive insight generated |
| `cognitive.initiative.insight_shared` | Insight delivered to user |

---

## State Fields (BaseGraphState)

Seven fields added to `BaseGraphState` (March 2026):

```python
# Cognitive Layer
session_context: Optional[Dict[str, Any]]         # Working Memory
confidence_report: Optional[Dict[str, Any]]       # Confidence Gradients
deliberation_result: Optional[Dict[str, Any]]     # Deliberation
correlation_discoveries: Optional[List[Dict[str, Any]]]  # Active Correlation
linguistic_correction: Optional[Dict[str, Any]]   # Linguistic Plasticity
metacognition_snapshot: Optional[Dict[str, Any]]  # Temporal Metacognition
proactive_insights: Optional[List[Dict[str, Any]]]  # Autonomous Initiative
```

These fields survive the Sacred Orders pipeline (orthodoxy → vault → compose → can) because they are included in the UX snapshot in `graph_flow.py`.

---

## CAN Node Integration

The CAN node (`can_node.py`) reads all cognitive state to enrich its narrative:

| Cognitive Field | CAN Behavior |
|----------------|--------------|
| `session_context` | Adds "I see you were previously asking about X" context |
| `correlation_discoveries` | Inserts "By the way, Widget Inc has changed" alerts |
| `deliberation_result` | If `user_clarify`, presents "I detected ambiguity" with options |
| `confidence_report` | Available for future confidence-aware tone adjustment |
| `linguistic_correction` | Available for future explicit acknowledgment |
| `metacognition_snapshot` | If drifting, adds "SELF-AWARENESS: confidence declining (reason: conflicting_evidence)" context |
| `proactive_insights` | Renders as "PROACTIVE OBSERVATION (relevance 74%)" in narrative |

---

## File Map

### LIVELLO 1 (Pure Domain)

| File | Purpose | Lines |
|------|---------|-------|
| `vitruvyan_core/contracts/cognition.py` | All cognitive contracts | ~280 |
| `vitruvyan_core/core/cognitive/confidence_aggregator.py` | Confidence aggregation | ~120 |
| `vitruvyan_core/core/cognitive/deliberation_consumer.py` | Multi-hypothesis reasoning | ~150 |
| `vitruvyan_core/core/cognitive/correlation_watcher.py` | Spontaneous correlation | ~130 |
| `vitruvyan_core/core/cognitive/linguistic_plasticity.py` | Correction detection | ~130 |
| `vitruvyan_core/core/cognitive/metacognition_tracker.py` | Temporal self-awareness + reason attribution | ~180 |
| `vitruvyan_core/core/cognitive/initiative_detector.py` | Proactive insight detection + relevance scoring | ~220 |
| `vitruvyan_core/core/governance/memory_orders/consumers/session_reconstructor.py` | Session reconstruction | ~110 |

### LIVELLO 2 (Pipeline Integration)

| File | Changes |
|------|---------|
| `vitruvyan_core/core/orchestration/langgraph/node/cognitive_node.py` | Orchestrator node with throttling (~460 lines) |
| `vitruvyan_core/core/orchestration/base_state.py` | 7 cognitive fields + COGNITIVE_FIELDS frozenset |
| `vitruvyan_core/core/orchestration/langgraph/graph_flow.py` | Node wiring + UX snapshot |
| `vitruvyan_core/core/orchestration/langgraph/node/can_node.py` | Cognitive context injection |
| `vitruvyan_core/core/llm/prompts/registry.py` | `update_scenario()` for hot-reload |

### Tests

| File | Coverage |
|------|----------|
| `tests/unit/test_cognitive_layer.py` | 84 tests covering all contracts, consumers, node, and discipline |

---

## LIVELLO 2 Wiring (Service Boot)

The cognitive node uses the same callback pattern as `entity_resolver`:

```python
# In graph_flow.py or service entrypoint (LIVELLO 2)
from core.orchestration.langgraph.node.cognitive_node import configure

configure(
    session_data_fetcher=lambda user_id, text: pg_agent.fetch_session(user_id),
    recent_changes_fetcher=lambda entities: pg_agent.get_recent_changes(entities),
    confidence_history_fetcher=lambda user_id: pg_agent.get_confidence_history(user_id),
    accumulated_correlations_fetcher=lambda user_id: pg_agent.get_correlation_counts(user_id),
)
```

Without callbacks, Working Memory and recent-change correlation are skipped (other capabilities still function).

---

## Cognitive Discipline (v1.1)

The discipline layer adds **epistemic robustness** to the seven capabilities. Without it, the cognitive layer is powerful but uncontrolled — it doesn't know *why* its confidence is shifting, can't judge whether a proactive insight is relevant to the current user, and has no mechanism to prevent overwhelming the user with noise.

Four evolutions were introduced:

### 1. Reason Attribution (Metacognition)

Each `ConfidenceTrend` now includes a heuristic `reason` and `reason_confidence` explaining *why* confidence is changing for a given classifier.

The classification uses variance analysis and sample-count thresholds:

- **data_sparsity** (conf 0.90): fewer than 3 historical samples — too early to judge
- **conflicting_evidence** (conf 0.75): variance > 0.02 across history — noisy signal
- **novel_input** (conf 0.70): current value deviates > 0.3 from mean with 5+ samples — unseen pattern
- **gradual_drift** (conf 0.80): consistent slope > 0.05 with low variance — systematic shift
- **stable** (conf 0.95): no anomaly detected

The CAN node uses these reasons to generate actionable self-awareness context:
> "SELF-AWARENESS: confidence declining for intent (reason: conflicting_evidence)"

### 2. User Relevance Gating (Initiative)

Before v1.1, any insight with `confidence >= 0.6` and `evidence_count >= 2` was shared. This led to noise — insights about entities the user never asked about, or patterns unrelated to their current workflow.

Now each `ProactiveInsight` carries a `user_relevance` score (0.0–1.0) computed from four signals:

| Signal | Weight | Logic |
|--------|--------|-------|
| Entity overlap | 0.30 | Jaccard-like overlap between insight entities and current query entities |
| Session history | 0.20 | Overlap with all entities seen in the session |
| Session depth | 0.20 | `min(depth / 10, 1.0)` — longer sessions are more invested |
| Intent alignment | 0.30 | Category-intent compatibility (e.g., correlation insight + analytical intent → 0.8) |

The `is_worth_sharing` property now requires `user_relevance >= 0.5`. Category-specific floors ensure system-critical insights aren't killed:

- `confidence_drift` → floor 0.6 (system health is always relevant)
- `session_pattern` → floor 0.5 (user's own workflow is inherently relevant)

The CAN node displays relevance as a percentage:
> "PROACTIVE OBSERVATION (relevance 74%): Entity X and Y keep appearing together."

### 3. Soft Throttling with Critical Bypass (Orchestrator)

The cognitive node (`_apply_initiative`) now controls output volume:

- **Max 1 insight per turn** — even if multiple pass the quality gate
- **Priority ordering**: `confidence_drift` (0) > `correlation_accumulation` (1) > `session_pattern` (2)
- **Cooldown**: 3 turns between proactive insights (`_PROACTIVE_COOLDOWN`)
- **Critical bypass**: A `confidence_drift` with `evidence_count >= 8` bypasses the cooldown — severe degradation must not be silenced

This prevents the system from generating a stream of proactive observations while ensuring urgent signals break through.

### 4. Source-Aware Relation Confidence (Persistence)

Entity relations stored by Codex Hunters now carry **source-weighted confidence**:

| Source | Weight | Rationale |
|--------|--------|-----------|
| `codex` | 0.90 | Structured ingestion — high trust |
| `domain_plugin` | 0.70 | Vertical-specific extraction — medium trust |
| `llm` | 0.30 | LLM inference — low trust, needs reinforcement |
| (unknown) | 0.50 | Default fallback |

**Reinforcement formula** (ON CONFLICT upsert):
```
new_confidence = LEAST(old_confidence * 0.7 + effective_confidence * 0.3, 1.0)
```

Where `effective_confidence = raw_confidence × source_weight`.

Each relation also tracks an observation counter (`metadata.observations`), enabling future analytics on relation maturity.

This means an LLM-inferred relation starts at ~0.24 confidence (0.8 × 0.3) and requires multiple reinforcing observations to reach high confidence, while a codex-sourced relation starts at ~0.72 (0.8 × 0.9) and is immediately trustworthy.
