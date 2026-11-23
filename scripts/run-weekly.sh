#!/usr/bin/env bash
# Weekly entry point (launchd: scripts/receipts-weekly.plist, or cron). Run by hand any time.
#   ./scripts/run-weekly.sh          collect + draft (no AI), then Claude writes up every draft
#   ./scripts/run-weekly.sh --no-ai  collect + draft only; run /weekly-update later to write them up
set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p weekly/logs
log="weekly/logs/$(date +%F).log"
# One run at a time: a slow collect must not overlap the next schedule.
lock=weekly/logs/.lock
if ! mkdir "$lock" 2>/dev/null; then echo "already running ($lock exists) at $(date)" >>"$log"; exit 1; fi
trap 'rmdir "$lock"' EXIT; trap 'exit 1' INT TERM
fail() { echo "$1 failed at $(date)" | tee -a "$log" >&2; exit 1; }

# 1. No AI: evidence, facts-only draft note, draft week on the share pages, state advanced.
python3 scripts/collect.py --no-summaries >>"$log" 2>&1 || fail collect
python3 scripts/draft.py 2>&1 | tee -a "$log" || fail draft
python3 scripts/collect.py --mark-done >>"$log" 2>&1 || fail mark-done
[ "${1:-}" = "--no-ai" ] && { echo "drafts ready; run /weekly-update to write them up" | tee -a "$log"; exit 0; }

# 2. AI: self-summaries of big sessions (outside Claude: they outlast a tool call), then the write-up.
command -v claude >/dev/null || fail "claude CLI lookup"
drafts=$(grep -l '^<!-- draft' weekly/*_to_*.md 2>/dev/null)
[ -z "$drafts" ] && { echo "nothing to write up at $(date)" >>"$log"; exit 0; }
for f in $drafts; do python3 scripts/collect.py --summarise "evidence/$(basename "$f" .md)" >>"$log" 2>&1; done
claude -p "/weekly-update drafts ready" --permission-mode acceptEdits >>"$log" 2>&1
rc=$?
echo "exit $rc at $(date)" >>"$log"
exit $rc
