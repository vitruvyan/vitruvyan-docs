---
title: Regulatory evidence
---

# Regulatory evidence without a compliance oracle

Motus records and verifies bounded evidence. It does not decide which law
applies, whether an organisation is compliant, whether a control is effective,
or whether a dossier is legally sufficient. Those limits are part of the
contract, not disclaimers added after implementation.

## The model

Keep three layers separate:

1. **Declaration** — what a producer claims: a system manifest, risk, control,
   incident, retention policy, legal hold or registry event.
2. **Application evidence** — what one execution claims happened: a
   `ControlApplication`, human-oversight receipt, retention application or
   execution receipt.
3. **Verification result** — whether exact caller-supplied artifacts are
   structurally valid and whether their identities and bindings match.

A valid declaration is not proof that the declared state exists. A matched
binding is not proof of legal sufficiency. Missing evidence is `not_verified`,
never silently upgraded to a match.

## Shipped surfaces

| Source release | Surface | What it preserves |
|---|---|---|
| 0.15.0 | Canonical Evidence API and System Manifest | Canonical execution references plus declared runtime, graph, policy and control identity; binding verification remains separate. |
| 0.15.0 | Risk & Control Registry / `ControlApplication` | Governance intent remains separate from evidence that one control was evaluated or applied in one execution. |
| 0.17.0 | Human Oversight Receipt | One claimed oversight event and its exact artifact references, without inferring that the actor is human, authorised or competent. |
| 0.17.0 | Regulatory Evidence Profile | Opaque external requirement references mapped to Motus-owned evidence kinds, without embedding a jurisdiction or legal interpretation. |
| 0.18.0 | Incident / CAPA Ledger | Immutable incident and corrective/preventive-action revisions, evidence links, supersession and competing revisions. |
| 0.19.0 | Retention & Legal Hold | Policy and hold declarations, immutable scope snapshots, application evidence and bounded custody observations; never disposal clearance. |
| 0.20.0 | AI System Registry | Registration claims, append-only lifecycle events and bounded snapshots without asserting legal AI-system status or global completeness. |
| 0.21.0 | Regulatory Evidence Dossier | A canonical manifest plus deterministic ZIP of exact bytes, with semantic fingerprints and transport digests kept distinct. |
| 0.22.0 | Verification and Query API/CLI v1 | Read-only inspection, verification and fixed projections over one exact caller-supplied collection. |

## Verification and query

The Python facade and `motus-evidence` CLI compose the validators Motus already
owns. Every input declares its artifact kind, media type and local `input_id`.
The result names the exact `supplied_inputs`, and `global_complete` remains
false: Motus does not discover hidden evidence or select a global current state.

```console
motus-evidence request.json --json
motus-evidence request.json
```

JSON mode emits the stable result envelope. Human mode renders the same outcome,
findings and supplied scope. Exit 0 means `valid`, `matched` or `completed`;
failed verification exits 1, while malformed usage or request input exits 2.

Queries are not an open query language. Version 1 exposes only the projections
declared by the contract and only over the bounded supplied set. Verification
requires explicit companion artifacts; absent companions remain visible.

## Dossiers preserve bytes, not conclusions

A Regulatory Evidence Dossier names an exact bounded set of recognized Motus
artifacts. Its deterministic export stores `dossier.json` and the original
member bytes. Verification keeps separate:

- the dossier's semantic fingerprint;
- every artifact's existing semantic fingerprint;
- the SHA-256 digest of each transported member;
- the fingerprint of the exact export ZIP.

The archive is therefore a reproducible carrier, not a filing, approval,
certification or compliance report.

## Publication status

The source tags through `v0.23.0` exist. Recent GitHub Releases remain drafts,
and PyPI publication is not authorised. A source tag and a successful build do
not imply that the corresponding package is available from the public index.
