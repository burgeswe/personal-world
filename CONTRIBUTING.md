# Contributing and support

Personal World is in active development. Start with the [README](README.md)
and [architecture](docs/ARCHITECTURE.md); the full map is the
[documentation index](docs/INDEX.md), and design work starts at the
[handoff index](design/handoff/README.md). Public issues are suitable for
non-sensitive bugs, questions and ideas. Use [private reporting](SECURITY.md)
for security concerns. There is no support response-time guarantee.

## A small, reviewable change

1. Read [AGENTS.md](AGENTS.md). Use your own branch and isolated checkout; check
   current remote branches and PRs before editing shared design material.
2. Preserve unrelated work and stage only named files. Do not force-push shared
   branches, delete meaningful branches, or rewrite history without coordination.
3. Use synthetic examples. Never include live endpoints, personal identities,
   tokens, private keys, local configuration, journal data, logs or backups.
   Inspect archives and image metadata before uploading them.
4. Run `uv sync --frozen --extra test`, `uv run pytest --timeout=30`, and
   `uv run personal-world framework validate --json` from the repository root.
5. Open a PR explaining the behavior, evidence, and remaining limitations.
   A passing local check is not evidence of a deployed runtime.

## Where things live

The [documentation index](docs/INDEX.md) maps every document and marks
its status (canonical / normative / spec / archived). [AGENTS.md](AGENTS.md)
records the working-tree rules and where design truth lives — read it
before editing shared design material.

## Design and licensing

Keep source rigs and approved animations intact unless the task explicitly
authorizes changing them. The Mermaid master is documented in the
[asset index](design/assets/README.md); renderer QA remains a separate gate.
Respect reduced motion, static alternatives, keyboard access and the
[accessibility contract](docs/accessibility/ACCESSIBILITY_CONTRACT.md).

The repository includes an [Apache-2.0 license](LICENSE). Contributors must have
the right to contribute their code and artwork; preserve third-party notices and
record asset provenance. Public visibility alone is not evidence of ownership of
any third-party material.
