# Pipeline Fixes & Improvements Roadmap
> **Last updated**: Mar 16, 2026 09:35 UTC

**Status**: ✅ ALL FIXES IMPLEMENTED & DEPLOYED

Every item in this document was **verified against source code before implementation** to confirm the gap was real and not already solved.

---

## Pre-Flight Verification Summary

Before writing a single line of code, the following claims were verified:

| Claimed Gap | Code Exists? | Was Wired? | Verification |
|---|---|---|---|
| `_previous_*` in CAN node | ✅ set in `graph_runner.py` L160-166 | ❌ `can_node.py` has 0 reads | Verified by `grep _previous can_node.py` → empty |
| Multi-turn in `llm_soft` route | N/A | ❌ `cached_llm_node.py` has 0 prior-context reads | Verified by `grep _previous cached_llm_node.py` → empty |
| PW `qdrant_connected: false` | ✅ `check_qdrant_health()` exists | ❌ calls `list_collections()` — method doesn't exist on `QdrantAgent` | Verified by `grep "def " qdrant_agent.py` — no `list_collections` |
| PG pool exhaustion | ✅ `POSTGRES_POOL_MAX` env var in `postgres_agent.py` | ❌ not set in `docker-compose.yml` (default=10) | Verified in docker-compose environment section |
| Babel language detection | ❌ `detect_emotion()` returns `language=<input param>` | N/A | Verified: `emotion_detector.py` line 168: `"language": language` (echo) |
| VSGS retrieval (conv.history) | ✅ `can_node` stores to `conversations_embeddings` | ❌ `semantic_grounding_node` searches `semantic_states` (different collection) | Verified by checking `VSGS_COLLECTION_NAME` env default; `qdrant_node.py` confirms two separate collections |
| `_previous_*` on session cache HIT | ❌ Only set on Postgres recovery (cache MISS) | N/A | Verified `graph_runner.py` L148-168: no `else` branch for cache hit |

---

## FIX-1 — Pattern Weavers `qdrant_connected: false` (ZERO-RISK)

**Root cause**: `persistence.py:check_qdrant_health()` called `self.qdrant_agent.list_collections()` — a method that does not exist on `QdrantAgent`. This threw `AttributeError`, caught by `except Exception → return False`.

**Fix**: Changed to `self.qdrant_agent.health()` (confirmed at `qdrant_agent.py` L118).

**File**: [services/api_pattern_weavers/adapters/persistence.py](../services/api_pattern_weavers/adapters/persistence.py#L147)  
**Change**: 1 line  
**Risk**: Zero (only affects health endpoint, no functional code)  
**Verification**: `curl http://localhost:9008/health → "qdrant_connected": true` ✅

---

## FIX-2 — PostgreSQL Pool Exhaustion (ZERO-RISK)

**Root cause**: `postgres_agent.py` supports `POSTGRES_POOL_MIN/MAX` env vars but the `docker-compose.yml` graph service section didn't set them. Default `max=10` is exhausted under concurrent load (observed: `connection pool exhausted` in logs during test battery).

**Fix**: Added to `docker-compose.yml` graph environment:
```yaml
- POSTGRES_POOL_MIN=2
- POSTGRES_POOL_MAX=20
```

**File**: [infrastructure/docker/docker-compose.yml](../infrastructure/docker/docker-compose.yml)  
**Change**: 3 lines (comment + 2 env vars)  
**Risk**: Zero (purely additive; existing `postgres_agent.py` already supports env vars)  
**Verification**: New containers started with pool max=20. No exhaustion under concurrent test load.

---

## FIX-3 — Multi-Turn Context: Prior Session in CAN Node

**Root cause**: Two related gaps:

**Gap A — `_previous_*` only set on Postgres recovery (cache MISS)**  
`graph_runner.py` sets `_previous_intent`, `_previous_language`, `_conversation_summary` only when recovering session from Postgres (cache miss path at L160-166). On in-memory cache HIT, the prior state is loaded but these fields are not explicitly snapshotted before the graph run overwrites them.

**Gap B — CAN node never reads prior-turn context**  
`can_node._generate_conversational_narrative()` builds its LLM prompt with `mcp_result` (current turn) and VSGS/weaver context, but reads zero `_previous_*` fields or `_conversation_summary` from state. Result: "which one has the highest value?" has no conversational anchor to the prior CRM query.

**Fixes**:

1. **`graph_runner.py`**: Added `else` branch for cache HIT that snapshots prior intent + narrative before graph run:
   ```python
   else:
       if state.get("intent") and not state.get("_previous_intent"):
           state["_previous_intent"] = state.get("intent")
           state["_previous_language"] = state.get("language")
       if state.get("narrative") and not state.get("_conversation_summary"):
           state["_conversation_summary"] = state.get("narrative", "")[:500]
   ```

2. **`can_node.py`**: Injected prior-turn context block into LLM `user_prompt`:
   ```python
   prior_summary = state.get("_conversation_summary", "")
   prior_intent = state.get("_previous_intent")
   if prior_summary:
       user_prompt += f"Previous assistant response (for follow-up context): {prior_summary}\n\n"
   if prior_intent and prior_intent != intent:
       user_prompt += f"(User previously asked about '{prior_intent}'; current question may be a follow-up)\n\n"
   ```

**Files**:
- [vitruvyan_core/core/orchestration/langgraph/graph_runner.py](../vitruvyan_core/core/orchestration/langgraph/graph_runner.py#L148)
- [vitruvyan_core/core/orchestration/langgraph/node/can_node.py](../vitruvyan_core/core/orchestration/langgraph/node/can_node.py)

**Change**: ~10 lines each  
**Risk**: Low (additive; fields missing from state resolve gracefully via `.get()`)

**Verification**: Multi-turn test after deployment:
- Turn 1: `show me all open CRM opportunities` → `crm_pipeline`, 50 records ✅  
- Turn 2: `which one has the highest value?` → narrative correctly identifies top opportunity from prior CRM data ✅ (was: generic "I don't have data" response ❌)

---

## FIX-3b — Multi-Turn Context: `cached_llm_node` (llm_soft route)

**Root cause**: When route is `llm_soft` (intent=unknown/chat), the pipeline goes through `cached_llm_node`. This node's `_build_user_prompt()` reads `entity_ids`, `raw_output`, and `language` from state, but has **zero** reads of `_previous_*`, `_conversation_summary`, or prior `mcp_result`. Follow-up questions that route to `llm_soft` have no conversational context.

**Fix**: Added prior-turn context sections to `_build_user_prompt()` in `cached_llm_node.py`:
```python
prior_summary = state.get("_conversation_summary", "")
prior_intent = state.get("_previous_intent", "")
if prior_summary:
    context_sections.append(f"🔁 PREVIOUS RESPONSE: {prior_summary}")
if prior_intent:
    context_sections.append(f"🔁 PREVIOUS INTENT: {prior_intent}")
```

**File**: [vitruvyan_core/core/orchestration/langgraph/node/cached_llm_node.py](../vitruvyan_core/core/orchestration/langgraph/node/cached_llm_node.py#L330)  
**Change**: ~8 lines  
**Risk**: Low (additive; falls through to empty strings if fields not set)

---

## FIX-4 — Babel Language Detection (MEDIUM)

**Root cause**: `detect_emotion()` in `emotion_detector.py` (Babel Gardens service) was making an LLM call for emotion detection, but the response parsing extracted only `emotion`, `confidence`, etc. — there was no `"language"` field in the JSON schema. The function returned `"language": language` (the input parameter, always `"auto"` from graph calls).

In `graph_runner.py`, the language override chain reads `emotion_metadata["language"]`. Since Babel returned `"auto"`, the length check `len("auto") != 2` skipped Babel's value and fell back to `langdetect`. `langdetect` is unreliable for short enterprise queries (e.g., English "top customers this week" → `lang=de`).

**Fix (3-part)**:
1. `EMOTION_SYSTEM_PROMPT` JSON schema: added `"language": "<ISO-639-1 code>"` field
2. `_detect_via_llm()`: reads `result.get("language", "")` from LLM response
3. `detect_emotion()`: uses LLM-detected language as primary, input param as fallback

**File**: [services/api_babel_gardens/modules/emotion_detector.py](../services/api_babel_gardens/modules/emotion_detector.py)  
**Change**: ~12 lines across 3 locations  
**Risk**: Medium (changes Babel API response structure — `language` field now at top level AND in `metadata`)

**Propagation verified**:
- `routes_emotion.py` already does `result.get("language", request.language)` for bus emit ✅
- `emotion_detector.py` (node) stores `result.get("metadata", {})` as `state["emotion_metadata"]`
- `graph_runner.py` reads `emotion_metadata["language"]` — now gets e.g. `"it"` or `"en"` (LLM-detected), not `"auto"` ✅

---

## FIX-5 — VSGS: Retrieve Conversations from `conversations_embeddings`

**Root cause**: `can_node._store_conversation_exchange()` embeds and stores every conversation exchange into the `conversations_embeddings` Qdrant collection. However, `semantic_grounding_node` only searched `VSGS_COLLECTION_NAME` (env default: `semantic_states`). The two collections serve different purposes and the conversation history stored by `can_node` was NEVER retrieved.

Additionally, the existing `_extract_vsgs_context()` truncated match text to 80 chars (context) and 50 chars (in prompt). Effectively useless for meaningful context.

**Fixes (3-part)**:

1. **`semantic_grounding_node.py`**: Added a secondary Qdrant search on `conversations_embeddings` after the main VSGS search, using `VSGSEngine.embed_only()` (no extra HTTP call). Results stored in `state["conversation_matches"]`. Controlled by `VSGS_CONV_SEARCH_ENABLED=1` (default on when `VSGS_ENABLED=1`):
   ```python
   vec = _ENGINE.embed_only(input_text)
   conv_res = agent.search("conversations_embeddings", query_vector=vec, top_k=3, qfilter=user_id_filter)
   state["conversation_matches"] = conv_res.get("results", [])
   ```

2. **`can_node._extract_vsgs_context()`**:
   - Increased text truncation: `[:80]` → `[:200]`
   - Added merge of `state["conversation_matches"]` into context items (top 2 matches, `exchange_text` payload field)

3. **`can_node._generate_conversational_narrative()`**:
   - Increased VSGS context usage: `[:50]` → `[:150]`

**Files**:
- [vitruvyan_core/core/orchestration/langgraph/node/semantic_grounding_node.py](../vitruvyan_core/core/orchestration/langgraph/node/semantic_grounding_node.py)
- [vitruvyan_core/core/orchestration/langgraph/node/can_node.py](../vitruvyan_core/core/orchestration/langgraph/node/can_node.py#L148)

**Both collections confirmed in RAG registry** (`contracts/rag.py` L322 and L338) ✅  
**Risk**: Low — secondary search wrapped in `try/except`, skipped gracefully on error. `qdrant_node.py` already searched `conversations_embeddings` (same collection, no collision). `embed_only()` exists at `vsgs_engine.py` L92.

---

## Deployment Summary

**Containers rebuilt and restarted**: `core_graph`, `core_babel_gardens`, `core_pattern_weavers`

| Service | Port | Status after deploy |
|---|---|---|
| Pattern Weavers | 9008 | `healthy`, `qdrant_connected: true` ✅ |
| Babel Gardens | 9009 | `healthy` ✅ |
| Graph API | 9004 | `healthy` ✅ |

---

## Files Changed

| File | Fix | Lines changed |
|---|---|---|
| `services/api_pattern_weavers/adapters/persistence.py` | FIX-1 | ~2 |
| `infrastructure/docker/docker-compose.yml` | FIX-2 | 3 |
| `vitruvyan_core/core/orchestration/langgraph/graph_runner.py` | FIX-3 | 7 |
| `vitruvyan_core/core/orchestration/langgraph/node/can_node.py` | FIX-3 + FIX-5 | ~20 |
| `vitruvyan_core/core/orchestration/langgraph/node/cached_llm_node.py` | FIX-3b | 7 |
| `services/api_babel_gardens/modules/emotion_detector.py` | FIX-4 | ~12 |
| `vitruvyan_core/core/orchestration/langgraph/node/semantic_grounding_node.py` | FIX-5 | ~22 |
| `vitruvyan_core/domains/enterprise/intent_config.py` | T06 keyword fix (prior session) | ~6 |

**Total: ~79 lines changed across 8 files. Zero new files created.**

---

## Test Results Post-Deploy

| Test | Before | After |
|---|---|---|
| PW `qdrant_connected` | `false` | `true` ✅ |
| Italian invoice query T06 | `unknown/chat` | `invoice_analysis, it` ✅ |
| Multi-turn: "which one?" | Generic response, no context | Correctly identifies top CRM opp ✅ |
| Short EN query language | `lang=de` (langdetect fail) | `lang=en` (Babel LLM) ✅ |
| Full 10-query battery | 10/10 | 10/10 maintained ✅ |

---

## Known Remaining Items (Out of Scope)

These were evaluated but intentionally deferred:

1. **VSGS `semantic_states` data**: The `semantic_states` collection has no conversation entries (it's for conceptual grounding). Long-term: populate it via a background process or via `upsert_semantic_state()` calls. Workaround: FIX-5 secondary search on `conversations_embeddings` covers conversational history.

2. **`cached_llm_node` LLM cache key collision**: On Turn 2, if the same query was cached from a prior session without context, the cache may serve a stale response. Mitigation: include `user_id` hash in cache key (tracked separately).

3. **`DISABLE_SLOT_FILLING` flag**: Slot-filling remains active (valid for OS-level dialogue). Per copilot-instructions.md §8: slot-filling is intentional in vitruvyan-core. No action needed.
