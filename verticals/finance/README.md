# Finance Vertical — Knowledge Base

> **Last updated**: 2026-06-01  
> **Vertical**: finance (Mercator)

This section collects the finance-vertical-specific knowledge base
articles. The pattern mirrors `contracts/verticals/` (which holds
*contracts*); here we hold *philosophy, design choices, and trade-offs*
behind the implementation.

## Articles

| Article | Status | Topic |
|---|---|---|
| [sentiment-philosophy.md](sentiment-philosophy.md) | active redesign | Sentiment engine design contract: atomic observations, source authority, decay, echo-chamber treatment, live-feed event classes |

## Companion docs

- Technical pipeline (Oculus → Codex → Babel → PW): [`pipeline_reddit_ingestion_embedding.md`](../../pipeline_reddit_ingestion_embedding.md)
- Mercator vertical pipeline analysis (Feb 2026 snapshot): [`MERCATOR_VERTICAL_PIPELINE_ANALYSIS.md`](../../MERCATOR_VERTICAL_PIPELINE_ANALYSIS.md)
- Vertical contract: [`contracts/verticals/VERTICAL_CONTRACT_V1.md`](../../contracts/verticals/VERTICAL_CONTRACT_V1.md)

## How to contribute

Articles here are **architectural decisions**, not implementation notes.
Each article should:
- Open with a one-line summary, last-updated date, status, and companion-doc links
- State the *why* (the philosophical commitment), not the *how*
- End with a "Non-negotiables" section + "Open design points"
- Cross-link to the GitHub issue(s) implementing the work
