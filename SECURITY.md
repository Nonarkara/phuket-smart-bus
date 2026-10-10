# Security

## Reporting

Report a vulnerability in private. Use a GitHub security advisory:

https://github.com/Nonarkara/phuket-smart-bus/security/advisories/new

If that form is closed, contact https://github.com/Nonarkara directly. Do not open a public issue, and do not paste a live token, a bearer value, or a dump of tracker payloads into a commit, an issue, or a pull request.

There is no bug-bounty programme in this repository.

## What helps

- The route or endpoint, and whether you hit `bus.nonarkara.org`, localhost, or a fork.
- What you sent and what came back (status, error string). Redact secrets.
- The impact you can already show: a crossed origin, an open ingest, a binding that fails open, a secret in git.

## What this project is

The public site is a Cloudflare Pages app. It relays a public bus tracker and stores fixes for research. It is not an operator login, and it does not hold passenger accounts.

A bus position on the map is the tracker doing what it does in public. That is not, by itself, a vulnerability.

`POST /api/collect/gps` stays closed unless the `INGEST_TOKEN` secret is set. Express live mode (`DATA_MODE=live`) refuses to boot without `SMARTBUS_BEARER_TOKEN` and `PKSB_INGEST_API_KEY`. Research reads on `bus.nonarkara.org/api/research/*` are rate-limited by the worker in `wrangler.research.toml` and fail closed when that binding is missing or throws. See the cost-guards section of the README.

## Supported versions

Security fixes land on `main`. The Pages site at `bus.nonarkara.org` tracks that branch when a deploy succeeds. Tagged releases are not how this repo ships.
