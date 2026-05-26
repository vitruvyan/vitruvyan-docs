# Epistemic Routing — Phase 3: Gap Implementation Design

> **Last updated**: May 10, 2026 — 15:00 UTC  
> **Scope**: Concrete design for closing the gaps identified in Phase 2. Covers contracts, node logic, `graph_flow.py` wiring, state schema additions, and telemetry. Does NOT remove or simplify existing nodes.  
> **Prerequisite**: Phase 2 signal inventory complete.

## Implementation Status

Phase 3 design is now **implemented in Phase 4**:

- `BaseGraphState` includes the epistemic routing fields and preserves `operational_route`.
- `cognitive_node` is wired between `params_extraction` and `epistemic_router`.
- `epistemic_router_node` exists as a pure LIVELLO 1 decision node and emits telemetry.
- `qdrant_node` has an optional feature-flagged `RAG_QUALITY_GATE`.
- `route_node` remains the operational router; `epistemic_router` controls path depth.

---

## Design Principles (from copilot-instructions.md)

1. LangGraph nodes are epistemic, audit, and explainability units — never remove them.
2. `epistemic_router` adds path depth control — `route_node` remains as the operational router.
3. All scoring logic is LIVELLO 1 (pure Python, no I/O).
4. I/O-requiring signals (cross-session orthodoxy history, plasticity store) are injected via callbacks at boot — same pattern as `cognitive_node.configure()`.
5. New fields added to `BaseGraphState` — not to domain-specific `GraphState` only.

---

## Architecture Overview

### Current pipeline (implemented Phase 4)

```
parse → intent_detection → [early_exit] → weaver → entity_resolver
      → babel_emotion → semantic_grounding → params_extraction
      → decide (route_node) → route targets → output_normalizer
      → orthodoxy → vault → compose → can → [advisor] → END
```

### Target pipeline (after Phase 3)

```
parse → intent_detection → [early_exit] → weaver → entity_resolver
      → babel_emotion → semantic_grounding → params_extraction
    → cognitive → epistemic_router → decide (route_node)
    → [route targets]
      → output_normalizer → orthodoxy → vault → compose → can → [advisor] → END
                                                   ↑
                              [soft gate / hard gate — Phase 4]
```

### What changes

| Component | Change |
|-----------|--------|
| `cognitive_node` | Wire into `build_graph()` — between `params_extraction` and new `epistemic_router` | ✅ Implemented |
| `epistemic_router_node` | New LIVELLO 1 node — pure scoring + path selection | ✅ Implemented |
| `graph_flow.py` | Add two nodes, modify edges, add conditional from `epistemic_router` | ✅ Implemented |
| `BaseGraphState` | Add 6 new fields for epistemic routing signals | ✅ Implemented (expanded to 10 routing fields) |
| `instrumentation.py` | Add 3 new channel emitters | ✅ Implemented |
| `channels.py` | Declare 3 new channel constants | ✅ Implemented |

---

## Gap 1 — Wire `cognitive_node` into `build_graph()`

**File**: `vitruvyan_core/core/orchestration/langgraph/graph_flow.py`

This is the highest-priority change. It unlocks `confidence_report`, `deliberation_result`, `session_context`, `metacognition_snapshot`, `linguistic_correction` — all currently ❌ in the signal matrix.

### Required change in `graph_flow.py`

```python
# Add import (already exists in node/)
from core.orchestration.langgraph.node.cognitive_node import (
    cognitive_node,
    configure as configure_cognitive,
)

# In build_graph():
g.add_node("cognitive", _wrap("cognitive", cognitive_node))

# Replace edge:
# BEFORE: g.add_edge("params_extraction", "decide")
# AFTER:
g.add_edge("params_extraction", "cognitive")
g.add_edge("cognitive", "epistemic_router")  # cognitive feeds epistemic_router
```

### Boot-time configuration

```python
# In graph_flow.py module-level boot (alongside intent registry load):
configure_cognitive(
    session_data_fetcher=None,    # LIVELLO 2 injects this at service boot
    recent_changes_fetcher=None,
    confidence_history_fetcher=None,
    accumulated_correlations_fetcher=None,
)
```

LIVELLO 2 (`services/api_graph/main.py`) provides actual fetcher callbacks. Until then, `cognitive_node` degrades gracefully — all capabilities are behind feature flags and individual try/except.

---

## Gap 2 — `EpistemicRoutingDecision` Contract

**File**: `vitruvyan_core/contracts/epistemic_routing.py` (NEW — LIVELLO 1)

```python
"""
EpistemicRoutingDecision — Domain-agnostic contract for epistemic path selection.

Pure Python frozen dataclass. No I/O. LIVELLO 1.
Produced by epistemic_router_node, consumed by graph routing and telemetry.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class EpistemicSignals:
    """
    Normalized input signals for epistemic routing decision.

    All values are normalized to [0.0–1.0] or categorical strings.
    Missing signals are defaulted — never cause routing failure.
    """
    # Intent signals
    intent: str = "unknown"
    intent_confidence: float = 1.0         # Default: no degradation if not set
    needs_clarification: bool = False

    # Language/emotion signals
    language_confidence: float = 1.0
    emotion_intensity: str = "low"          # "low" | "medium" | "high"
    emotion_detected: str = "neutral"

    # Grounding signals (VSGS)
    grounding_top_score: float = 0.0       # 0.0 = no grounding
    grounding_match_count: int = 0
    grounding_quality: str = "none"         # "high" | "medium" | "low" | "none"
    vsgs_available: bool = False            # False = VSGS disabled/error

    # Semantic compilation (Pattern Weavers v3)
    weave_confidence: float = 1.0          # 1.0 default = no degradation if v3 off

    # Cognitive layer (populated only when cognitive_node is wired)
    overall_confidence: float = 1.0        # From confidence_report.overall
    requires_deliberation: bool = False    # From confidence_report.requires_deliberation
    deliberation_recommendation: str = ""  # "auto_select" | "user_clarify" | "escalate"
    session_depth: int = 0                 # From session_context.session_depth
    confidence_trend: str = "stable"       # "declining" | "stable" | "improving"
    confidence_drift_alert: bool = False   # From metacognition_snapshot.drift_alert

    # Cross-session (injected via LIVELLO 2 callbacks — defaults to neutral)
    historic_orthodoxy_confidence: float = 1.0
    historic_heresy_rate: float = 0.0


@dataclass(frozen=True)
class EpistemicRoutingDecision:
    """
    Output of epistemic_router_node.

    Declares path depth and provides full routing rationale
    for observability and dashboard rendering.
    """
    # Core routing outputs
    epistemic_path: str                    # "fast" | "standard" | "deep" | "governance"
    epistemic_risk_score: float            # Composite risk [0.0–1.0]
    routing_confidence: float             # Confidence in this routing decision [0.0–1.0]

    # Detailed scoring
    grounding_score: float = 0.0          # Pure grounding component
    complexity_score: float = 0.0         # Query complexity component
    orthodoxy_pressure: str = "low"       # "low" | "medium" | "high"
    required_depth: str = "normal"        # "shallow" | "normal" | "deep"

    # Observability
    routing_reasons: Tuple[str, ...] = ()  # Human-readable reasons list
    routing_inputs: Dict = field(default_factory=dict)  # Snapshot of signals used

    def to_dict(self) -> dict:
        return {
            "epistemic_path": self.epistemic_path,
            "epistemic_risk_score": round(self.epistemic_risk_score, 3),
            "routing_confidence": round(self.routing_confidence, 3),
            "grounding_score": round(self.grounding_score, 3),
            "complexity_score": round(self.complexity_score, 3),
            "orthodoxy_pressure": self.orthodoxy_pressure,
            "required_depth": self.required_depth,
            "routing_reasons": list(self.routing_reasons),
            "routing_inputs": self.routing_inputs,
        }
```

---

## Gap 3 — `epistemic_router_node` Implementation

**File**: `vitruvyan_core/core/orchestration/langgraph/node/epistemic_router_node.py` (NEW — LIVELLO 1)

### Signal collection

```python
def _collect_signals(state: dict) -> EpistemicSignals:
    """
    Normalize all available signals from state into EpistemicSignals.
    All fields default to neutral values — never raises.
    """
    semantic_matches = state.get("semantic_matches") or []
    top_match = semantic_matches[0] if semantic_matches else {}

    # Confidence report (available only if cognitive_node is wired)
    cr = state.get("confidence_report") or {}
    deliberation = state.get("deliberation_result") or {}
    session = state.get("session_context") or {}
    metacognition = state.get("metacognition_snapshot") or {}

    return EpistemicSignals(
        intent=state.get("intent", "unknown"),
        intent_confidence=state.get("intent_confidence", 1.0),
        needs_clarification=state.get("needs_clarification", False),

        language_confidence=state.get("language_confidence", 1.0),
        emotion_intensity=state.get("emotion_intensity", "low"),
        emotion_detected=state.get("emotion_detected", "neutral"),

        grounding_top_score=top_match.get("score", 0.0),
        grounding_match_count=len(semantic_matches),
        grounding_quality=top_match.get("quality", "none"),
        vsgs_available=state.get("vsgs_status") == "enabled",

        weave_confidence=state.get("weave_confidence", 1.0),

        overall_confidence=cr.get("overall", 1.0),
        requires_deliberation=cr.get("requires_deliberation", False),
        deliberation_recommendation=deliberation.get("recommendation", ""),
        session_depth=session.get("session_depth", 0),
        confidence_trend=metacognition.get("trend", "stable"),
        confidence_drift_alert=metacognition.get("drift_alert", False),
    )
```

### Composite scoring

```python
def _compute_grounding_score(signals: EpistemicSignals) -> float:
    """
    Grounding score [0.0–1.0]. Higher = better grounded.

    Zero matches = 0.0 regardless of quality.
    Combines match count and top score with quality bonus.
    """
    if signals.grounding_match_count == 0:
        return 0.0

    quality_bonus = {"high": 0.15, "medium": 0.05, "low": 0.0, "none": 0.0}
    base = signals.grounding_top_score
    bonus = quality_bonus.get(signals.grounding_quality, 0.0)
    count_factor = min(signals.grounding_match_count / 3.0, 1.0) * 0.1
    return min(base + bonus + count_factor, 1.0)


def _compute_complexity_score(signals: EpistemicSignals) -> float:
    """
    Complexity score [0.0–1.0]. Higher = more complex query.

    Proxy signals: low intent confidence, needs clarification,
    low weave confidence, high emotion intensity.
    """
    score = 0.0
    if signals.intent == "unknown":
        score += 0.35
    if signals.needs_clarification:
        score += 0.20
    if signals.intent_confidence < 0.5:
        score += 0.15
    if signals.weave_confidence < 0.4:
        score += 0.15
    if signals.emotion_intensity == "high":
        score += 0.10
    if signals.language_confidence < 0.6:
        score += 0.05
    return min(score, 1.0)


def _compute_epistemic_risk(signals: EpistemicSignals, grounding: float, complexity: float) -> float:
    """
    Composite epistemic risk [0.0–1.0].

    Inputs:
      - grounding: computed grounding score
      - complexity: computed complexity score
      - cognitive signals (if available)
      - orthodoxy history (if available via callbacks)

    Weights (sum to 1.0):
      grounding deficit:   0.30
      complexity:          0.25
      low confidence:      0.20
      deliberation flag:   0.15
      orthodoxy pressure:  0.10
    """
    risk = 0.0

    # Grounding deficit
    risk += (1.0 - grounding) * 0.30

    # Complexity
    risk += complexity * 0.25

    # Confidence deficit (from cognitive_report, or intent_confidence fallback)
    effective_confidence = signals.overall_confidence if signals.overall_confidence < 0.99 else signals.intent_confidence
    risk += (1.0 - effective_confidence) * 0.20

    # Deliberation flag
    if signals.requires_deliberation:
        risk += 0.15
    if signals.confidence_drift_alert:
        risk += 0.10  # bonus risk for drift

    # Orthodoxy pressure (historic)
    risk += signals.historic_heresy_rate * 0.10

    return min(risk, 1.0)


def _compute_orthodoxy_pressure(signals: EpistemicSignals, risk: float) -> str:
    """Classify orthodoxy pressure from risk and historic signals."""
    if risk >= 0.70 or signals.historic_heresy_rate > 0.3:
        return "high"
    if risk >= 0.40 or signals.historic_orthodoxy_confidence < 0.6:
        return "medium"
    return "low"


def _select_path(
    risk: float,
    signals: EpistemicSignals,
    orthodoxy_pressure: str,
) -> tuple[str, list[str]]:
    """
    Select epistemic path and collect routing reasons.

    Returns: (path, reasons)

    Paths:
      fast:       risk < 0.15, no deliberation, no drift, no clarification needed
      standard:   risk < 0.45, no governance trigger
      deep:       risk < 0.75 OR deliberation required OR clarification needed
      governance: risk >= 0.75 OR escalation recommended OR high orthodoxy pressure
    """
    reasons = []

    # Governance triggers (checked first — highest priority)
    if signals.deliberation_recommendation == "escalate":
        reasons.append("deliberation_recommends_escalation")
        return "governance", reasons
    if orthodoxy_pressure == "high":
        reasons.append(f"high_orthodoxy_pressure_historic_heresy={signals.historic_heresy_rate:.2f}")
        return "governance", reasons
    if risk >= 0.75:
        reasons.append(f"epistemic_risk={risk:.2f}_exceeds_governance_threshold")
        return "governance", reasons

    # Deep triggers
    if signals.requires_deliberation:
        reasons.append("confidence_report_requires_deliberation")
        return "deep", reasons
    if signals.needs_clarification:
        reasons.append("intent_detection_flagged_clarification_needed")
        return "deep", reasons
    if signals.confidence_drift_alert:
        reasons.append("metacognition_confidence_drift_alert")
        return "deep", reasons
    if signals.deliberation_recommendation == "user_clarify":
        reasons.append("deliberation_recommends_user_clarification")
        return "deep", reasons
    if risk >= 0.45:
        reasons.append(f"epistemic_risk={risk:.2f}_exceeds_deep_threshold")
        return "deep", reasons

    # Fast path (only when everything is high confidence)
    if (
        risk < 0.15
        and signals.intent != "unknown"
        and not signals.confidence_drift_alert
        and not signals.needs_clarification
        and signals.grounding_match_count >= 1
    ):
        reasons.append(f"low_risk={risk:.2f}_high_confidence_sufficient_grounding")
        return "fast", reasons

    # Standard path (default)
    reasons.append(f"epistemic_risk={risk:.2f}_standard_path")
    return "standard", reasons
```

### Node function

```python
def epistemic_router_node(state: dict) -> dict:
    """
    Epistemic path selection node.

    Reads available signals from state, computes risk scores,
    selects epistemic path depth, writes decision to state.

    Does NOT replace route_node. Sets:
      state["epistemic_path"]         — fast | standard | deep | governance
      state["epistemic_risk_score"]   — float
      state["routing_confidence"]     — float
      state["epistemic_router_signals"] — dict snapshot for dashboard
      state["routing_reasons"]        — list of human-readable reasons

    Called by graph_flow.py between cognitive and decide.
    """
    try:
        signals = _collect_signals(state)
        grounding = _compute_grounding_score(signals)
        complexity = _compute_complexity_score(signals)
        risk = _compute_epistemic_risk(signals, grounding, complexity)
        pressure = _compute_orthodoxy_pressure(signals, risk)
        path, reasons = _select_path(risk, signals, pressure)
        routing_confidence = max(0.0, 1.0 - risk)

        decision = EpistemicRoutingDecision(
            epistemic_path=path,
            epistemic_risk_score=round(risk, 3),
            routing_confidence=round(routing_confidence, 3),
            grounding_score=round(grounding, 3),
            complexity_score=round(complexity, 3),
            orthodoxy_pressure=pressure,
            required_depth="deep" if path in ("deep", "governance") else "normal",
            routing_reasons=tuple(reasons),
            routing_inputs={
                "intent": signals.intent,
                "intent_confidence": round(signals.intent_confidence, 3),
                "grounding_match_count": signals.grounding_match_count,
                "grounding_top_score": round(signals.grounding_top_score, 3),
                "overall_confidence": round(signals.overall_confidence, 3),
                "requires_deliberation": signals.requires_deliberation,
                "needs_clarification": signals.needs_clarification,
                "weave_confidence": round(signals.weave_confidence, 3),
            },
        )

        state["epistemic_path"] = decision.epistemic_path
        state["epistemic_risk_score"] = decision.epistemic_risk_score
        state["routing_confidence"] = decision.routing_confidence
        state["routing_reasons"] = list(decision.routing_reasons)
        state["epistemic_router_signals"] = decision.to_dict()

        logger.info(
            "[EPISTEMIC_ROUTER] path=%s risk=%.2f confidence=%.2f grounding=%.2f reasons=%s",
            path, risk, routing_confidence, grounding, reasons,
        )

        # Emit telemetry (non-blocking)
        _emit_epistemic_route_decided(decision, state)

    except Exception as e:
        # Routing failure is non-fatal — default to standard path
        logger.warning("[EPISTEMIC_ROUTER] Scoring failed: %s — defaulting to standard", e)
        state["epistemic_path"] = "standard"
        state["epistemic_risk_score"] = 0.5
        state["routing_confidence"] = 0.5
        state["routing_reasons"] = [f"router_error_fallback: {str(e)[:100]}"]

    return state
```

---

## Gap 4 — `graph_flow.py` Wiring Changes

### Summary of changes to `build_graph()`

**Step 1**: Add cognitive node (import at top of file):
```python
from core.orchestration.langgraph.node.cognitive_node import cognitive_node
from core.orchestration.langgraph.node.epistemic_router_node import epistemic_router_node
```

**Step 2**: Register both nodes:
```python
g.add_node("cognitive", _wrap("cognitive", cognitive_node))
g.add_node("epistemic_router", _wrap("epistemic_router", epistemic_router_node))
```

**Step 3**: Replace the `params_extraction → decide` edge:
```python
# REMOVE:
# g.add_edge("params_extraction", "decide")

# ADD:
g.add_edge("params_extraction", "cognitive")
g.add_edge("cognitive", "epistemic_router")
```

**Step 4**: Add conditional from `epistemic_router`:

```python
def route_from_epistemic(state: dict) -> str:
    """
    Translate epistemic_path to graph target.

    fast:       skip decide entirely → compose (or cached_llm for soft intents)
    standard:   normal decide (route_node)
    deep:       decide with deep context flag set
    governance: decide with governance flag set
    """
    path = state.get("epistemic_path", "standard")
    intent = state.get("intent", "unknown")

    if path == "fast" and intent not in _soft_intents:
        # Fast path for exec intents — goes directly to exec via compose shortcut
        # For now: route to decide anyway with fast flag (avoids complex rewiring)
        state["epistemic_fast"] = True
        return "decide"

    # For deep and governance paths: set flag, still go through decide
    # (Phase 4 can add dedicated deep/governance path nodes)
    if path in ("deep", "governance"):
        state["epistemic_deep"] = True
        state["orthodoxy_gate_override"] = path  # Used by orthodoxy_node Phase 4

    return "decide"


g.add_conditional_edges(
    "epistemic_router",
    route_from_epistemic,
    {"decide": "decide"},  # All paths currently converge at decide
)
```

**Note on progressive implementation**: In this Phase 3 design, all epistemic paths still converge at `decide`. The differentiation happens in:
- `fast` path: sets `epistemic_fast=True` flag (used by nodes to skip heavy computation)
- `deep`/`governance` paths: set flags consumed by `orthodoxy_node` in Phase 4 to activate higher gate levels

A dedicated `deep_decide` or `governance_gate` conditional can be added in Phase 4 without breaking Phase 3.

**Step 5**: Add nodes to `registered_nodes` set:
```python
registered_nodes.add("cognitive")
registered_nodes.add("epistemic_router")
```

---

## Gap 5 — New `BaseGraphState` Fields

**File**: `vitruvyan_core/core/orchestration/base_state.py`

Add to the tracing section:

```python
# =========================================================================
# EPISTEMIC ROUTING — Adaptive path selection (Phase 3)
# =========================================================================
epistemic_path: Optional[str]              # "fast" | "standard" | "deep" | "governance"
epistemic_risk_score: Optional[float]      # Composite risk [0.0-1.0]
routing_confidence: Optional[float]        # Confidence in routing decision [0.0-1.0]
routing_reasons: Optional[List[str]]       # Human-readable routing reasons
epistemic_router_signals: Optional[Dict[str, Any]]  # Full decision payload for dashboard
epistemic_fast: Optional[bool]             # Fast path flag (skip heavy computation)
epistemic_deep: Optional[bool]             # Deep path flag (force deeper processing)
orthodoxy_gate_override: Optional[str]     # "deep" | "governance" — override gate level
causation_id: Optional[str]               # Parent request ID (replay-aware routing)
operational_route: Optional[str]          # Preserved operational route (before CAN overwrites)
```

Also update `TRACING_FIELDS` frozenset:
```python
TRACING_FIELDS = frozenset([
    "trace_id", "semantic_matches", "vsgs_status",
    "epistemic_path", "epistemic_risk_score", "routing_confidence",
    "routing_reasons", "epistemic_router_signals",
    "causation_id", "operational_route",
])
```

---

## Gap 6 — Preserve `operational_route` Before CAN Overwrites It

**Current problem**: After `can_node` runs, `state["route"]` is overwritten with a UI/conversation route (e.g., `"single"`, `"comparison"`, `"chat"`). The original operational route (`dispatcher_exec`, `semantic_fallback`, etc.) is lost.

**Fix**: In `route_node` (or `route_from_decide`), preserve the operational route before CAN can overwrite it:

```python
# In route_node, after setting state["route"]:
state["operational_route"] = state["route"]
```

This is a one-line change to `route_node.py`. `operational_route` then survives through the entire pipeline and is available to dashboards.

---

## Gap 7 — New Telemetry Channels

**File**: `vitruvyan_core/core/orchestration/langgraph/telemetry/channels.py`

Add:
```python
EPISTEMIC_ROUTE_DECIDED = "graph.epistemic.route_decided"
EPISTEMIC_ESCALATED = "graph.epistemic.escalated"
CONFIDENCE_PROPAGATED = "graph.confidence.propagated"
```

**File**: `vitruvyan_core/core/orchestration/langgraph/telemetry/instrumentation.py`

Add three emitter functions:

```python
def on_epistemic_route_decided(decision: dict, state: dict) -> None:
    """Emit full epistemic routing decision for dashboard consumers."""
    _emit_safe(
        EPISTEMIC_ROUTE_DECIDED,
        {
            "epistemic_path": decision.get("epistemic_path"),
            "epistemic_risk_score": decision.get("epistemic_risk_score"),
            "routing_confidence": decision.get("routing_confidence"),
            "grounding_score": decision.get("grounding_score"),
            "complexity_score": decision.get("complexity_score"),
            "orthodoxy_pressure": decision.get("orthodoxy_pressure"),
            "routing_reasons": decision.get("routing_reasons", []),
            "intent": state.get("intent"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        trace_id=state.get("trace_id"),
    )


def on_epistemic_escalated(path: str, reasons: list, state: dict) -> None:
    """Emit when governance path is selected — high-priority observable event."""
    _emit_safe(
        EPISTEMIC_ESCALATED,
        {
            "path": path,
            "reasons": reasons,
            "intent": state.get("intent"),
            "epistemic_risk_score": state.get("epistemic_risk_score"),
            "user_id": state.get("user_id"),
            "tenant_id": state.get("tenant_id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        trace_id=state.get("trace_id"),
    )


def on_confidence_propagated(state: dict) -> None:
    """Emit confidence breakdown for Truth Console propagation view."""
    cr = state.get("confidence_report") or {}
    _emit_safe(
        CONFIDENCE_PROPAGATED,
        {
            "overall": cr.get("overall"),
            "requires_deliberation": cr.get("requires_deliberation"),
            "intent": cr.get("intent", {}).get("confidence"),
            "emotion": cr.get("emotion", {}).get("confidence"),
            "language": cr.get("language", {}).get("confidence"),
            "entity_resolution": cr.get("entity_resolution", {}).get("confidence"),
            "vsgs_grounding": (
                state["semantic_matches"][0]["score"]
                if state.get("semantic_matches") else 0.0
            ),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        trace_id=state.get("trace_id"),
    )
```

---

## Gap 8 — RAG Escalation Conditional (Post-Routing)

Once `qdrant_node` produces `rag_eval` with low `faithfulness`, the response should be optionally escalatable instead of flowing directly to `output_normalizer`.

**File**: `vitruvyan_core/core/orchestration/langgraph/graph_flow.py`

```python
# Replace:
# g.add_edge("qdrant", "output_normalizer")

# Add:
def route_from_qdrant(state: dict) -> str:
    """
    Post-retrieval quality gate.

    If RAG_QUALITY_GATE=1 and faithfulness < RAG_FAITHFULNESS_THRESHOLD,
    escalate to llm_soft for LLM-only fallback.
    """
    import os
    if os.getenv("RAG_QUALITY_GATE", "0") != "1":
        return "output_normalizer"

    rag_eval = (state.get("result") or {}).get("rag_eval", {})
    threshold = float(os.getenv("RAG_FAITHFULNESS_THRESHOLD", "0.4"))
    faithfulness = rag_eval.get("faithfulness", 1.0)

    if faithfulness < threshold:
        logger.info(
            "[RAG_GATE] faithfulness=%.2f < threshold=%.2f → escalating to llm_soft",
            faithfulness, threshold,
        )
        return "llm_soft"

    return "output_normalizer"

g.add_conditional_edges(
    "qdrant",
    route_from_qdrant,
    {"output_normalizer": "output_normalizer", "llm_soft": "llm_soft"},
)
```

This is feature-flagged (`RAG_QUALITY_GATE=0` by default) and does not change current behavior unless explicitly enabled.

---

## Implementation Sequence

The gaps above should be closed in this order to minimize risk:

### Step 1 — State schema (no runtime impact)
- Add new fields to `BaseGraphState` (Gap 5).
- Add `operational_route` preservation to `route_node` (Gap 6 — one line).

### Step 2 — Contracts (no runtime impact)
- Create `contracts/epistemic_routing.py` with `EpistemicSignals` and `EpistemicRoutingDecision` (Gap 2).

### Step 3 — Telemetry channels (additive, no impact)
- Add channel constants to `channels.py` (Gap 7).
- Add three emitter functions to `instrumentation.py` (Gap 7).

### Step 4 — Wire `cognitive_node` (low risk, graceful degradation)
- Add to `build_graph()` between `params_extraction` and a new edge chain (Gap 1).
- All cognitive capabilities are behind feature flags — degraded gracefully if LLM or DB unavailable.

### Step 5 — `epistemic_router_node` (new node, pure LIVELLO 1)
- Create `node/epistemic_router_node.py` with scoring logic (Gap 3).
- Wire in `build_graph()` between `cognitive` and `decide` (Gap 4).
- All paths currently converge at `decide` — zero disruption to existing routes.

### Step 6 — RAG quality gate (optional, feature-flagged)
- Add `route_from_qdrant` conditional (Gap 8).
- Default off (`RAG_QUALITY_GATE=0`).

### Step 7 — Tests
- Unit tests for `epistemic_router_node` (pure function — easy to test all four paths).
- Integration test: full graph with `cognitive_node` + `epistemic_router` wired.
- Verify all four epistemic paths produce correct `epistemic_router_signals` in state.

---

## Testing Strategy (Activity 28 from TODO list)

```python
# Unit test skeleton for epistemic_router_node

def test_fast_path():
    state = {
        "intent": "analysis",
        "intent_confidence": 0.92,
        "language_confidence": 0.98,
        "semantic_matches": [{"score": 0.85, "quality": "high", ...}],
        "vsgs_status": "enabled",
        "needs_clarification": False,
        "weave_confidence": 0.88,
    }
    result = epistemic_router_node(state)
    assert result["epistemic_path"] == "fast"
    assert result["epistemic_risk_score"] < 0.15


def test_governance_path_on_deliberation_escalate():
    state = {
        "intent": "complex_multi_intent",
        "confidence_report": {"overall": 0.28, "requires_deliberation": True},
        "deliberation_result": {"recommendation": "escalate"},
        "semantic_matches": [],
        "vsgs_status": "enabled",
    }
    result = epistemic_router_node(state)
    assert result["epistemic_path"] == "governance"
    assert "deliberation_recommends_escalation" in result["routing_reasons"]


def test_deep_path_on_zero_grounding():
    state = {
        "intent": "analysis",
        "semantic_matches": [],
        "vsgs_status": "enabled",
        "needs_clarification": False,
        "intent_confidence": 0.75,
    }
    result = epistemic_router_node(state)
    # Zero grounding → risk elevates → deep or governance
    assert result["epistemic_path"] in ("deep", "governance")


def test_router_never_raises():
    """Router failure must never break the pipeline."""
    result = epistemic_router_node({})  # empty state
    assert result["epistemic_path"] == "standard"  # graceful default
```

---

## Updated TODO List Status

| Activity | Phase | Status after Phase 3 design |
|----------|-------|------------------------------|
| 17. Posizione epistemic_router | Gap 4 | ✅ Designed — after cognitive, before decide |
| 18. Contratto EpistemicRoutingDecision | Gap 2 | ✅ Designed — contracts/epistemic_routing.py |
| 19. Scoring grounding/complexity/epistemic_risk/confidence | Gap 3 | ✅ Designed — pure functions |
| 20. Policy path: fast/standard/deep/governance | Gap 3 | ✅ Designed — _select_path() |
| 21. Collegare requires_deliberation al routing | Gap 3+4 | ✅ Designed |
| 22. Collegare Orthodoxy pressure al routing | Gap 3+4 | ✅ Designed (historic + gap for Phase 4 gate) |
| 23. Collegare VSGS/RAG grounding al routing | Gap 3+8 | ✅ Designed |
| 24. Telemetry: epistemic events | Gap 7 | ✅ Designed |
| 25. epistemic_router_node.py | Gap 3 | ✅ Ready to implement |
| 26. Wire in graph_flow.py | Gap 4 | ✅ Ready to implement |
| 27. BaseGraphState fields | Gap 5 | ✅ Ready to implement |
| 28. Tests | Testing | ✅ Skeleton designed |

**Not yet designed (Phase 4)**:
- Orthodoxy Gate Level 2 (soft gate — disclaimer injection).
- Orthodoxy Gate Level 3 (hard gate — response replacement).
- Cross-session historic signals via plasticity adapter (requires LIVELLO 2 callback).
- `causation_id` in graph state for replay-aware routing.
- Dashboard read-models for epistemic path visualization.
