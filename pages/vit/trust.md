---
title: Signatures and trust
---

# Signatures and verification

Every `.vit` package is only ever discovered through a signed index, and every signature
can be checked without asking any Vitruvyan server whether it is valid. This page explains
the trust model behind that: how the roles work, how a root of trust rotates, and what the
three levels of verification actually check.

## Roles: root and publisher

A trust document (`root.json`) declares two roles, each with a set of keys and a
**threshold** — the minimum number of that role's keys that must sign for a document to
count as valid:

- **`root`** — the ultimate authority. It signs `root.json` itself, including any future
  rotation of the roles it defines.
- **`publisher`** — signs the package index (`index.json`), which lists every package
  version, its digest, size, and metadata.

Splitting the two matters: the root key can be kept offline, used rarely (only to rotate
keys), while the publisher key that signs indexes regularly can be rotated on its own
without ever touching the root.

Every signed document uses the same detached-signature envelope: a `signed` body plus a
list of `{"keyid", "sig"}` entries. The body is hashed and signed as canonical JSON, so two
independent implementations that build the same body produce exactly the same bytes — a
signature travels unambiguously between them.

## Pinning the first root

`vit` does not ship a trusted `root.json` verbatim. It ships the **set of root-role
keyids** it was built trusting. The very first root document a source presents is accepted
only if:

- its own declared root-role keyids match that pinned set exactly, and
- it carries at least as many valid signatures from those keys as the role's threshold
  requires.

This is why a source's `root_keyids` has to come from whoever manages that index, out of
band — never read from the index itself. An index that could supply its own pinned keyids
could also supply forged ones.

## Rotating the root

After the first root is pinned, any later root update must satisfy the TUF rotation rule: a
new root document is accepted only if it is signed by **both**:

- enough keys from the **old** root's root role to meet the old threshold, and
- enough keys from the **new** root's declared root role to meet the new threshold.

A root signed only by the incoming keys — with no continuity from what was already trusted
— is exactly the attack this rule exists to stop: it would let a single compromised key
replace the entire trust chain in one step.

## Expiry and rollback protection

Every signed document — root or index — carries a version number and an expiry timestamp.
Two independent checks apply on every verification:

- **No rollback**: a new document's version must strictly exceed the last one this
  installation trusted. A document with an equal or lower version is rejected outright,
  even if it is validly signed — this stops an attacker from replaying an old, once-valid
  index after a package has been fixed or a key has been rotated.
- **No expired trust**: a document whose `expires` timestamp is at or before the current
  time is rejected, regardless of its signatures.

Both checks, along with the signature threshold check, run together, and every failure
reason is reported — verification does not stop at the first problem it finds.

## Three levels of verification

`vit packages verify` checks a package at three independent levels, in this order:

1. **Index signature** — the index a source served is checked against the pinned root of
   trust (the rotation and threshold rules above).
2. **Archive digest** — the cached archive's own sha256 and size are checked against what
   the verified index declares for that exact id and version.
3. **Internal integrity** — the archive's own checksum list and internal structure are
   checked, catching a corrupted or partially-written file even if levels 1 and 2 pass.

A failure at any level is reported with which level failed; the recommended remedy is
always the same — remove the package and reinstall it from a verified source, never trust
an archive that failed even one level.

## Why verification needs no Vitruvyan endpoint

Nothing in this chain calls out to a Vitruvyan-run service to ask "is this valid?" — every
check is a local computation over keys already pinned on the installation, the signed
documents fetched from the configured source, and the archive itself. A source can be
`file://` for a fully offline test, or `https://` in production; the verification logic
does not change, and does not depend on any party — including the maintainers — being
reachable or trusted at verification time. `http://` sources are rejected unconditionally,
because an unauthenticated transport would undermine that guarantee for the one artifact
(the index) everything else is checked against.

## Development keys today

Every key currently in use — for signing indexes, for signing packages in examples and
tests — is generated by a throwaway development PKI and carries `dev: true` in its
metadata. That flag is not cosmetic: it is how the rest of the system marks a package as
not suitable for production. A production root of trust, generated and held offline by the
maintainers, has not been created yet — see the status box on the
[Overview](/vit) page.
