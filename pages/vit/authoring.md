---
title: Writing a package
---

# Writing a `.vit` package

This page is for whoever builds a `.vit` package: a connector, a backend (for example, a
backup destination), or an entire domain vertical. If you only need to *use* one, see
[Using vit](/vit/packages).

A domain vertical is named after its domain, not its kind: a security vertical package is
named `security`, not `vertical-security` — the kind already lives in the manifest's
`type` field.

## Source layout

```
my-package/
  vitpkg.yaml          the source manifest (required)
  payload/             wheels, templates, config, knowledge sources (optional)
  src/                 the source of a Python wheel, if the package installs one
    pyproject.toml
    ...
```

The build step reads `vitpkg.yaml`, copies everything under `payload/` into the archive,
and produces `<id>-<version>.vit`. You don't build the wheel by hand inside
`payload/wheels/` — that is a separate step, see [Building](#building).

## `vitpkg.yaml` reference

The manifest is written as YAML; it is read and signed as canonical JSON (RFC 8785) — the
build step does that conversion, you only ever write YAML. A JSON Schema mirrors every rule
below, for anyone verifying a manifest without running the reference implementation.

### Top-level fields

| Field | Required | Rule |
|---|---|---|
| `format` | yes | must be exactly `2` |
| `id` | yes | `^[a-z][a-z0-9-]{1,62}$` — lowercase, starts with a letter. A domain vertical uses the domain's own name (`security`, not `vertical-security`) |
| `version` | yes | semver `MAJOR.MINOR.PATCH[-prerelease]`, no build metadata |
| `type` | yes | one of `product` `app` `service` `connector` `plugin` `backend` `vertical` `knowledge` |
| `title` | yes | `{en: "…", it: "…"}` — `en` required, `it` optional |
| `license` | yes | a non-empty string (`apache-2.0`, `proprietary`, …) |
| `channel` | yes | `stable` or `beta` — this **package's own** channel, distinct from the `public`/`licensed` channel of the source that distributes it |
| `requires` | no | see below |
| `conflicts` | no | list of conflicting package ids |
| `provides` | no | see below — the set of allowed keys is **closed**: only the ones listed |
| `data` | no | `{owned: […], on_remove: "preserve"}` — `on_remove` accepts only `"preserve"` in this format |

Every validation problem is returned together, as a list of `(path, message)` pairs — you
don't need a build per typo fixed.

### `requires`

```yaml
requires:
  products:
    orbis: ">=1.39,<2"
    limen: ">=1.6,<2"
  packages:
    hello-connector: ">=0.1"
```

Semver ranges are opaque strings at this level — the resolver interprets them at install
time. `products` point at Orbis/Motus/Limen; `packages` point at other `.vit` packages.

### `provides` — the closed list

Only these keys are allowed; an unknown key is a validation error, never a field silently
ignored.

#### `services` — only for `app`/`service`/`product`/`vertical`

```yaml
provides:
  services:
    - name: my_worker
      image: ghcr.io/vitruvyan/my-worker@sha256:<64 hex>
      compose: payload/compose.yml
      health: http://my_worker:8080/health
      volumes: ["my_worker_data"]
```

- **`image`** must be pinned by **digest** (`…@sha256:<64 hex characters>`), never by tag —
  a tag can change what it points to without the index noticing.
- **`compose`** is the path, inside the archive, to the compose fragment that declares
  *exactly* the services listed here, nothing else. The fragment is validated line by line
  before it is ever written to disk (`vit` never executes it): no `privileged`, no `host`
  network or PID namespace, no Docker socket mount, no bind mount outside the package's own
  directory, no `cap_add` with `SYS_ADMIN`/`ALL`.
- A connector, plugin, backend, or knowledge package **cannot** declare `services` — those
  types ship only a wheel and configuration, never their own container.

#### `graph_plugins`, `connectors`, `backends` — a wheel plus an entry point

```yaml
provides:
  connectors:
    - id: hello
      wheel: payload/wheels/vitruvyan_hello_connector-0.1.0-py3-none-any.whl
      entry_point: vitruvyan_hello_connector:HelloConnector
```

`backends` additionally declares a `contract`: today the only recognized kernel contract is
`backup_storage` (an implementation of the backup storage interface), which registers under
the `vitruvyan.backup_backends` entry point group — the manifest does not repeat the group
name, `vit` resolves it from `contract`.

`vit_capabilities` declares only an `entry_point`; it has no `wheel` field of its own in the
schema — its code ships inside one of the wheels the same package declares elsewhere
(typically its `connectors`/`graph_plugins`).

#### `config_keys` — entries in the configuration catalog

```yaml
provides:
  config_keys:
    - name: HELLO_GREETING
      target: orbis-compose-env
      secret: false
    - name: HELLO_TOKEN
      target: orbis-compose-env
      secret: true
```

- **`name`** must match `^[A-Z][A-Z0-9_]*$` — all uppercase.
- **`target`** is the destination configuration file/group (`orbis-compose-env` for Orbis's
  compose environment).
- **Ownership.** A key declared here enters the catalog owned by the **package's own id**. A
  package cannot claim a key that already belongs to someone else — in particular, never a
  key owned by the core graph itself: the plan rejects the entire installation if it tries.
- **Declaring is not setting.** `provides.config_keys` registers that the key exists and who
  owns it; an operator sets the *value* afterward, through `vit` or the settings UI — never
  in the clear inside the manifest, and a secret only ever through the dedicated
  secret-replacement path.

#### `limen`, `knowledge` — declared, not yet executed at this stage

```yaml
provides:
  limen:
    groups: payload/limen/groups.json
    rules: payload/limen/rules.json
  knowledge:
    - collection: security_kb
      source: payload/kb/
      embedding_model: nomic-embed-text-v1.5
```

`limen` requires at least one of `groups`/`rules`. Neither effect runs automatically today
(the policy here is intentional: only declarative hooks, see
[Signatures and trust](/vit/trust) and the status box on the [Overview](/vit) page) — the
plan shows them, the receipt records them, and they appear as `next_steps` with the exact
manual action to take. Declaring them here is still the correct thing to do: when a later
stage automates them, the manifest does not need to change.

#### `files` — only under `pkg://`

```yaml
provides:
  files:
    - source: payload/templates/
      dest: pkg://templates/
```

`dest` must start with `pkg://` and must never contain `..`: a package never writes to the
checkout, or to a path of its own choosing — only under its own package root.

### `data`

```yaml
data:
  owned:
    - "collection:security_kb"
    - "volume:my_worker_data"
  on_remove: preserve
```

`owned` lists the data resources that belong to the package (a collection, a volume).
`on_remove: preserve` is the only allowed value in this format — and the default if the
field is missing entirely. None of these resources are ever deleted by a normal `remove`;
only `--purge`, after a successful backup receipt, **names** them as a follow-up step —
`vit` never deletes them itself.

## Payload

```
payload/
  wheels/            Python wheels, hashed in the checksum list
  compose.yml         compose fragment (service packages only)
  limen/
    groups.json
    rules.json
  kb/                source for a knowledge ingestion
  templates/          files to copy under pkg://
```

Container images are always referenced by digest against a registry; for offline
installation, an OCI archive with the same digest can also live under `payload/` — this
part is not yet automated by any command at this stage.

## Building

```python
from vit.pkg import archive
archive.build("my-package/", "dist/")
# -> dist/my-package-0.1.0.vit
```

The build is **deterministic**: sorted members, fixed mtime/uid/gid, no host-specific
metadata — building the same source twice produces identical bytes, even from two different
output directories. That is what makes signing the archive's bytes a meaningful statement.

If the package installs a wheel, build it **first** into `payload/wheels/`, with a fixed
source-date epoch so the wheel build itself is reproducible too:

```bash
SOURCE_DATE_EPOCH=0 python3 -m pip wheel --no-deps -w payload/wheels/ src/
```

The example packages under `packages/vit/examples/packages/` in the Orbis repository do
exactly this for each of their test packages — a direct reference to copy from rather than
reimplementing: copy the source into a temporary directory, build the wheel if
`src/pyproject.toml` exists, then call the archive build.

## Signing

**Development keys only, for now.** The production signing root does not exist anywhere in
the code — by design, the maintainers generate and hold it offline. Until it does, no
package can be signed for production use — only for testing, with a throwaway development
PKI:

```python
from vit.pkg.dev_pki import make_dev_pki
pki = make_dev_pki("a/scratch/path")
# pki.publisher_private_key signs the index (below)
# pki.root_document + pki.pinned_root_keyids build the source
```

Every key this produces carries `dev: true` in its metadata — not removable, not
bypassable: it is how the rest of the system knows it is not the production root.

## Building an index

An index is never written by hand: it is generated from already-built archives, which is
also the only way `sha256`/`size`/`requires` are never hand-written (and therefore never
falsifiable against the real archive):

```python
from datetime import datetime, timedelta, timezone
from vit.pkg.index import build_index

expires = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
index_document = build_index(
    ["dist/my-package-0.1.0.vit"],
    channel="public",              # or "licensed"
    base_url="file:///served/path",  # or https://... in production
    publisher_keys=[pki.publisher_private_key],
    version=1,
    expires=expires,
)
```

`index_document` and `pki.root_document` are written as `index.json` and `root.json` under
the directory a source serves (`file://` for a local test, `https://` in production —
`http://` is always rejected).

## Testing locally

The example script under `packages/vit/examples/demo.sh` in the Orbis repository is an
end-to-end template to copy: build the example packages → a throwaway development PKI → a
signed `file://` index → `packages sources add` → `search`/`install` (resolving
dependencies) → `list` → `verify` → tampering with the cached archive → `verify` failing as
expected → `remove`. It runs entirely under a temporary package root, and never touches a
real package root, a real Orbis configuration, Docker, or the network — every fetch is
`file://`. Run it as-is before adapting it to your own package:

```bash
bash packages/vit/examples/demo.sh
```

An automated test suite in the same repository tells the same story with assertions instead
of a human reading output — useful for seeing exactly what a new package is expected to
satisfy.

## The `security` skeleton

The example packages directory includes the first — and so far only — example of
`type: vertical`:

```yaml
type: vertical
requires:
  products:
    orbis: ">=1.39,<2"
    limen: ">=1.6,<2"
  packages:
    hello-connector: ">=0.1"   # not a real dependency, only to exercise requires.packages
provides:
  limen:
    groups: payload/limen/groups.json
    rules: payload/limen/rules.json
  knowledge:
    - collection: security_kb
      source: payload/kb/
      embedding_model: nomic-embed-text-v1.5
data:
  owned: ["collection:security_kb"]
```

This is **not** a real security vertical: it is the **skeleton** of what a vertical
declares — dependencies on the products it needs, Limen groups/rules, a knowledge base of
its own, the data it owns. `requires.products.limen` is a genuine check: installing this
package without a reachable Limen fails the precondition rather than pretending it is
satisfied — which is why the demo script starts a loopback stub that only answers a health
check, not a real Limen.

Anyone writing a real domain vertical package starts from this file, not from scratch:
adding real wheels, a real compose fragment, real configuration keys — the shape stays the
same.

## Minimal complete example

A connector that does nothing but declare itself:

```yaml
format: 2
id: example-minimal
version: 0.1.0
type: connector
title:
  en: Minimal example connector
  it: Connettore d'esempio minimo
license: apache-2.0
channel: stable

requires:
  products:
    orbis: ">=1.39,<2"

provides:
  connectors:
    - id: example
      wheel: payload/wheels/example_minimal-0.1.0-py3-none-any.whl
      entry_point: example_minimal:ExampleConnector

data:
  on_remove: preserve
```

With a `src/pyproject.toml` next to it (an installable Python package exposing
`example_minimal:ExampleConnector`), building the wheel → building the archive → signing
with a development PKI → building an index is enough to make it installable with a
`vit packages install example-minimal` for testing.
