# First-run on new hardware (daily-use runbook, 2026-09-09)

Steps matching what was actually done to bring the appliance up.
The public repo stays credential-free; all secrets are gitignored
local files.

> **Scope correction (2026-09-10):** this is a dated bring-up record, not a
> universal current deployment recipe. Use [Operations](OPERATIONS.md) and
> [Architecture](ARCHITECTURE.md) first. Tracked Compose includes host-specific
> mounts; no container name, timezone, backup job, or external provider is
> guaranteed on a fresh install. Confirm which configuration files
> `app.py::build_registry` actually reads before adding provider wiring.
> `/setup-wizard` now exists; optional depth-limited Git discovery also exists.
> Vault reset loses secrets and requires an explicit recovery decision; the
> historical reset command below is not a required installation step.
> Accessibility defaults are `motion: reduced` and comfortable contrast;
> OS requirements override application preferences.

## 1. Clone + install

```bash
git clone https://github.com/Rylee-Bee/personal-world.git
cd personal-world
uv sync --frozen --extra test --extra crypto
```

## 2. Local (gitignored) files you create once

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))" > .env-tmp
# paste that token into either one of these two paths:
#   (a) dev compose:  .env line  PW_API_TOKEN=...
#   (b) stack compose (VM deploy):  /opt/.env  PW_API_TOKEN=...  XIAOMI_MIMO_API_KEY=...
rm .env-tmp
```

## 3. Chat provider wiring (MiMo, OpenAI-compatible)

- put your real endpoint+model in
  `config/connections.local.json` (gitignored);
  tracked `config/connections.json` stays zero-provider
  (public-safety gate).
- put the actual API key in `.env`/`/opt/.env` under name
  `XIAOMI_MIMO_API_KEY` — compose forwards it into the core.
- form is serialized — never commit the literal value.

## 4. Vault unlock on first login

- the appliance serves `/setup` once; set a vault passphrase
  there. Passphrase is never stored; losing it requires deleting
  `/data/vault.enc` (you lose the stored secrets, not the world).
- `/data` volume holds world.json + journal.ndjson +
  reminders.json + repos/ + vault.enc; a rebuild preserves all.
- to reset: `docker exec personal-world sh -c "rm /data/vault.enc"`
  then re-unlock with the new passphrase.

## 5. Source-control status on new machine

`source_control.search_paths` entries are checked directly (no
recursion); point them at the repo dir itself:

```bash
docker exec personal-world sh -c \\\"git clone --bare https://github.com/Rylee-Bee/personal-world.git /data/repos/personal-world.git\\\" || true
```

(or plain `git clone` non-bare: same result for status).

## 6. Reminder key reminders

- no user-specific date or time — 24h clock topics; reminders use
  `cron_hour`/`cron_minute`, UTC-ish (container TZ=America/Chicago
  set in compose).
- Journal is append-only NDJSON. Backup via the nightly cron
  (NAS), or manual: `docker run --rm -v personal-world_world-data:/data alpine tar czf - /data > /path/backup.tar.gz`.

## 7. Accessibility floor, unchanged

Every dark-mode default, short-line, luminance-wording choice
stays as-is. If you add UI, keep contrast:high and motion:reduced.
