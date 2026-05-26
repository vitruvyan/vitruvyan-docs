# Epistemic Routing - Phase 0/1 Inventory

> Date: 2026-05-10
> Scope: validate Phase 0 security posture and complete Phase 1 routing inventory.

## Phase 0 - Validation

Status: partially valid, with one urgent operational action.

### Confirmed

- `.env` is ignored by git. `git status --ignored` reports it as ignored, not tracked.
- `infrastructure/docker/.env` is also ignored.
- `.gitignore` contains root `.env`, `.env.local`, `.env.*.local`, `infrastructure/docker/.env`, and local Keycloak/oauth env files.
- `.pre-commit-config.yaml` exists and is installable through `make dev`.
- GitHub architectural guardrails exist in `.github/workflows/architectural-guardrails.yml`.

### Not yet sufficient

- The currently selected IDE context exposes an OpenAI API key. Treat it as compromised and rotate it.
- A hidden/ignored scan finds key-like patterns in:
  - `.env`
  - `infrastructure/docker/.env`
  - `docs/VITRUVYAN_CORE_TECHNICAL_MAP.md`
  - `ui/UI_MOCK_TESTING.md`
- The docs/UI hits appear to be placeholder/mock examples, but the env-file hits are operational secrets.
- Pre-commit currently covers formatting, YAML/JSON checks, merge conflicts, large files, debug statements, Ruff, Black, and import-boundary checks. It does not currently run a dedicated secret scanner.
- CI architectural guardrails run pytest architectural checks. They do not currently run a dedicated secret scanner.

### Phase 0 follow-ups

1. Rotate the exposed OpenAI key.
2. Add a secret scanner to pre-commit, for example `detect-private-key` plus `detect-secrets` or `gitleaks`.
3. Add a CI secret-scan job on pull requests.
4. Keep `.env` and `infrastructure/docker/.env` ignored; do not move real values into tracked examples.

## Phase 1 - Routing Inventory

This phase documents the routing that exists today. It does not propose node removal. In Vitruvyan, LangGraph nodes are epistemic, audit, and explainability units.

## Runtime Graph

Current full graph:

```text
parse
  -> intent_detection
  -> early_exit? OR weaver
  -> entity_resolver
  -> babel_emotion
  -> semantic_grounding
  -> params_extraction
  -> decide
  -> route target
  -> output_normalizer
  -> orthodoxy
  -> vault
  -> compose
  -> can
  -> advisor? OR END
```

Core route targets from `decide`:

| `state["route"]` | Target node | Notes |
| --- | --- | --- |
| `semantic_fallback` | `qdrant` | Semantic RAG fallback. |
| `dispatcher_exec` | `exec` | Domain execution through `ExecutionRegistry`. |
| `llm_mcp` | `llm_mcp` | MCP route target, normally selected by env switch. |
| `llm_soft` | `llm_soft` | Cached LLM soft response path. |
| `codex_expedition` | `codex_hunters` | Maintenance / Codex Hunters path. |
| domain extension route | extension target | Loaded from `domains.<domain>.graph_nodes.registry`. |

## Conditional Edges

### 1. Intent early-exit

Source: `intent_detection`.

Decision:

```text
if is_early_exit(state): early_exit
else: weaver
```

Early-exit intents are configurable through `EARLY_EXIT_INTENTS` and default to greeting/farewell/thanks/chit-chat variants. This is a true fast path: it skips the heavy graph and ends immediately after lightweight governance metadata is populated.

### 2. Decide route

Source: `decide`.

Decision source: `route_node` writes `state["route"]`; `graph_flow.route_from_decide` maps that route to a graph target.

Special behavior:

```text
if USE_MCP=1 and route == dispatcher_exec:
    target = llm_mcp
else:
    target = state["route"]
```

### 3. Codex Hunters completion

Source: `codex_hunters`.

Decision:

```text
if state["route"] == "error_handling":
    output_normalizer
else:
    END
```

This means successful Codex maintenance bypasses the normal Sacred Flow. Errors are normalized and then pass through Orthodoxy/Vault/Compose.

### 4. CAN to Advisor

Source: `can`.

Decision:

```text
if user_requests_action or can_mode == "urgent":
    advisor
else:
    END or domain post-advisor node
```

If a domain extension declares an `advisor -> post_node` edge, the default non-advisor terminal path is replaced by that post node.

### 5. Minimal graph

`build_minimal_graph()` exists separately:

```text
parse -> intent -> decide -> compose -> END
```

It is controlled by `ENABLE_MINIMAL_GRAPH=true` in `graph_runner`.

## Route Selection Logic

`route_node` priority order:

1. `Codex Hunters` trigger -> `codex_expedition`.
2. Domain direct route if intent is present in `_direct_routes`.
3. `proposed_exec` -> `dispatcher_exec`.
4. Intent in soft intent list -> `llm_soft`.
5. Intent `unknown` -> `semantic_fallback`.
6. Intent in exec intent list -> `dispatcher_exec`.
7. Fallback -> `semantic_fallback`.

Intent lists come from `IntentRegistry` route types:

| Intent route type | Operational route |
| --- | --- |
| `exec` | `dispatcher_exec` |
| `soft` | `llm_soft` |
| `semantic` | `semantic_fallback` |

Domain direct routes are loaded from graph extensions and passed into `route_node.configure()`.

## Route Values Observed

Operational routes:

- `early_exit`
- `semantic_fallback`
- `dispatcher_exec`
- `llm_mcp`
- `llm_soft`
- `codex_expedition`
- `exec_valid`
- `validation_error`
- `error_handling`
- domain extension route values

Intermediate/staging route values:

- `intent_detection`
- `params_extraction`
- `compose`
- `vault`

Codex-internal route values:

- `audit_analysis`
- `validation`
- `semantic_processing`
- `continue`
- `codex_complete`
- `error_handling`

CAN/UI route values:

- `single`
- `comparison`
- `onboarding`
- `category`
- `chat`
- any domain-provided `conversation_type`

Important distinction: after `can_node`, `state["route"]` becomes a UI/conversation route, not the original operational route. Dashboards should preserve both, e.g. `operational_route` and `can_route`.

## Fast Paths

### Existing

- `early_exit`: true fast path. Ends after intent detection.
- `llm_soft`: softer conversational path, but still goes through normal output normalization and Sacred Flow.
- MCP switch: operational fast/alternate path for execution via MCP when `USE_MCP=1`.
- Codex success path: exits directly after maintenance success.

### Not yet present

- Confidence-aware fast path.
- Grounding-aware fast path.
- Orthodoxy-aware fast path.
- Replay-aware fast path.
- Plasticity-aware fast path.

## Semantic Fallback

`semantic_fallback` routes to `qdrant_node`.

Retrieval hierarchy:

1. `user_documents`
2. `conversations_embeddings`
3. `phrases_embeddings`
4. `weave_embeddings`

Optional semantic upgrades:

- HyDE query expansion when OpenAI key is present.
- CrossEncoder reranking when available.
- RAG metrics when `RAG_METRICS=1`: faithfulness, relevance, context precision.

Current limitation: these retrieval scores are produced inside the fallback path, but they do not currently influence whether the system should choose a deeper epistemic route before execution.

## Extension Points

Domain graph extensions can provide:

- additional nodes
- additional edges
- additional route targets

Expected module:

```text
domains.<domain>.graph_nodes.registry
```

Expected factories:

- `get_<domain>_graph_nodes()`
- `get_<domain>_graph_edges()`
- `get_<domain>_route_targets()`

Core nodes cannot be overridden by extensions. Extension route targets must point to registered nodes or `END`.

## Observability Today

Graph telemetry emits:

- `graph.node.entered`
- `graph.node.completed`
- `graph.node.failed`
- `graph.route.decided`
- `graph.pipeline.completed`

Payloads include route, intent, proposed execution, node duration, and trace correlation via `trace_id` as the StreamBus `correlation_id`.

Causal event infrastructure exists separately through `CognitiveEvent`:

- `trace_id`
- `causation_id`
- `correlation_id`

Current limitation: graph telemetry does not yet emit an explicit epistemic routing decision, routing score, or routing reasons.

## Phase 1 Findings

### A. Routing already existing

- Intent routing via `IntentRegistry`.
- Proposed execution routing via `proposed_exec`.
- Domain direct routes through graph extensions.
- Semantic fallback routing.
- MCP execution switch.
- Codex Hunters maintenance route.
- CAN to Advisor conditional route.
- Minimal graph alternative.

### B. Adaptive routing partial

- Early-exit fast path.
- State-based CAN/Advisor branch.
- Environment-driven MCP branch.
- Domain extension route targets.
- Semantic RAG cascade inside fallback.
- Codex success/error branch.

### C. Epistemic routing not implemented yet

- No `epistemic_router` node.
- No stable `operational_route` preservation after CAN.
- No confidence-aware route choice.
- No grounding-aware route choice.
- No Orthodoxy-aware pre-routing.
- No Veritas/VEE confidence integration into graph path selection.
- No causal replay-aware routing.
- No plasticity/metacognition-aware routing.
- No dashboard-ready `routing_reasons` payload.

## Recommended Phase 2 Inputs

Before implementation, collect and normalize these fields:

- `intent_confidence`
- `language_confidence`
- `emotion_confidence`
- `entity_resolution_confidence`
- `weave_confidence`
- `ontology_payload.gate.confidence`
- `ontology_payload.complexity`
- `semantic_matches[0].score`
- `semantic_matches[0].quality`
- `rag_eval.faithfulness`
- `rag_eval.relevance`
- `rag_eval.context_precision`
- `orthodoxy_confidence`
- `orthodoxy_findings`
- `orthodoxy_verdict`
- `confidence_report.overall`
- `confidence_report.requires_deliberation`
- `metacognition_snapshot.is_drifting`
- Plasticity outcome trend by route/intent/domain

These should feed the next design artifact: `EpistemicRoutingDecision`.
