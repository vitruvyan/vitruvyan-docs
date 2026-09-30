---
title: Using vit
---

# Using vit: sources, commands, plans, receipts

This page is for an operator installing or maintaining `.vit` packages from a terminal. If
you are writing a package instead, see [Writing a package](/vit/authoring).

## Configuring a source

A package is only ever discovered through a signed index — never fetched from an arbitrary
URL. Before searching for or installing anything, configure at least one source:

```bash
vit packages sources add \
  --set name=vitruvyan-public \
  --set url=https://packages.example.com/public \
  --set channel=public \
  --set root_keyids=sha256:<hex>,sha256:<hex>
```

- **`url`** — `https://` for a remote source, `file://` for a local one (testing, offline
  use). Plain `http://` is always rejected, even for a source considered "internal".
- **`channel`** — `public` (openly licensed packages, consoles, open connectors) or
  `licensed` (packages that require a licence token). This is a different axis from a
  single package's own `stable`/`beta` channel.
- **`root_keyids`** — the keyids (`sha256:<hex>`) that `vit` pins its trust to the first
  time it fetches that source. Whoever manages the index communicates these to you out of
  band; `vit` never discovers them from the source itself — if it did, whoever could alter
  the index could alter the keyids it claims, too. See [Signatures and trust](/vit/trust).
- **`token`** (for a `licensed` source only) — never the raw value. Only a reference:
  `env:VARIABLE_NAME` or `file:/path/to/token`. `vit` resolves it at request time and never
  writes it to disk or prints it; both logs and `--json` output show only
  `{"set": true/false}`.

`vit packages sources list` shows configured sources (tokens included, always as
`{"set": bool}`); `vit packages sources remove <name>` drops a source without touching
packages already installed or their data.

## Commands

Every `packages` command accepts the package id (or a search term) as a plain positional
argument, the way `apk`/`deb` do: `vit packages install security`, not only
`--set id=security`. `--set` is still available for the other fields (`--file`, `--purge`,
`--backup-receipt`, …) and can be combined freely with the positional form — giving the
same field both ways is rejected, not silently overwritten.

| Command | Effect | Max impact |
|---|---|---|
| `vit products status` | Installed / available version and channel of Orbis, Motus, Limen | read |
| `vit packages search [text]` | Search every configured source's index | read |
| `vit packages info <id> [version]` | Every version of `<id>` known to configured sources | read |
| `vit packages list` | Installed packages, with version and applied effects | read |
| `vit packages verify [id]` | Re-verify the cached archive against what was recorded and against the index | read |
| `vit packages install <id[@range]>` | Resolve dependencies and install (or update if already present) | up to `production` |
| `vit packages install --file <path.vit> --allow-unsigned` | Install a local, explicitly-accepted unsigned archive | up to `production` |
| `vit packages remove <id> [--purge] [--backup-receipt <id\|path>]` | Remove; data is preserved by default | up to `production` |
| `vit packages upgrade [id]` | Upgrade one package, or all of them if `id` is omitted | up to `production` |

`vit packages install security` also resolves dependencies declared under
`requires.packages` (for example a connector the package needs) and installs them in the
same command, in resolver order.

Every command answers `--json` with the full envelope (`plan`, `apply`, `result`,
`errors`) — the format used in every example below. Without `--json` on an interactive
terminal, a guided flow runs instead.

## What a plan shows

Every `install`/`remove`/`upgrade` follows **plan → approval → apply**, never a direct
execution. The plan (`--json` without `--yes`, or the guided flow) always shows:

- **`changes`** — every key that would change, target by target: a file under `pkg://`, a
  declared configuration key, a service, and so on. A secret never appears in the clear,
  only as `{"set": true/false}`.
- **`effects`** — anything beyond writing state, for example `recreate_required` when a
  connector installs a wheel and the host process needs restarting to discover its entry
  point.
- **`next_steps`** — the exact command an operator must run by hand: starting a service
  (`docker compose -f … up -d --no-deps --no-build …`), setting a newly declared
  configuration key, applying a policy change. `vit` never runs these steps for you — see
  the status box on the [Overview](/vit) page for which effects are still manual today.
- **The signature verdict** — `index-verified` (the normal case, from a configured
  source) or `unsigned-local` (only with `--allow-unsigned` on a local file — the plan
  also carries an explicit warning, never a silent pass).
- **`impact`** — `none` / `local` / `service` / `production`, the highest level across
  every effect in the plan.

`--yes` applies the plan; without it, on a terminal, an interactive confirmation follows.

## Approval rules

A plan with `impact: production` — a package that declares a `limen` or `knowledge` effect
always reaches this level, because both touch shared data or policy — can only be applied
**from the host's own terminal**, never from a pipe or a non-interactive context:

```bash
vit packages install security --yes --approve-production
```

`--approve-production` is ignored, with a warning on stderr, if no real terminal is
attached. There is no way to bypass this from a script — it is the same rule that applies
to any other `vit` capability with `production` impact.

## Where state and receipts live

Everything `vit packages` writes lives under a **package root**, never inside a
checkout:

- `VIT_PKG_ROOT`, if set;
- otherwise a per-user state directory under the current user's home.

Inside it:

```
packages/<id>/<version>/     the extracted payload (pkg://<id>/<version>/…)
state/installed.json         what is installed, with which effects
state/receipts/               one receipt per install/update/remove
state/transactions/           the journal of an in-progress transaction
state/package_keys.json       declared configuration keys, per package
state/sources.json            configured sources
cache/archives/                downloaded .vit archives, for offline reinstall and verification
```

Every directory and file is created with restrictive permissions. A **receipt**
(`rc_*.json`) records the id, version, archive and image digests, the signature verdict,
the exact hash of the approved plan, and who requested and approved the operation.

## Recovering after an interrupted operation

If an `install`/`remove`/`upgrade` fails partway through (a step raises an error), the
transaction **rolls itself back**, in the same process — the receipt records
`outcome: "rolled_back"` and the package returns to its previous state. No manual step is
needed in this case.

If a rollback itself cannot finish (for example, a source file it needed to undo a step no
longer exists on disk), the receipt records `outcome: "failed"`, not `"rolled_back"` — the
outcome is never disguised as clean — and the transaction's journal stays under
`state/transactions/` for later recovery. While that journal exists, `install`, `remove`,
and `upgrade` refuse to start and point at the fix: `vit packages recover`. That command
shows every interrupted transaction and what it will undo, and on confirmation walks it
back step by step, leaving a receipt for each step. The same applies after a process crash
mid-operation.

## Troubleshooting

**`packages verify` fails** (non-zero exit, `cache.ok: false`, or a report with `ok: false`
at some level): the cached archive no longer matches what was recorded at install time — it
was altered, or the file is corrupted. The report's three levels say where: level 1 (index
signature), level 2 (sha256/size against the index), level 3 (the archive's internal
integrity — its checksum list, tar structure). Remedy: remove the package and reinstall it
from a verified source; never trust an archive that failed even one level.

**An `install` with `--file` is refused** ("refusing to install it unsigned"): a local
archive with no signed index behind it never installs by accident. It needs an explicit
`--allow-unsigned`, or installing from a configured source instead.

## Known limits

- **No atomicity across multiple packages.** When `install` resolves a dependency closure
  (a package pulling in a connector it requires), each package is its own transaction, with
  its own receipt, applied in resolver order. If one package fails partway through the
  overall operation, the ones already applied **stay installed** — there is no rollback of
  the whole operation, only of the transaction that failed.
- **`vit products status` never invents an available version.** Until a release channel
  exists for a given product, the answer is honestly "no version available, no release
  channel yet" — not a read of an unrelated repository's tags.
- **Development keys only, for now.** Until a production signing root is generated and
  held offline by the maintainers, every signed package is, by construction, `dev: true`.
  No package signed with a development key should be installed in production.
