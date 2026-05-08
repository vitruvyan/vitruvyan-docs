# Vitruvyan VPS Infrastructure Context

> **Canonical reference** for all coding agents and sessions.  
> Also exposed via MCP capability `dev.get_infrastructure_context`.

---

## Repos on the VPS

| Path | Status |
|------|--------|
| `/home/vitruvyan/vitruvyan-core` | **Working repo — only repo Claude Code touches** |
| `/home/vitruvyan/frontier` | **DO NOT TOUCH** |

Two separate Docker stacks, isolated networks, zero cross-stack communication.

---

## vitruvyan-core Stack

**Network:** `vitruvyan-core_core-net`  
**Container prefix:** `core_`

### Port Mapping (host → internal)

| Service | Host Port | Internal Port |
|---------|-----------|---------------|
| Redis | 6389 | 6379 |
| PostgreSQL | 5442 | 5432 |
| Qdrant REST | 6343 | 6333 |
| Qdrant gRPC | 6344 | 6334 |
| MCP | 9020 | 8020 |
| Graph | 10004 | 8004 |
| Embedding | 10010 | 8010 |
| Babel Gardens | 10009 | 8009 |
| Memory Orders | 10016 | 8016 |
| Orthodoxy Wardens | 10006 | 8006 |
| Vault Keepers | 10007 | 8007 |
| Conclave | 10012 | 8012 |
| Codex Hunters | 10008 | 8008 |
| Pattern Weavers | 10017 | 8017 |

### Container Names

```
core_redis
core_postgres
core_qdrant
core_mcp
core_embedding
core_babel_gardens
core_memory_orders
core_orthodoxy_wardens
core_vault_keepers
core_conclave
core_codex_hunters
core_pattern_weavers
```

### Service URLs

| From | Redis | Embedding | Qdrant |
|------|-------|-----------|--------|
| Host | `localhost:6389` | `http://localhost:10010` | `http://localhost:6343` |
| Inside Docker | `core_redis:6379` | `http://embedding:8010` | `http://core_qdrant:6333` |

---

## Invariants

- **Monitoring** (Prometheus, Grafana, cAdvisor) is **NOT present** in vitruvyan-core.
- **Docker compose is fixed and working** — do NOT modify it.
- All services inside Docker reference Redis as `core_redis`.
- Host-side access uses `localhost:<host_port>`; Docker-side uses `<service_name>:<internal_port>`.
- The `frontier` stack has its own network (`frontier_core-net`) and container prefix (`frontier_`). It is completely isolated.

---

## Embedding

- **Model:** `nomic-ai/nomic-embed-text-v1.5`
- **Dimensions:** 768
- **Endpoint (host):** `POST http://localhost:10010/v1/embeddings/create` (single) or `/v1/embeddings/batch`
- **Distance metric:** Cosine (all vitruvyan-core collections)

---

*Last updated: 2026-05-07*
