---
title: Try it in ten minutes
---

# Try Limen in ten minutes

You need Docker, ssh access to the private Motus repository (to build the wheels once), and one
model to route to — a local Ollama is enough. Everything below is condensed from the
repository's own `docs/TRY-IT.md`; run the commands there for the up-to-date, copy-pasteable
version.

---

## 1. Build

```bash
git clone git@github.com:vitruvyan/limen.git && cd limen
bash docker/build-wheels.sh                # Motus + the OpenTimestamps plug, from the private repo
cp docker/.env.example docker/.env         # then edit: master key, Postgres password, tenant
docker build -f docker/Dockerfile -t limen-gateway:local .
```

Map the two logical models in `docker/litellm_config.yaml` (`local-default`, `external-default`)
to your provider/model — the proxy refuses to start while a `REPLACE_ME` is left. With only
Ollama available, map both to it. As administrator, `LIMEN_POLICY_TABLE` optionally points at
your own JSON policy table; leave it unset for the built-in one.

## 2. Start

```bash
cd docker
docker compose --profile local up -d      # limen, limen-db, ollama
docker compose exec ollama ollama pull qwen2.5:0.5b
curl -s http://127.0.0.1:4000/health/liveliness   # "I'm alive!"
```

Nothing listens outside loopback by default — put your own TLS proxy in front before exposing it.

## 3. Give people keys

LiteLLM needs the team first, then keys bound to it. Groups live in the key's metadata (or in
JWT claims once OIDC is wired); a team is a tenant, not a group.

```bash
export K="Authorization: Bearer $LITELLM_MASTER_KEY"
curl -s -H "$K" -H 'Content-Type: application/json' http://127.0.0.1:4000/team/new \
  -d '{"team_id":"acme","models":["local-default","external-default"]}'
curl -s -H "$K" -H 'Content-Type: application/json' http://127.0.0.1:4000/key/generate \
  -d '{"user_id":"alice","team_id":"acme","metadata":{"groups":["legal"]},"models":["local-default","external-default"]}'
```

## 4. Ask, and watch the policy decide

Point any OpenAI client at `http://127.0.0.1:4000/v1` with Alice's key. With the default policy,
see the four outcomes on [Policy and decisions](./policy-and-decisions#three-routes-one-meaning-each)
fire for real. Assert a data class with `X-Limen-Data-Class: <class>`, or set
`metadata.data_class` on the virtual key as its default — the header wins when both are present;
without either, an attachment means `documents`, otherwise `text`.

## 5. Look at the evidence

```bash
docker compose exec limen sh -c \
  'ls /data/evidence/decisions /data/evidence/effects /data/evidence/commitments/*/*'
docker compose cp limen:/data/evidence ./evidence
motus-validate jsonl evidence/decisions/<one>.jsonl        # from any machine with vitruvyan-motus
motus-validate checkpoint evidence/commitments/*/*/checkpoint-000000.json
grep -rl "<a phrase from your prompt>" evidence/ || echo "the prompt is in no file"
```

The effect run of a request carries `caused_by` = the root of its decision run. Every
`LIMEN_SEAL_INTERVAL` (an hour, by default) the window is sealed into a checkpoint chained to the
previous one — see [Evidence and proof](./evidence-and-proof) for what each of these proves.

## 6. See a violation

`LIMEN_ALERT_WEBHOOK_URL` is optional; its absence is logged at startup and fails nothing. When
set, it fires only for `deny` and `review`, after the decision is recorded, carrying no prompt,
reply, or original request headers — only the fields in `alert.PAYLOAD_FIELDS`.

```bash
export LIMEN_EVIDENCE_DIR=./evidence
python -m limen.evidence.review list --json
python -m limen.evidence.review list --route deny
```

The alert is a courtesy — one attempt, no retry. An auditor trusts the decision run in
`evidence/decisions/`, not the webhook.

## 7. Anchor (optional, needs outbound network)

```bash
docker compose --profile anchor run --rm --no-deps --entrypoint /app/.venv/bin/python \
  limen-anchor -m limen.evidence.anchor submit
docker compose --profile anchor run --rm --no-deps --entrypoint /app/.venv/bin/python \
  limen-anchor -m limen.evidence.anchor status
# hours later:
docker compose --profile anchor run --rm --no-deps --entrypoint /app/.venv/bin/python \
  limen-anchor -m limen.evidence.anchor upgrade
```

`status` says `pending` until the proof is in a Bitcoin block. It never says more than it can
prove.

## What this does not claim (ADR-002)

With `mode: local`, the evidence proves integrity and, once anchored, existence at a block time.
It does not prove that no request was deleted before sealing — that needs a witness independent
of whoever runs Limen, and there is none yet. See
[Evidence and proof](./evidence-and-proof#what-assurance-mode-local-means-and-does-not-mean-adr-002)
for exactly what this means and does not mean.
