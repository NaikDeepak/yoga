#!/usr/bin/env bash
# Shared notepad for the coding agents working on this repo (Claude Code = "claude", Antigravity = "agy",
# OpenAI Codex = "codex") and Deepak ("deepak"). Claude Code leads and assigns work. Append-only log in .collab/notepad.md (gitignored). See AGENTS.md → "Working with
# another agent".
#
#   scripts/collab.sh read [N]                    last N entries (default 30)
#   scripts/collab.sh status                      active claims + entries addressed to each agent
#   scripts/collab.sh post <from> <to> "<text>"   message (to: claude | agy | codex | deepak | all)
#   scripts/collab.sh claim <agent> "<branch · area/files>"
#   scripts/collab.sh release <agent> ["<note>"]
#   scripts/collab.sh handoff <from> <to> "<branch · what's done · what's next>"
set -euo pipefail
# One notepad for the whole repo: worktrees share git's common dir, so resolve the MAIN checkout from it
# (an agent working in a worktree must write to the same notepad as everyone else).
COMMON="$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [[ -n "$COMMON" ]]; then ROOT="$(dirname "$COMMON")"; else ROOT="$(cd "$(dirname "$0")/.." && pwd)"; fi
DIR="$ROOT/.collab"
PAD="$DIR/notepad.md"
LOCK="$DIR/.lock"
AGENTS="claude agy codex deepak all"
mkdir -p "$DIR"
[[ -f "$PAD" ]] || printf '# Agent notepad (append-only; newest at the bottom)\n# time | from → to | KIND | text\n\n' > "$PAD"

valid() { [[ " $AGENTS " == *" $1 "* ]] || { echo "Unknown agent '$1' (use: $AGENTS)" >&2; exit 2; }; }
append() { # one line, under a lock so two agents can't interleave writes
  local tries=0
  until mkdir "$LOCK" 2>/dev/null; do
    tries=$((tries + 1)); [[ $tries -gt 50 ]] && { echo "notepad is locked (stale $LOCK? remove it)" >&2; exit 1; }
    sleep 0.1
  done
  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
  printf '%s | %s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" >> "$PAD"
  rmdir "$LOCK"; trap - EXIT
}
oneline() { printf '%s' "$*" | tr '\n' ' '; }

cmd="${1:-read}"; shift || true
case "$cmd" in
  read)
    grep -v '^#' "$PAD" | grep -v '^$' | tail -n "${1:-30}" ;;
  status)
    echo "Active claims:"
    awk -F' \\| ' '$3 ~ /^CLAIM/ { split($2, p, " "); c[p[1]] = $1 " — " $4 }
                   $3 ~ /^RELEASE/ { split($2, p, " "); delete c[p[1]] }
                   END { n = 0; for (a in c) { print "  " a ": " c[a]; n++ } if (!n) print "  (none)" }' "$PAD"
    for a in claude agy codex deepak; do
      n=$(grep -c " → \(${a}\|all\) |" "$PAD" || true)
      echo "Entries to $a (or all): $n — last: $(grep " → \(${a}\|all\) |" "$PAD" | tail -n1 | cut -c1-120)"
    done ;;
  post)
    [[ $# -ge 3 ]] || { echo "usage: post <from> <to> \"<text>\"" >&2; exit 2; }
    valid "$1"; valid "$2"; append "$1 → $2 | MSG | $(oneline "${@:3}")" ;;
  claim)
    [[ $# -ge 2 ]] || { echo "usage: claim <agent> \"<branch · area>\"" >&2; exit 2; }
    valid "$1"; append "$1 → all | CLAIM | $(oneline "${@:2}")" ;;
  release)
    [[ $# -ge 1 ]] || { echo "usage: release <agent> [\"<note>\"]" >&2; exit 2; }
    valid "$1"; append "$1 → all | RELEASE | $(oneline "${@:2}")" ;;
  handoff)
    [[ $# -ge 3 ]] || { echo "usage: handoff <from> <to> \"<branch · done · next>\"" >&2; exit 2; }
    valid "$1"; valid "$2"; append "$1 → $2 | HANDOFF | $(oneline "${@:3}")" ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
