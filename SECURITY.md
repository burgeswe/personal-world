# Security policy

Personal World is an early, single-user application. Security fixes target the
current `main` branch; there is no supported stable release series yet.

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/Rylee-Bee/personal-world/security/advisories/new)
for vulnerabilities or suspected exposed credentials. Do not open a public issue
or pull request containing a secret, personal data, private address, or exploit
against a live deployment. Include affected paths/commit IDs and a minimal
synthetic reproduction. Never send a working token or private key.

If private reporting is temporarily unavailable, do not post sensitive details
publicly; wait for the private reporting channel to be restored.

## Public repository boundary

This repository holds the generic application, public design contracts, and
approved showcase artwork. Keep deployment inventories, private provider config,
personal journals/lore, credentials, backups, and operational logs outside Git.
Use synthetic identities and reserved example domains in tests and documentation.
Review screenshots, SVG metadata, archive contents, and every commit in a PR.
An ignore rule does not remove files already tracked or erase history.

Load `PW_API_TOKEN` from private runtime configuration. Use a unique random token,
keep it out of URLs and logs, and protect remote access with TLS. The API rejects
protected requests when authentication is missing; this is not a substitute for
network access controls. Do not expose an experimental deployment to the internet
without reviewing its deployment and authentication boundaries.

## If a credential was published

Revoke or rotate it immediately with its issuer, then investigate use. Report
only its type, path and commit ID. Coordinate any history rewrite with the owner
and all active contributors; deleting the current file alone is insufficient,
and rewriting history cannot recall existing clones or copies.

## Automated gate

`tests/test_public_safety.py` runs in CI and locally. Beyond deployment
topology it scans every tracked text file for credential *shapes*
(provider key prefixes, private-key blocks, inline `api_key`/`token`/
`password` values, `VITE_*TOKEN`-style client env) and reports findings
redacted — the gate never prints the value it caught. Secrets are always
referenced by indirection (`api_key_env`, `token_env`, `secret_ref`); a
deliberate synthetic canary in a test must carry the marker
`pw-safety: synthetic` on the same line so the exception stays visible.

Nothing reachable by the browser build (Vite `import.meta.env`, public
assets) may ever hold a credential: it is inlined into the public bundle.
