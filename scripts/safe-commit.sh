#!/bin/sh
# safe-commit.sh -- stage explicit paths, run pytest, commit.
# Guards against the shared-checkout hazard: `git add -A` sweeping a
# colleague's WIP. Usage:
#   scripts/safe-commit.sh -m "message" <path> [<path> ...]
#   scripts/safe-commit.sh --force -m "message" <path> ...
set -eu

force=0
while [ $# -gt 0 ]; do
    case "$1" in
        --force) force=1; shift ;;
        -m) msg=$2; shift 2 ;;
        -m*) msg=${1#-m}; shift ;;
        --) shift; break ;;
        -*) printf 'unknown flag: %s\n' "$1" >&2; exit 2 ;;
        *) break ;;
    esac
done
[ $# -ge 1 ] || { printf 'usage: safe-commit.sh -m "message" <path> ...\n' >&2; exit 2; }
[ -n "${msg:-}" ] || { printf 'error: -m "message" required\n' >&2; exit 2; }

for p in "$@"; do
    [ -e "$p" ] || { printf 'error: path not found: %s\n' "$p" >&2; exit 2; }
done

outside=$(git status --porcelain | sed 's/^...//' \
    | while IFS= read -r f; do
        skip=0
        for p in "$@"; do
            case "$f" in "$p"|"$p"/*) skip=1; break ;; esac
        done
        [ "$skip" -eq 0 ] && printf '%s\n' "$f"
    done)
out_count=$(printf '%s\n' "$outside" | grep -c . || true)
if [ "$out_count" -gt 5 ] && [ "$force" -eq 0 ]; then
    printf 'error: %s modified files outside the given paths:\n' "$out_count" >&2
    printf '%s\n' "$outside" >&2
    printf 're-run with --force if this is intentional.\n' >&2
    exit 1
fi

uv run pytest -q

git add -- "$@"
git commit -m "$msg"
printf 'committed %s path(s) after pytest.\n' "$#"