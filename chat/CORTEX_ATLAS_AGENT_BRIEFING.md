# Cortex Atlas — Agent Briefing

> **Audience**: a Claude agent that will be assigned ownership of the Cortex Atlas implementation in `vitruvyan/vitruvyan-core`.
>
> **Author**: Claude Opus 4.7 (sessione del 2026-05-26, in collaborazione con Davide Baldoni).
>
> **Status**: operational briefing. The strategic backdrop is in the two chats listed below.

---

## 1. Read these first, in this order

1. [`docs/chat/claude_su_vitruvyan.md`](./claude_su_vitruvyan.md) — la scommessa filosofica del Synaptic Conclave (23 maggio 2026)
2. [`docs/chat/2026-05-26_synaptic_conclave_e_cortex_atlas.md`](./2026-05-26_synaptic_conclave_e_cortex_atlas.md) — la conversazione che ha definito Cortex Atlas (26 maggio 2026)
3. [`docs/architecture/SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md`](../architecture/SYNAPTIC_CONCLAVE_PHILOSOPHY.it.md) — la visione architetturale formale
4. [`CLAUDE.md`](../../CLAUDE.md) nel repo aicomsec — regole operative, topologia multi-repo, sacred orders, convenzioni
5. Issue [vitruvyan-core#19](https://github.com/vitruvyan/vitruvyan-core/issues/19) — your charter

The chats give philosophy. This document gives operations.

---

## 2. Who you are working with

**Davide Baldoni** is the founder and director of Vitruvyan. He **does not write code** — he provides architectural vision, domain knowledge, and judgment. Three things to internalize:

- **Communicate at the level of intent and architecture, not syntax.** When you propose changes, frame them as decisions to validate, not diffs to review.
- **Persistent institutional memory is critical.** Document decisions in issues, design docs, and a decision log. He cannot re-read code; he relies on you to preserve context.
- **Trust his architectural judgment.** When he disagrees with your proposal, he is usually right about something you haven't seen yet. Probe before defending.

A parallel Claude session — "Phase D session" — is unblocking extraction quality, gold standard, and the D.3 promotion engine. **Your work starts after Phase D's gate opens**. Until then, you are in RFC stage only. The gate is tracked in [aicomsec#32](https://github.com/vitruvyan/aicomsec/issues/32).

---

## 3. Your scope

Build **Cortex Atlas** in `vitruvyan-core`:

- A hebbian, plastic, consolidatory knowledge-graph substrate
- Grows from co-activations on the Synaptic Conclave bus
- Decays through disuse (slime-mold + synaptic pruning)
- Consolidates offline (sleep/REM analog)
- Issues canonical entities and assemblies as emergent structures
- Auditable end-to-end via the existing Meridian causal-replay surface

You own the architectural design, RFC, schema, implementation phases G.0 → G.4, sub-issues, decision log. You do not own extraction quality (Phase D), the bus itself (already exists), or domain-specific overlays (aicomsec).

---

## 4. Hard constraints — non-negotiable

### 4.1. Bus discipline

Every event you emit must have:
- a designated consumer (no logging-by-event)
- a semantically rich payload (no `data: {}` placeholders)
- a stable schema declared in `core/synaptic_conclave/events/`
- propagation of `trace_id` (correlation_id) end-to-end

Never bypass the bus for performance. Never add an event "for future use." If you cannot name a consumer, do not emit the event.

### 4.2. Reuse the existing plasticity framework

`vitruvyan_core/core/synaptic_conclave/plasticity/` was built in January 2026 as a governed-learning primitive. It includes:

- `PlasticityManager` — bounded, auditable, reversible parameter adjustments
- `OutcomeTracker` — links decisions to outcomes for feedback
- `PlasticityLearningLoop` — periodic offline adaptation (7-day lookback default)
- `PlasticityObserver` — anomaly detection (oscillation, drift, stagnation, instability, divergence, feedback_lag)
- Six migrated PG tables: `plasticity_adjustments`, `plasticity_anomalies`, `plasticity_anomaly_actions`, `plasticity_observer_log`, `plasticity_outcomes`, `plasticity_parameter_locks`

**Cortex Atlas is an EXTENSION of this framework to a new substrate (KG edges) — not a new paradigm.** You will need to:

- Generalize `ParameterBounds` (scalar) to `EdgeBounds` (multi-dimensional: src, dst, type, tonicity, decay-rate)
- Extend `OutcomeTracker.record_outcome()` with `record_coactivation(trace_id, edge_id, useful?)`
- Reuse `PlasticityLearningLoop` for the offline Consolidator (you may add a separate loop for graph-specific consolidation, but pattern-wise it's the same)
- Reuse `PlasticityObserver` anomaly types and add edge-specific ones (e.g., `EDGE_THRASHING`, `ASSEMBLY_FRAGMENTATION`)

If you find yourself reimplementing governance primitives, stop. Reuse what's there. The framework exists for exactly this purpose.

### 4.3. Naming conventions — memory substrate map

These names are taken. Do not collide:

| Substrate | Name | Backing |
|---|---|---|
| Bus / event substrate | **Synaptic Conclave** | Redis Streams |
| Relational store | **Archivarium** | PostgreSQL |
| Vector / semantic memory | **Mnemosyne** | Qdrant |
| **Structural KG (your domain)** | **Cortex Atlas** | PostgreSQL (likely) + custom indices |

Sacred Orders (Pattern Weavers, Babel Gardens, Orthodoxy Wardens, Vault Keepers, Codex Hunters, Memory Orders) are agent groups, not substrates. If you need a new agent group within Cortex Atlas, propose the name to Davide before introducing it. Convention: Latin or Greek single word, evocative, ecclesiastical resonance acceptable.

Cortex Atlas sub-component naming may include the Atlas/cartographic family (cartographer, edition, snapshot, frontier, atlas-of-X) — these resonate with the chosen Atlas metaphor.

### 4.4. Causal replay determinism

Cortex Atlas is plastic — edges form, strengthen, decay, get pruned, get consolidated. This creates a determinism problem for causal replay: a query answered at T1 used a different graph than at T2. **The moat depends on every answer being reconstructible.**

Therefore:
- Every state change emits an event on the bus (already mandatory per §4.1)
- The bus persists to `bus_events` (Meridian Phase 0)
- Cortex Atlas keeps versioned snapshots per trace_id, or per logical "edition"
- A causal replay at T must reconstruct the graph state as it was at T

Design this in from G.0, not bolted on later. The plasticity framework's `plasticity_parameter_locks` table already supports the "freeze for replay" pattern — study it.

### 4.5. No shortcuts on observations

Extraction quality is the Phase D session's problem, not yours. If you find yourself thinking "let me regex this out of the chunk text" or "let me hardcode this mapping" — stop. File the issue upstream. You build on what Phase D delivers; you do not patch Phase D from inside Cortex Atlas.

### 4.6. Validation library

Like the SRA Phase 9 demo runs only on `assessment-26` (the validated fixture), **Cortex Atlas demos run only on validated edges/queries**. Never demo emergent reasoning on a query that hasn't been precision-checked manually. The Theranos-moment risk is more acute for an emergent system than for a deterministic one.

Build a `cortex_atlas/fixtures/validated_queries/` library with curated, hand-verified queries and expected reasoning chains. Demos draw exclusively from this library until you have a sustained precision metric on broader traffic.

### 4.7. Cross-repo discipline

You are in `vitruvyan-core`. The flow for changes:

1. Branch on `vitruvyan/vitruvyan-core`: `feat/cortex-atlas-Gx-...`
2. PR with description, tests, screenshots if relevant
3. Davide reviews
4. Merge → bump version → tag → GitHub Release
5. `vit upgrade` propagates to aicomsec

Domain-specific code (security verticals, etc.) stays out of `vitruvyan-core`. If you find yourself writing `if domain == "security":`, you are in the wrong repo.

---

## 5. The phases (your roadmap)

### G.0 — RFC (NOW, before any code)

Deliverable: `vitruvyan-docs/architecture/CORTEX_ATLAS_RFC.md`

Contents:
1. **Overview & motivation** — paraphrase the strategic chats; do not duplicate them
2. **Design of M1 (Hebbian edge formation)** — schema for `cortex_atlas_edges`; tonicity formula; co-activation extraction from `bus_events`; integration with `OutcomeTracker`
3. **Design of M2 (decay/pruning)** — decay function (linear? exponential? bounded?); pruning threshold; emission of `cortex_atlas.edge.pruned` events
4. **Design of M3 (Consolidator)** — schedule; pattern-detection algorithm; promotion criteria from observations → canonical entities → assemblies; event emissions
5. **Versioning strategy** — snapshot per trace? per edition? hybrid? Trade-offs
6. **Bootstrap strategy** — seeding from existing `ontology_normalizer_node` mappings; cold-start mitigation
7. **Anomaly extensions to PlasticityObserver** — what KG-specific anomalies must we detect
8. **Migration plan** — DDL for new tables; relationship to existing `ontology_observations`
9. **Risks and open questions** — explicit list, each with owner (you / Davide / future)
10. **Out of scope** — what you are NOT solving (multi-model evaluation, extraction quality, etc.)

Acceptance for G.0:
- RFC committed
- Davide reviewed and approved (annotated comments OK)
- At least one external critique solicited (Claude in another session, ChatGPT, or other) and addressed in revisions
- Sub-issues for G.1, G.2, G.3, G.4 opened and crosslinked
- Decision log file seeded: `docs/architecture/CORTEX_ATLAS_DECISIONS.md`

**Do not start G.1 until G.0 is closed AND Phase D gate (aicomsec#32) is closed.**

### G.1 — Schema + Seeding

GATED on Phase D closure. Deliverables:

- PG migrations for `cortex_atlas_edges`, `cortex_atlas_entities`, `cortex_atlas_assemblies`, `cortex_atlas_snapshots` (and any others your RFC defines)
- Seeding script that ingests existing canonical mappings (e.g., ISO 27001:2013 ↔ 2022 from `ontology_normalizer_node`)
- API endpoints (read-only initially): `/admin/cortex/edges`, `/admin/cortex/entities`, `/admin/cortex/snapshot/{id}`
- Tests: schema integrity, seeding idempotency, snapshot reconstruction

### G.2 — Hebbian Recorder

- New consumer service (similar to `causal_recorder`): subscribes to relevant bus channels, computes co-activations within a `trace_id`, updates edge tonicity
- Integration with `OutcomeTracker`
- Bounded tonicity per `ParameterBounds`/`EdgeBounds` (no unbounded edge weights)
- Emits `cortex_atlas.edge.formed`, `cortex_atlas.edge.reinforced`, `cortex_atlas.edge.decayed`

### G.3 — Consolidator ("Dreamer")

- Background process (scheduled, like `PlasticityLearningLoop`)
- Replays `bus_events` over a configurable window
- Detects recurring multi-edge patterns (triples, sequences, motifs)
- Promotes stable patterns to `cortex_atlas_assemblies`
- Emits `cortex_atlas.consolidation.completed`, `cortex_atlas.assembly.detected`, `cortex_atlas.edge.pruned`

### G.4 — Versioning + Replay Integration

- Snapshot persistence per trace (or per edition, per your RFC decision)
- Integration with Meridian causal-replay: `/admin/causal/trace/{id}` shows the cortex-atlas state used by that trace
- Determinism test: same input → same graph state → same response

---

## 6. Process discipline

### 6.1. Decision log

Maintain `docs/architecture/CORTEX_ATLAS_DECISIONS.md` — append-only. Every non-trivial decision: rationale, alternatives considered, who decided, what the trigger was to reconsider if it ever came up.

This is the "atlas of decisions" of the Atlas. Treat it as code: PRs that introduce architectural decisions must update this file.

### 6.2. Commits and PRs

- Commit style: `<type>(<scope>): <subject>` — types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Co-author trailer mandatory: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Pre-commit hook on aicomsec blocks secret patterns — assume similar on core
- Never `--no-verify` without explicit Davide approval
- PRs link to the issue; tests included; no merge without review

### 6.3. Issues

- Open sub-issues for G.1–G.4 once G.0 RFC is approved
- Each sub-issue: title `[Phase G.X] <feature>`, labels `phase-g`, `vision` for design, `enhancement` for implementation
- Track open questions as issues with label `question` — don't bury them in chat

### 6.4. Communication with Davide

- Surface decisions that need his input; do not make them unilaterally
- For routine implementation choices (data structures, library picks within constraints), proceed and document in the decision log
- For architectural choices (schema, event semantics, consolidation policy), ALWAYS validate with him first
- When in doubt: ask. Cost of asking is low; cost of building the wrong abstraction is high

### 6.5. Coordination with the Phase D session

- **Read `docs/architecture/PHASE_D_PROGRESS_LOG.md` at the start of every session** — that's where Phase D state is tracked
- If your work depends on a Phase D deliverable (e.g., D.3 promotion engine), file the dependency explicitly in your sub-issue
- Do not attempt to do Phase D's work yourself — even if you "could just" fix the Pattern Weavers bug

---

## 7. What's OUT of scope (and why)

- **Extraction quality / Pattern Weavers bug** → Phase D session
- **Gold-standard test set construction** → Phase D session (you may *consume* it for validation, but not build it)
- **Multi-model A/B evaluation** → Phase D session (vitruvyan-core #14)
- **Domain-specific vocabulary or ontology** → aicomsec, not core
- **LLM evaluation or training of any kind** → outside Vitruvyan; you are substrate, not model
- **Mnemosyne (Qdrant) modifications** → Memory Orders agents
- **Archivarium (PG schema) modifications outside Cortex Atlas tables** → coordinate via Davide

---

## 8. When you are blocked

- **Architectural decision needed**: open `question`-labeled issue, surface in next Davide reply
- **Dependency not delivered**: file as blocker on your sub-issue, do not work around
- **Plasticity framework gap**: if you genuinely need something the existing framework can't provide, propose an extension on a new issue against `core/synaptic_conclave/plasticity/` — do not fork the pattern
- **Naming conflict**: propose alternatives to Davide; never introduce a new substrate name without approval

---

## 9. Success criteria — end of RFC stage (G.0)

You can declare G.0 closed when:

- [ ] `docs/architecture/CORTEX_ATLAS_RFC.md` committed and pushed to vitruvyan-docs
- [ ] Davide has reviewed and approved
- [ ] At least one external critique solicited and addressed
- [ ] All 10 RFC sections (per §5 G.0) present and substantive
- [ ] G.1–G.4 sub-issues opened and crosslinked from #19
- [ ] Decision log seeded with ≥5 entries
- [ ] Issue #19 acceptance checklist fully ticked

At that point, you wait for the Phase D gate to open. Update `docs/architecture/CORTEX_ATLAS_STATUS.md` weekly with whatever asynchronous prep you're doing (literature review, schema exploration, etc.). Do not start G.1 implementation until aicomsec#32 is closed.

---

## 10. One last thing

Davide is making a third architectural bet (bus → causal replay → Cortex Atlas). Each is reasonable individually; cumulatively they require discipline. If at any point in your work you find yourself thinking "this is getting complicated, let me just hack it" — that thought is the moat dissolving in real time. Stop, document, ask.

The strategic chats are explicit on this: *the real moat is the discipline*. Your job is to extend the moat to a new substrate, not erode it.

Good luck. Build something honest.

---

*Briefing redatto da Claude Opus 4.7 il 2026-05-26, in collaborazione con Davide Baldoni. Last updated: 2026-05-26.*
