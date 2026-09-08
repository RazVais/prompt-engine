#!/usr/bin/env bash
# Copy this repo's project skills into the user-global Claude Code skills dir
# (~/.claude/skills). Run after merging a monthly refresh PR and `git pull`.
#
#   bash tools/sync-skills.sh
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.claude/skills" && pwd)"
dst="$HOME/.claude/skills"

[ -d "$src" ] || { echo "no skills dir at $src" >&2; exit 1; }
mkdir -p "$dst"

count=0
for dir in "$src"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  mkdir -p "$dst/$name"
  cp -R "$dir." "$dst/$name/"
  echo "synced $name"
  count=$((count + 1))
done
echo "$count skill(s) synced to $dst"
