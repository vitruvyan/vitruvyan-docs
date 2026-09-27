---
title: Adapter profile v1
---

# Third-party adapter profile v1

Motus 0.23.0 adds a transport-neutral adapter boundary and a neutral
conformance corpus. An adapter may translate transport and storage, but Motus
remains the semantic authority for validation, execution, evidence and result
meaning.

The profile is an ephemeral integration protocol. Its request and result
envelopes are not evidence, receipts, attestations or compliance decisions.

## Responsibility boundary

| Motus owns | The host owns |
|---|---|
| canonical execution identity | authentication and tenant authorization |
| artifact and package validation | storage retrieval and durability |
| `PackageVerdict` meaning | network security, rate limits and deployment |
| Verification and Query v1 result | transport-specific routes and status codes |

The host must authorize before retrieval. Passing the conformance corpus does
not certify that it did so correctly.

## The four operations

| Operation | Request | Completed payload |
|---|---|---|
| `receipt.retrieve` | canonical ADR-027 `execution_ref` | exact contract-valid Motus receipt |
| `package.retrieve` | canonical `execution_ref` | exact package bytes as strict padded base64 |
| `package.verify` | canonical `execution_ref` plus exact package bytes | lossless JSON projection of `PackageVerdict` |
| `evidence.execute` | exact Verification and Query v1 request | exact Verification and Query v1 result |

The execution locator is `tenant/writer_id/BEGIN-sequence`. A run id, END
sequence, trace root, filename or UI identifier is not an execution reference.

Base64 is transport encoding only. An adapter must reproduce the exact decoded
bytes; it must not unpack, normalize, rebuild or repair a package in transit.

## Failure is not a verifier result

An adapter failure uses `outcome: failed` and one operational kind:
`invalid_request`, `unsupported_version`, `unauthorized`, `forbidden`,
`not_found`, `conflict`, `resource_exhausted` or `unavailable`.

A Motus verifier returning `not_verified`, `mismatched`, refused, damaged,
incomplete or conflict is different: the adapter operation completed and must
carry the unchanged Motus result. Rewriting that result as transport success or
failure destroys information and is non-conformant.

Unexpected implementation exceptions remain operational exceptions. They must
not be dressed as Motus verification results.

## Running the conformance kit

The Python distribution includes an in-process reference adapter, an executable
example and a frozen neutral corpus:

```python
from vitruvyan_motus import run_adapter_conformance

report = run_adapter_conformance(invoke)
assert report.conformant
```

From a source checkout at tag `v0.23.0`:

```console
python examples/07_adapter_profile.py
```

The runner gives a deep copy of each request and setup to the caller-supplied
hook, validates both sides, checks exact equality and reports mutation
separately. It also includes negative and hostile cases, including malformed
upstream results that must escape as operational exceptions.

Passing establishes preservation of this boundary for the supplied cases only.
It does not establish authentication quality, tenant isolation, availability,
storage durability, security, retention, publication, legal identity, legal
time or compliance.

## Orbis mapping

The qualified Orbis bridge already exposes two related operations:

- receipt retrieval by canonical execution reference;
- evidence verification after retrieving the package for that same reference.

Orbis owns its service token, writer boundary, HTTP routes and status mapping.
The qualification showed that it preserved the structured Motus result, but it
did not claim byte-for-byte implementation of the adapter v1 envelope, public
`package.retrieve`/`package.verify` routes, or browser-UI qualification.

## Release evidence

The `v0.23.0` tag points to the ancestry-preserving merge verified by Jenkins.
The tag workflow built and verified the wheel and sdist, preserved one
authenticated workflow artifact and created a draft GitHub Release. The PyPI
publication job was skipped and remains unauthorised.
