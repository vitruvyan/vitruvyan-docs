---
title: What vit is
---

# vit — the installer and control plane of the Vitruvyan galaxy

`vit` is the command-line tool that installs, updates and removes everything in the
Vitruvyan galaxy: the products (Orbis, Motus, Limen, and the consoles) and the `.vit`
packages that extend them (connectors, backends, services, whole domain verticals,
knowledge bases). It replaces an older, per-product setup flow with one tool that treats
every install as a signed, reviewable, reversible operation.

> **vit 2** is a rewrite, not a migration, of the previous installer. The legacy
> `vit setup`/`vit update` flow (see [Installation](/installation)) still works but is
> being phased out — see the note on that page.

## Products vs packages

Two different things live under `vit`, and the distinction matters for how each one ships:

- **Products** are software released on their own cadence, each from its own repository
  and channel: Orbis, Motus, Limen, the consoles. Motus is a special case — it is not
  installed as a running service, but embedded as a version-pinned library by the
  products that use it (Orbis, Limen).
- **`.vit` packages** are the `apk`/`deb` equivalent for the galaxy: connectors, plugins,
  backends (for example, a backup destination), services, entire domain verticals
  (`security`, `logistics`, …), or standalone knowledge bases. A `.vit` file is a signed
  archive — manifest, payload, and a checksum list — that a package author builds once and
  a signed index publishes. `vit` never executes arbitrary code to install one.

## The principles

- **Signed indexes, not URLs.** A package is only ever found through a signed index that
  `vit` verifies against a pinned root of trust, never fetched from an arbitrary location.
  See [Signatures and trust](/vit/trust).
- **Declared effects only, no install scripts.** A manifest lists exactly what an
  installation will do — write files under a package-owned path, declare a configuration
  key, add a container by digest, register a plugin entry point — and nothing else runs.
  There is no `postinst` hook and no shell script executed with the installer's
  permissions. If a package genuinely needs to run code at install time, the only path is
  a declared `job`: a container pinned by digest, shown in full in the plan before it runs.
- **Plan, then approval, then apply.** Every `install`, `remove`, and `upgrade` shows what
  would change before it changes anything. Anything with production-level impact —
  touching shared policy or knowledge — requires an explicit approval from a real terminal
  on the host; it is never applied from a script or a non-interactive session.
- **A receipt for every operation.** Each install, update, or removal produces a receipt
  recording what was installed, its verified digest, the signature verdict, and who
  approved it.
- **Data is preserved on removal, by default.** Removing a package never deletes the data
  it owns (a knowledge collection, a volume) unless an operator explicitly opts in after a
  verified backup.

## Status: what works today, what doesn't yet

| Area | Status |
|---|---|
| Package format, build, and signing (`vit pkg build`, dev signing keys) | Works |
| Signed indexes and three-level verification | Works |
| `vit packages search / info / list / verify` | Works |
| `vit packages install / remove / upgrade` with plan → approval → apply | Works |
| Recovery of an interrupted operation (`vit packages recover`) and per-transaction rollback | Works |
| Effects on `files`, `config_keys`, `connectors` / `graph_plugins` / `backends` (wheel + entry point) | Works |
| `services` effect (compose override written to disk) | Works — but `vit` never runs `docker compose` itself; starting the service is a manual next step shown in the plan |
| `limen` and `knowledge` effects | **Declared and shown as next steps, not yet executed.** A package can declare a Limen policy or a knowledge ingestion; the plan and receipt record it, but applying it today is a manual step through the relevant admin interface |
| `vit products install / update / rollback` (installing Orbis, Limen, etc. themselves from a signed artifact) | **Not yet available** — pending a release channel per product |
| Production signing root | **Not yet generated.** Every package signed today uses a development key, marked `dev: true`, and is not meant for production use |
| A first real domain vertical package (e.g. a `security` package) | **Not yet shipped** — only an example skeleton exists, showing the shape a real vertical package would take |

Read [Using vit](/vit/packages) for the operator side, [Writing a package](/vit/authoring)
for how to build one, and [Signatures and trust](/vit/trust) for how verification works
without needing to trust any single party — including the maintainers' own servers.
