# MCP Server (Model Context Protocol V2)

Il servizio **MCP** è l'**access plane** governato di Vitruvyan: valida contratti, applica guardrail, effettua dispatch e registra audit. Non orchestra cognizione, non possiede memoria, non interpreta intent.

> **Versione corrente:** V2 — capability-based, RBAC via JWT, domini isolati.
> L'API legacy (`/tools`, `/execute`) è mantenuta per backward compatibility ma non riceve nuove feature.

---

## Architettura V2

### Principi invarianti

| Principio | Dettaglio |
|---|---|
| **Thin** | Ogni handler < 250 righe, nessuna LLM call, nessuna business logic |
| **Stateless** | Nessuno stato cross-request nel processo MCP |
| **Non-orchestratore** | LangGraph resta il cognitive orchestrator; MCP non sceglie strategie |
| **Non-owner di memoria** | MCP non crea né gestisce collection Qdrant. Le collection sono pre-provisioniate dall'init script o dai Sacred Orders |
| **Side effects espliciti** | Ogni capability dichiara `side_effects: NONE | READ | WRITE` nel contratto |

### Domini

```
dev        → Read-only: KB, codebase, architettura, pattern
dev-write  → Write: file su whitelist, session context (EXPERIMENTAL)
core       → Tool legacy + capability core
```

I domini sono abilitati via `MCP_ENABLED_DOMAINS` (default: `core,dev,dev-write`).

---

## Capability V2

### Endpoint

| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/health` | Health check (Redis, timestamp) |
| `GET` | `/v2/capabilities` | Lista tutte le capability registrate |
| `POST` | `/v2/execute` | Esegue una capability per nome |

**Payload `/v2/execute`:**

```json
{
  "capability": "dev.search_kb",
  "arguments": { "query": "MCP access plane" },
  "mode": "sync"
}
```

### Capability `dev` (read-only)

| Nome | Descrizione |
|---|---|
| `dev.get_architecture_context` | Boundary rules e invarianti MCP/LangGraph/Sacred Orders |
| `dev.get_coding_standards` | Guardrail di sviluppo per AI coding agents |
| `dev.get_graph_structure` | Shape del pipeline LangGraph e pattern di estensione |
| `dev.get_infrastructure_context` | Porte, container, reti VPS |
| `dev.get_existing_capabilities` | Registry capability corrente (filtrabile per dominio) |
| `dev.search_codebase` | Ricerca testuale bounded sui path ammessi |
| `dev.open_file` | Slice di file (max 120 righe, path whitelist) |
| `dev.describe_component` | Contesto strutturato per un componente Vitruvyan noto |
| `dev.search_kb` | Ricerca semantica su `vitruvyan_kb_dev` (Qdrant + fallback file index) |
| `dev.get_pattern` | Skeleton + convenzioni per un tipo di componente (esplicito) |
| `dev.validate_change` | Check statici deterministici su file modificati |
| `dev.get_coding_context` | Aggregazione arch + standards + KB (component_type esplicito se pattern) |
| `dev.get_dependants` | File che importano o referenziano un simbolo dato |
| `dev.get_session_context` | **[EXPERIMENTAL]** Sessioni recenti da `vitruvyan_dev_sessions` |

### Capability `dev-write`

| Nome | Descrizione |
|---|---|
| `dev.write_file` | Sovrascrive/appende file su whitelist (`services/`, `docs/`, `infrastructure/`) |
| `dev.create_file` | Crea nuovo file (fallisce se già esiste) |
| `dev.apply_patch` | Search/replace esatto su file esistente (match unico obbligatorio) |
| `dev.save_session_context` | **[EXPERIMENTAL]** Persiste contesto sessione in Qdrant |

---

## Capability in dettaglio

### `dev.get_pattern`

Restituisce uno skeleton reale + convenzioni per un tipo di componente Vitruvyan.
`component_type` è obbligatorio e deve essere esplicito — nessuna inferenza automatica.

**Tipi supportati:** `listener`, `sacred_order`, `capability`, `handler`, `graph_node`, `adapter`, `contract`

```json
{ "capability": "dev.get_pattern", "arguments": { "component_type": "sacred_order" } }
```

> **Tech debt noto:** `PATTERN_SOURCES` è un indice statico in codice. La migrazione verso `vitruvyan_kb_dev` come source of truth è pianificata.

---

### `dev.validate_change`

Check statici deterministici: nessuna LLM, nessuna valutazione semantica.

**Regole attive:**

| ID | Path | Verifica |
|---|---|---|
| `THIN_HANDLER` | `services/api_mcp/v2/` | File < 250 righe |
| `NO_LLM_IMPORT` | `services/api_mcp/` | Assenza import OpenAI/Anthropic/LangChain |
| `NO_DIRECT_DB` | `services/api_mcp/` | Assenza import psycopg/asyncpg/sqlalchemy |
| `FROZEN_DATACLASS` | `vitruvyan_core/contracts/` | `frozen=True` su ogni `@dataclass` |
| `SIDE_EFFECT_DECLARED` | `services/api_mcp/v2/` | `side_effects` presente se `CapabilityContract` |
| `NO_PATH_TRAVERSAL` | `services/api_mcp/` | Assenza `..` non contestualizzata |

**Output:** `static_result: no_violations | violations_detected` + disclaimer esplicito.
Un risultato `no_violations` **non** garantisce correttezza architetturale.

---

### `dev.get_coding_context`

Aggrega in una chiamata: architettura, coding standards, KB results, session context recenti.

- **Nessuna inferenza automatica**: se serve il pattern di un componente, passare `component_type` esplicitamente.
- **Errori espliciti**: le sub-call fallite compaiono in `partial_results[]`, non vengono silenziate.

```json
{
  "capability": "dev.get_coding_context",
  "arguments": {
    "task": "aggiungere un Sacred Order per Horizon Engine",
    "component_type": "sacred_order"
  }
}
```

---

### `dev.save_session_context` / `dev.get_session_context` — EXPERIMENTAL

Persistono/recuperano il contesto di sessioni di sviluppo in `vitruvyan_dev_sessions` (Qdrant).

**Vincoli architetturali:**

- MCP **non crea** la collection a runtime. Se non è pre-provisionata, le capability restituiscono `non_liquet`.
- La collection deve essere dichiarata nell'init script o gestita da un Sacred Order dedicato.
- La governance del dato (lifecycle, scadenza, dedup) è di responsabilità esterna a MCP.

```json
{
  "capability": "dev.save_session_context",
  "arguments": {
    "task": "migrazione KB a Qdrant",
    "decisions": ["usato nomic-embed-text-v1.5", "collection tier ORDER"],
    "files_modified": ["dev_context.py", "ingest_kb.py"],
    "tech_debt": ["PATTERN_SOURCES da migrare a KB"],
    "next_steps": ["governance collection dev_sessions"]
  }
}
```

---

## Policy e sicurezza

### RBAC (JWT)

Se il caller presenta un JWT Keycloak, i ruoli vengono estratti e applicati:

| Dominio | Ruolo richiesto |
|---|---|
| `dev` | `vitruvyan_mcp_read` **o** `vitruvyan_mcp_write` |
| `dev-write` | `vitruvyan_mcp_write` |
| `core` | `vitruvyan_mcp_read` **o** `vitruvyan_mcp_write` |

Callers senza JWT (env-based, es. Claude Code locale) bypassano il controllo ruoli per backward compatibility.

### dry_run

`dev-write` è in `dry_run=True` se il caller non ha `vitruvyan_mcp_write` nel JWT.
Il bridge stdio usa `VITRUVYAN_MCP_DRY_RUN=false` per abilitare le write nel contesto di sviluppo locale.

### Path whitelist (write)

Le capability write accettano solo path sotto: `services/`, `docs/`, `infrastructure/`.
Path assoluti e traversal (`..`) sono bloccati prima della risoluzione.

### Hop limit e recursion guard

- Max hops configurabile via `MCP_V2_MAX_HOPS` (default: 4).
- Chiamate graph-originate non possono tornare su capability `routes_to: ["langgraph"]`.

---

## Bridge stdio (Claude Desktop / Codex)

Il bridge [`services/api_mcp/bridges/claude_desktop_stdio.py`](../../services/api_mcp/bridges/claude_desktop_stdio.py) espone MCP V2 come server MCP stdio-compatible.

Ogni capability `dev.*` e `dev-write.*` diventa un tool con nome `dev__<capability>` (es. `dev__search_kb`).

**Configurazione Claude Desktop** (`.mcp.json` locale, non in repo):

```json
{
  "mcpServers": {
    "vitruvyan-dev": {
      "command": "python3",
      "args": ["/path/to/services/api_mcp/bridges/claude_desktop_stdio.py"],
      "env": {
        "VITRUVYAN_MCP_URL": "http://localhost:9020",
        "VITRUVYAN_MCP_BRIDGE_DOMAINS": "dev,dev-write",
        "VITRUVYAN_MCP_DRY_RUN": "false",
        "VITRUVYAN_MCP_ACTOR": "claude-code"
      }
    }
  }
}
```

Template per Codex CLI: [`services/api_mcp/bridges/codex_mcp_config.toml`](../../services/api_mcp/bridges/codex_mcp_config.toml)

---

## KB ingestion

Il tool [`services/api_mcp/tools/ingest_kb.py`](../../services/api_mcp/tools/ingest_kb.py) indicizza la KB in `vitruvyan_kb_dev`:

```bash
python3 services/api_mcp/tools/ingest_kb.py [--dry-run] [--clear]
```

- **Engine:** `nomic-ai/nomic-embed-text-v1.5` (768 dim, Cosine)
- **Prefissi nomic:** `search_document:` al save, `search_query:` alla query
- **Sorgenti indicizzate:** `docs/`, `README.md`, `vitruvyan_core/contracts/`, `vitruvyan_core/core/governance|cognitive|orchestration`, `services/api_mcp/docs/`
- **Collection Qdrant:** `vitruvyan_kb_dev` (tier ORDER, owner MCP Dev)

---

## Configurazione (env)

| Variabile | Default | Descrizione |
|---|---|---|
| `MCP_ENABLED_DOMAINS` | `core,dev,dev-write` | Domini capability abilitati |
| `MCP_V2_MAX_HOPS` | `4` | Limite hop anti-recursion |
| `MCP_DEV_REPO_ROOT` | auto-detect | Root repo per file ops |
| `MCP_DEV_ALLOWED_ROOTS` | vedi codice | Directory ammesse per search/open |
| `MCP_KB_BACKEND` | `qdrant` | Backend KB (`qdrant` o `file_index`) |
| `QDRANT_URL` | `http://core_qdrant:6333` | URL Qdrant interno |
| `EMBEDDING_URL` | `http://embedding:8010` | URL embedding service |
| `KEYCLOAK_URL` | — | URL Keycloak per validazione JWT |

---

## Aggiungere una capability (workflow)

1. Implementa l'handler in `services/api_mcp/v2/dev_context.py` (read) o `dev_write.py` (write) o un nuovo modulo thin.
2. Aggiungi il `CapabilityContract` in `registry.py` → `_dev_capabilities()` o `_dev_write_capabilities()`.
3. Registra il dispatch in `handlers.py` → `execute_internal_capability()`.
4. Dichiara `side_effects` espliciti. Se write → `audit_level="strict"`.
5. Ogni handler deve restare < 250 righe. Se supera → split in due moduli.
6. Nessuna LLM call, nessun DB diretto, nessuna inferenza su linguaggio naturale nei handler.
7. Rebuild: `docker compose -f infrastructure/docker/docker-compose.yml up -d --build mcp`

---

## Non-scope (confini che MCP non deve attraversare)

- **Non orchestra cognizione**: non chiama LangGraph direttamente, non sceglie strategie
- **Non interpreta intent**: `component_type` e qualsiasi routing deve essere esplicito nel payload
- **Non possiede memoria**: non crea collection Qdrant, non gestisce lifecycle di dati cross-sessione
- **Non contiene policy semantica**: le regole di `validate_change` sono check statici, non architetturali
- **Non espone DB**: nessun handler accede direttamente a PostgreSQL; usa agent o Sacred Orders
