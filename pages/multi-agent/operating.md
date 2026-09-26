---
title: Configure and observe
---

# Multi-agent — configure and observe

## Settings

All settings live in the environment of the `graph` service
(`infrastructure/docker/docker-compose.yml`). Everything is **off by default**.

| Variable | Default | What it does |
|---|---|---|
| `GRAPH_LISTENER_ENABLED` | `0` | Runs the listener that executes `graph.run.requested` inside the graph service. Required for delegation. |
| `GRAPH_LISTENER_CONCURRENCY` | `3` | How many parts the listener runs at the same time. |
| `GRAPH_DELEGATION_ENABLED` | `0` | Turns on the model-driven fork (`plan`) and installs the bus port for `delegate`. |
| `GRAPH_MAX_COORDINATORS` | `1` | How many questions can be split at the same time, per process. Invalid or `< 1` → `1`. |
| `GRAPH_MAX_DELEGATED_PARTS` | `3` | Maximum parts per question; extra parts are dropped (`capped`). |
| `GRAPH_DELEGATION_TIMEOUT_S` | `90` | How long the coordinator waits for the parts. Parts still missing are declared in the answer. |

Keep `GRAPH_MAX_DELEGATED_PARTS` ≤ `GRAPH_LISTENER_CONCURRENCY`: with one coordinator at a time,
its parts always find a free slot.

Changing `kernel/` code requires rebuilding the graph image; changing these variables requires
recreating the container.

## Event contracts

Registered in `kernel/transport/channels/channel_registry.py`.

| Channel | Producer | Consumers | Carries |
|---|---|---|---|
| `graph.run.requested` | `graph_coordinator` (also the measurement probe) | `graph_listener` | `request_id`, `run_id`, `correlation_id`, `causation_id`, the part `text`, `tenant_id`, `user_id`, `ephemeral`, `scopes`, `hop_count`, `language` |
| `graph.run.completed` | `graph_listener` | `graph_coordinator`, `multiagent_latency_probe` | identifiers, outcome status, `duration_ms` — **never the answer** |
| `graph.run.failed` | `graph_listener` | `graph_coordinator`, `multiagent_latency_probe` | identifiers, normalized `category` / `reason`, `duration_ms` — **never the raw error** |

Delivery is at least once: the coordinator keeps the first outcome for each `request_id`.

## Endpoints

Both are protected like the other Continuum routes (`X-Motus-Token` or the auth middleware).

- `GET /motus/runs/{run_id}/outcome` — the outcome of one run: `status`
  (`succeeded` / `empty` / `failed`), the answer, `category`, `reason`, `correlation_id`,
  `causation_id`.
- `GET /motus/chain/{correlation_id}` — the coordinator and its delegated runs:

```json
{
  "correlation_id": "…",
  "coordinator": {"run_id": "…", "status": "succeeded", "category": null, "reason": null},
  "delegation": {"status": "delegated", "reason": null},
  "runs": [
    {"index": 0, "run_id": "…", "part_status": "succeeded", "duration_ms": 19144,
     "trace_status": "succeeded", "correlation_ok": true}
  ]
}
```

The route reads N+1 trace files (the coordinator's and one per part): it never scans the
trace directory.

## From the terminal

```bash
vit agents                    # recent delegated questions, with their parts
vit agents --limit 50         # read further back
vit agents chain <run_id>     # one chain, delegated or not
vit agents --json             # raw JSON, for scripts
```

`vit` reads `GRAPH_URL` (default `http://127.0.0.1:8001`) and sends `MOTUS_TRACE_TOKEN` as
`X-Motus-Token`. The token is never printed.

## First measurements (25/09/2026, production)

| Question | Expected | Result | Time |
|---|---|---|---|
| NIS2 incident notification + GDPR retention | split | 2 parts in parallel, both succeeded | 30.7 s |
| AI Act high-risk + Cyber Resilience Act | split | 2 parts in parallel, both succeeded | 25.2 s |
| NIS2 incident notification | single | single | 13.2 s |
| NIS vs NIS2 | single | single | 20.1 s |
| «Hi, who are you?» | single | single | 5.0 s |

The fork chose correctly on all five questions. A split costs about 7 seconds more than a
single agent (one model call to decide, one to compose): it pays off when the parts need
different sources or tools. Measuring that gain is tracked in issue #245.

## Declared limits

- The coordinator occupies a worker for the whole wait, up to the timeout.
- If publishing fails half-way, the parts already published are marked failed even though
  they keep running.
- `EventContract.producer` is a single string: the probe that also publishes
  `graph.run.requested` is named only in the description.
