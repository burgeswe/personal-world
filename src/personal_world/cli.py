"""CLI. Every command prints the stable JSON envelope with --json;
human output otherwise. Reads never mutate; writes require --apply."""

import argparse
import json
import sys
from pathlib import Path

from . import export
from .app import build_registry, load_world, save_world
from .envelope import EXIT_DENIED, EXIT_DRIFT, EXIT_ERROR, EXIT_OK, Result
from .framework import validate_connections, validate_compose_file, validate_settings_export
from .init import init_world
from .journal import Journal
from .loop import daily
from .providers.registry import Registry
from .updates import (
    UpdateRefused,
    UpdateRollbackFailed,
    build_provider,
    UpdateManager,
)
from .world import MutationDenied, UserAction, World, status


def _paths(args) -> tuple[Path, Path]:
    data_dir = Path(getattr(args, "data_dir", None) or "./data")
    config_dir = Path(getattr(args, "config_dir", None) or "./config")
    return data_dir, config_dir


def _emit(result: Result, as_json: bool, exit_code: int | None = None) -> int:
    if as_json:
        print(result.model_dump_json(indent=2))
    else:
        head = f"{result.status}: {'ok' if result.ok else 'not ok'}"
        print(head)
        for w in result.warnings:
            print(f"  ! {w}")
        for a in result.actions:
            print(f"  * {a}")
        if result.data is not None:
            print(json.dumps(result.data, indent=2, default=str))
    if exit_code is not None:
        return exit_code
    return EXIT_OK if result.ok else EXIT_ERROR


def cmd_status(world, registry, journal, args) -> int:
    return _emit(status(world), args.json)


def cmd_daily(world, registry, journal, args) -> int:
    result = daily(world, registry, journal)
    if getattr(args, "apply", False):
        save_world(world, Path(args.data_dir) / "world.json")
        result = result.model_copy(update={"changed": True})
    return _emit(result, args.json)


def cmd_journal(world, registry, journal, args) -> int:
    events = journal.recent(getattr(args, "n", 20))
    return _emit(
        Result(ok=True, status="healthy",
               data=[e.model_dump(mode="json") for e in events]),
        args.json,
    )


def cmd_actors(world, registry, journal, args) -> int:
    return _emit(
        Result(ok=True, status="healthy",
               data=[a.model_dump(mode="json") for a in registry.actors()]),
        args.json,
    )


def cmd_settings_export(world, registry, journal, args) -> int:
    return _emit(
        Result(ok=True, status="healthy", data=export.settings_export(world)),
        args.json,
    )


def cmd_world_export(world, registry, journal, args) -> int:
    return _emit(
        Result(ok=True, status="healthy", data=export.world_export(world)),
        args.json,
    )


def cmd_story_export(world, registry, journal, args) -> int:
    return _emit(
        Result(ok=True, status="healthy",
               data={"text": export.story_export(journal)}),
        args.json,
    )


def cmd_backup(world, registry, journal, args) -> int:
    payload = export.backup_payload(world, journal)
    out = Path(args.data_dir) / "backup-payload.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    if not getattr(args, "apply", False):
        return _emit(
            Result(ok=True, status="dry-run",
                   data={"would_write": str(out),
                         "note": "payload is unencrypted; encrypt with your "
                                 "SOPS/age mechanism before storage"}),
            args.json,
        )
    out.write_text(json.dumps(payload, indent=2, default=str))
    return _emit(
        Result(ok=True, status="written", changed=True,
               data={"path": str(out)}),
        args.json,
    )


def cmd_cement(world, registry, journal, args) -> int:
    try:
        world.cement(args.key)
        save_world(world, Path(args.data_dir) / "world.json")
    except KeyError:
        return _emit(Result(ok=False, status="unknown-policy",
                            warnings=[f"no policy '{args.key}'"]),
                      args.json, EXIT_ERROR)
    return _emit(Result(ok=True, status="cemented", changed=True,
                        data={"key": args.key}), args.json)


def cmd_init(world, registry, journal, args) -> int:
    from .init import init_world
    return _emit(init_world(Path(args.data_dir), Path(args.config_dir)),
                 args.json)


def cmd_manifest(world, registry, journal, args) -> int:
    return _emit(
        Result(ok=True, status="healthy", data=registry.manifest()),
        args.json,
    )


def cmd_framework_validate(world, registry, journal, args) -> int:
    """Validate connections.json, compose, and settings-export against
    the framework invariants (docs/NATIVE-BASELINE-AND-ENRICHMENT.md)."""
    import json as _json
    conn_path = Path(args.config_dir) / "connections.json"
    if not conn_path.exists():
        return _emit(
            Result(ok=False, status="not_configured",
                   warnings=["no connections.json to validate"]),
            args.json,
        )
    connections = _json.loads(conn_path.read_text())
    known = set(registry._contracts.keys())
    result = validate_connections(connections, known)
    compose_path = Path(__file__).resolve().parents[2] / "compose.yaml"
    if compose_path.exists():
        provider_names = {
            c.get("name") for c in connections.get("connections", [])
        }
        compose_result = validate_compose_file(compose_path, provider_names)
        result.violations.extend(compose_result.violations)
        result.ok = result.ok and compose_result.ok
    if result.ok:
        sx = export.settings_export(world)
        sx_result = validate_settings_export(sx)
        result.violations.extend(sx_result.violations)
        result.ok = result.ok and sx_result.ok
    payload = {
        "violations": [str(v) for v in result.violations],
        "count": len(result.violations),
    }
    if result.ok:
        return _emit(Result(ok=True, status="healthy", data=payload), args.json)
    return _emit(
        Result(ok=False, status="unhealthy",
               warnings=[str(v) for v in result.violations], data=payload),
        args.json, EXIT_ERROR,
    )


def _updates_manager(world, registry, journal, args) -> tuple:
    """Build the updates provider + manager, or None (not configured)."""
    provider = build_provider(
        config_dir=Path(args.config_dir),
        provider=getattr(args, "provider", "compose"),
        project_dir=getattr(args, "project_dir", None),
    )
    if provider is None:
        return None, None
    manager = UpdateManager(
        provider,
        journal,
        session_path=Path(args.data_dir) / "updates-session.json",
    )
    return provider, manager


def cmd_updates_check(world, registry, journal, args) -> int:
    provider, mgr = _updates_manager(world, registry, journal, args)
    if provider is None:
        return _emit(
            Result(ok=False, status="not_configured",
                   warnings=["no update target configured; set "
                             "PW_UPDATES_PROJECT_DIR or pass --project-dir"]),
            args.json,
        )
    result = mgr.check(None if getattr(args, "all", False) else getattr(args, "target", None))
    return _emit(Result(ok=True, status="healthy", data=result), args.json)


def cmd_updates_preview(world, registry, journal, args) -> int:
    provider, mgr = _updates_manager(world, registry, journal, args)
    if provider is None:
        return _emit(
            Result(ok=False, status="not_configured",
                   warnings=["no update target configured"]),
            args.json,
        )
    try:
        preview = mgr.preview(args.target)
    except KeyError:
        return _emit(
            Result(ok=False, status="unknown-target",
                   warnings=[f"unknown target '{args.target}' for provider "
                             f"'{provider.name}'"]),
            args.json,
        )
    return _emit(Result(ok=True, status="healthy", data=preview), args.json)


def cmd_updates_apply(world, registry, journal, args) -> int:
    provider, mgr = _updates_manager(world, registry, journal, args)
    if provider is None:
        return _emit(
            Result(ok=False, status="not_configured",
                   warnings=["no update target configured"]),
            args.json,
        )
    try:
        result = mgr.apply(args.target, confirm=bool(getattr(args, "yes", False)))
    except UpdateRefused as e:
        return _emit(Result(ok=False, status="refused", warnings=[str(e)]),
                     args.json, EXIT_DENIED)
    except UpdateRollbackFailed as e:
        return _emit(
            Result(ok=False, status="rollback-failed",
                   warnings=[str(e)],
                   data={"applied": True, "verified": False,
                         "rolled_back": False}),
            args.json, EXIT_ERROR,
        )
    if not result.verified and result.rolled_back:
        return _emit(
            Result(ok=False, status="rolled-back",
                   warnings=[result.error or "verify failed; rolled back"],
                   data=result),
            args.json, EXIT_ERROR,
        )
    return _emit(
        Result(ok=True, status="verified" if result.verified else "unverified",
               changed=result.applied, data=result),
        args.json,
    )


def cmd_updates_rollback(world, registry, journal, args) -> int:
    provider, mgr = _updates_manager(world, registry, journal, args)
    if provider is None:
        return _emit(
            Result(ok=False, status="not_configured",
                   warnings=["no update target configured"]),
            args.json,
        )
    try:
        result = mgr.rollback(args.target)
    except UpdateRefused as e:
        return _emit(Result(ok=False, status="refused", warnings=[str(e)]),
                     args.json, EXIT_DENIED)
    return _emit(
        Result(ok=True, status="rolled-back", changed=True, data=result),
        args.json,
    )


def cmd_updates_status(world, registry, journal, args) -> int:
    provider, mgr = _updates_manager(world, registry, journal, args)
    if provider is None:
        return _emit(
            Result(ok=False, status="not_configured",
                   warnings=["no update target configured"]),
            args.json,
        )
    return _emit(Result(ok=True, status="healthy",
                        data=mgr.status(live=bool(getattr(args, "live", False)))),
                 args.json)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="personal-world")
    p.add_argument("--data-dir", default="./data")
    p.add_argument("--config-dir", default="./config")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add(name, fn, **kw):
        sp = sub.add_parser(name, **kw)
        sp.add_argument("--json", action="store_true")
        sp.set_defaults(fn=fn)
        return sp

    add("status", cmd_status, help="world summary (read-only)")
    add("daily", cmd_daily, help="run the daily loop")
    sub.choice_map = None
    d = sub.choices["daily"]
    d.add_argument("--apply", action="store_true",
                   help="persist observed facts (default: dry-run)")
    add("journal", cmd_journal, help="recent journal events")
    sub.choices["journal"].add_argument("-n", type=int, default=20)
    add("actors", cmd_actors, help="staff-directory view of providers")
    add("settings-export", cmd_settings_export,
        help="shareable blueprint (no personal data)")
    add("world-export", cmd_world_export,
        help="portable personal configuration (no secrets)")
    add("story-export", cmd_story_export,
        help="human-readable journal rendering")
    b = add("backup", cmd_backup, help="backup payload (encrypt before storing)")
    b.add_argument("--apply", action="store_true")
    add("cement", cmd_cement,
        help="make a policy cemented (explicit user action)")
    add("init", cmd_init,
        help="initialize local world state (idempotent, zero providers)")
    add("manifest", cmd_manifest,
        help="machine-readable capability/provider manifest")
    fw = sub.add_parser("framework", help="framework-level tooling")
    fw_sub = fw.add_subparsers(dest="framework_cmd", required=True)
    fw_v = fw_sub.add_parser("validate",
                             help="validate config against framework invariants")
    fw_v.add_argument("--json", action="store_true")
    fw_v.set_defaults(fn=cmd_framework_validate)

    up = sub.add_parser("updates",
                        help="safe update flow: check/preview/apply/rollback")
    up.add_argument("--provider", default="compose",
                    help="update provider kind (compose|fake)")
    up.add_argument("--project-dir", default=None,
                    help="compose project directory (default: $PW_UPDATES_PROJECT_DIR)")
    up_sub = up.add_subparsers(dest="updates_cmd", required=True)

    def up_add(name, fn, help_):
        sp = up_sub.add_parser(name, help=help_)
        sp.add_argument("--json", action="store_true")
        sp.set_defaults(fn=fn)
        return sp

    up_c = up_add("check", cmd_updates_check, "check for available updates (read-only)")
    up_c.add_argument("target", nargs="?", default=None)
    up_c.add_argument("--all", action="store_true", help="check every target")
    up_add("preview", cmd_updates_preview,
           "show exactly what an apply would change (read-only)")\
        .add_argument("target")
    up_a = up_add("apply", cmd_updates_apply,
                  "apply the previewed update (requires --yes)")
    up_a.add_argument("target")
    up_a.add_argument("--yes", action="store_true",
                      help="explicit confirmation; refused without it")
    up_add("rollback", cmd_updates_rollback,
           "roll back to the journaled known-good state")\
        .add_argument("target")
    up_s = up_add("status", cmd_updates_status, "updates session state")
    up_s.add_argument("--live", action="store_true",
                      help="include a read-only check per target")

    args = p.parse_args(argv)
    data_dir = Path(args.data_dir)
    config_dir = Path(args.config_dir)
    world = load_world(data_dir / "world.json")
    registry = build_registry(world, Registry(), config_dir)
    journal = Journal(data_dir / "journal.ndjson")

    try:
        return args.fn(world, registry, journal, args)
    except MutationDenied as e:
        return _emit(Result(ok=False, status="denied", warnings=[str(e)]),
                     args.json, EXIT_DENIED)


if __name__ == "__main__":
    sys.exit(main())