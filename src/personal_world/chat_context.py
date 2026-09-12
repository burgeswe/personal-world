"""Chat context builder: assemble a safe, read-only world snapshot.

Everything the chat system prompt sees comes from the same read APIs
the dashboard uses. Private-class lore and journal events are excluded
by default (the journal API already disclosure-filters; the chat path
follows the strictest rule). Secrets never enter this path: no export,
no backup, no broker output is ever serialized into context.
"""

from pathlib import Path

from .journal import Journal
from .source_control import configured_search_paths, status_all
from .providers.registry import Registry
from .world import World

CONTEXT_HISTORY_EVENTS = 12
SOURCE_CONTROL_REPOS_IN_CONTEXT = 12


def _fmt_caps(statuses: dict) -> list[str]:
    lines = []
    for cap, s in sorted(statuses.items()):
        warn = f" ({'; '.join(s['warnings'])})" if s.get("warnings") else ""
        lines.append(f"- {cap}: {s['status']}{warn}")
    return lines


def build_world_context(
    world: World,
    registry: Registry,
    journal: Journal,
    include_journal: bool = True,
    config_dir=None,
) -> str:
    """Render the world as plain text for the chat system prompt."""
    summary = world.summary()
    parts: list[str] = ["## World summary"]
    parts.append(
        f"- facts: {summary['facts']}, intents: {summary['intents']}, "
        f"policies: {summary['policies']} "
        f"({summary['cemented_policies']} cemented), packs: {summary['packs']}"
    )
    lore = summary.get("lore", {})
    lore_bits = [f"{k}: {v}" for k, v in lore.items() if v]
    parts.append(
        "- lore: " + (", ".join(lore_bits) if lore_bits else "none recorded")
    )

    parts.append("\n## Capability status")
    parts.extend(_fmt_caps(registry.status_map()))

    actors = registry.actors()
    if actors:
        parts.append("\n## Connected components (staff directory)")
        for a in actors:
            parts.append(
                f"- {a.name}: role={a.role}, status={a.status}, "
                f"writes={a.writes}"
            )

    intents = sorted(world.intents)
    if intents:
        parts.append("\n## Stated intent (what the operator wants true)")
        for key in intents:
            v = world.intents[key].value
            vs = v if isinstance(v, str) else str(v)
            parts.append(f"- {key} = {vs}")

    policies = sorted(world.policies)
    if policies:
        parts.append("\n## Policies (hard rules)")
        for key in policies:
            p = world.policies[key]
            extra = " (cemented)" if p.mutability == "cemented" else ""
            parts.append(f"- {key}: {p.effect.value}{extra}")

    public_lore = [
        (k, l) for k, l in sorted(world.lore.items())
        if l.classification.value == "world"
    ]
    if public_lore:
        parts.append("\n## Lore (world-classified only)")
        for k, l in public_lore:
            vs = l.value if isinstance(l.value, str) else str(l.value)
            parts.append(f"- {k} [{l.state.value}]: {vs}")

    if include_journal:
        events = journal.recent(CONTEXT_HISTORY_EVENTS)
        if events:
            parts.append("\n## Recent journal (newest last)")
            for e in events:
                ts = e.provenance.observed_at.strftime("%Y-%m-%d %H:%M")
                parts.append(f"- {ts} {e.kind.value}: {e.summary}")

    if config_dir is not None:
        parts.extend(
            _source_control_block(Path(config_dir))
        )

    return "\n".join(parts)


def build_ui_context(
    route: str | None,
    section_id: str | None,
    section_label: str | None,
    section_status: str | None,
    section_capabilities: tuple[str, ...] | list[str] | None,
    entity: str | None = None,
) -> str | None:
    """Render the caller's observed UI location for the system prompt.

    This is provenance, NOT canonical truth: the client says where in
    the interface the person is; the server trusts it only as a hint
    ("observed from the UI") and never as world state. Anything missing
    or unrecognized renders as honest `unknown` rather than being
    dropped silently — a stale tab must not produce a confident lie.
    Returns None when the caller sends nothing (global chat), in which
    case no UI-location block is injected at all.
    """
    if not route and not section_id:
        return None
    label = section_label or "unknown section"
    status = section_status or "unknown"
    caps = ", ".join(section_capabilities or ()) or "none declared"
    lines = [
        "## Where the person is (observed from the UI, not world state)",
        f"- route: {route or 'unknown'}",
        f"- section: {section_id or 'unknown'} ({label})",
        f"- section status: {status}",
        f"- section capabilities: {caps}",
        f"- selected: {entity}" if entity else "",
        "If the person asks about 'here' or 'this page', they mean this "
        "section. Answer from the canonical context block; if the answer "
        "is not there, say so plainly.",
    ]
    return "\n".join(lines)


def _source_control_block(config_dir) -> list[str]:
    paths = configured_search_paths(Path(config_dir))
    if not paths:
        return []
    try:
        repos = status_all(paths)
    except Exception:
        return []
    if not repos:
        return ["\n## Source repositories", "- none found in configured paths"]
    ahead = sum(1 for r in repos if (r.get("ahead") or 0) > 0)
    behind = sum(1 for r in repos if (r.get("behind") or 0) > 0)
    dirty = sum(1 for r in repos if r.get("dirty"))
    out = [
        "\n## Source repositories",
        f"- {len(repos)} watched: {ahead} ahead of remote, {behind} behind, "
        f"{dirty} with uncommitted changes",
    ]
    for r in repos[:SOURCE_CONTROL_REPOS_IN_CONTEXT]:
        state = []
        if (r.get("ahead") or 0) > 0:
            state.append(f"ahead {r['ahead']}")
        if (r.get("behind") or 0) > 0:
            state.append(f"behind {r['behind']}")
        if r.get("dirty"):
            state.append("uncommitted changes")
        out.append(
            f"- {r['name']} [{r.get('branch') or '?'}]: "
            f"{', '.join(state) if state else 'clean'}"
            + (f" — last: {r['last_commit_subject']}"
               if r.get("last_commit_subject") else "")
        )
    return out