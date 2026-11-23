# receipts

Proof of what you shipped: every claim dated and backed by a commit, PR or measured result. Once a week, Claude Code reads your git history and your Claude Code sessions, then writes up what you shipped: dated, with commit hashes, PRs and measured results. You end up with a running record for performance reviews, promotion packets and 1:1s, plus a plain-language page you can show a manager.

Everything runs locally. Nothing is uploaded anywhere.

**[Live demo](https://vatsal.xyz/receipts/)**: the share pages filled with six weeks of made-up data for a fictional engineer.

```
config.json    who you are and which repos count as work  ← edit this first
scripts/       collect.py (gathers evidence), draft.py (facts-only weekly draft, no AI),
               build-share.py (validates share/data.json → share/data.js),
               run-weekly.sh (headless run), receipts-weekly.plist (macOS schedule)
.claude/commands/weekly-update.md   the write-up procedure, run as /weekly-update
topics/        one living file per project; 00-OVERVIEW.md is the index and topic map
weekly/        one note per run: <since>_to_<until>.md
share/         the plain-language pages (open share/index.html in a browser)
evidence/      raw inputs per run: session digests, self-summaries of big sessions, git log,
               CLI prompts, summary.json (redacted, but still gitignored: it holds your prompts)
state.json     where the last run ended; the next run starts there
```

## What you get

- **`weekly/*.md`**: an engineering-level note per week. Commits per repo, lines changed, PRs, tickets, test counts, dated bullets per project, and open items carried forward.
- **`topics/NN-*.md`**: one file per project that grows week by week: what it is, your role, timeline, decisions, outcomes.
- **`share/`**: pages for non-technical readers, linked by a top nav:
  - `index.html`, **Summary**: headline numbers, items that need a decision, measured before/after results, a chart of where the effort went, the areas of work and the latest weeks.
  - `timeline.html`, **Timeline**: every week, latest first, filterable by area (`timeline.html#<area>` links straight to one area).
  - `week.html#<YYYY-MM-DD>`, **Week**: one week's highlights, the split of effort by area, and the full engineering note, with previous and next links.
  - `areas.html#<area>`, **Area**: one area's totals, its own chart and every highlight from it. `areas.html` alone lists all areas.

  The pages make no network requests and work straight from disk. To share them, send the whole `share/` folder (zip it) or host it on any static host behind your company's login. Printing a page gives a clean one-pager (the nav and filters are hidden).

## Setup

Requires [Claude Code](https://claude.com/claude-code), Python 3 and git. `gh` is optional (used to read PR details).

1. Use this template on GitHub, or clone it. **Keep your copy private**: it describes your employer's work.
2. Edit `config.json`. The collector refuses to run while it still holds the example values:

   | Key | Meaning |
   |---|---|
   | `name`, `org` | How the write-ups refer to you and your employer |
   | `code_dir` | Folder that holds your repos (searched recursively for `.git`) |
   | `match` | Regex for what counts as work. Matched against repo paths, git remotes and Claude Code project folders, e.g. `"acme\|billing-service"` |
   | `authors` | `git log --author` patterns for your commits (emails, names, handles). Empty → your `git config user.email` |
   | `pronouns` | Used in the write-ups |

3. In `.claude/settings.json`, change `Read(~/code/**)` to your `code_dir`.
4. Edit the example row in the **Topic map** in `topics/00-OVERVIEW.md`, or delete it and let the first run fill it.

## Run it

The work is split in two. Everything that can be counted runs as a plain script with no Claude usage. Claude only writes the prose.

| Step | Command | AI? |
|---|---|---|
| Collect evidence, write a facts-only draft note, add a "Draft" week to the share pages | `./scripts/run-weekly.sh --no-ai` | No |
| Write up every draft note, topics and share pages | `/weekly-update` in Claude Code | Yes |
| Both, unattended | `./scripts/run-weekly.sh` | Yes |

The draft (`weekly/<since>_to_<until>.md`, first line `<!-- draft ... -->`) already holds the commit tables, +/- lines, sessions with branches and test results, PRs, candidate ticket keys and last week's open items. The share pages show it straight away, marked Draft. Drafts pile up safely: run `--no-ai` every week and `/weekly-update` whenever you like, and it writes up every draft still in the queue, oldest first. Weeks with no work get a final note and never reach Claude.

Token savings come from four things. Claude never runs or waits on the collector, never recounts commits, never sees empty weeks, and maps repos to areas once: `share/data.json` → `repos`, which `draft.py` reuses. Self-summaries of big sessions do use Claude. `--no-ai` skips them, and `/weekly-update` (or the full run) creates them later with `python3 scripts/collect.py --summarise evidence/<window>`. Do that within 30 days, before Claude Code deletes the transcripts.

Output goes to `weekly/logs/<date>.log`.

The first run covers the last 30 days. After that, each run covers everything since `state.json`'s `last_run`, so a missed week just makes the next window longer.

Don't skip a month: Claude Code deletes session transcripts after 30 days by default, and only what `evidence/` already collected survives. To keep them longer, set `"cleanupPeriodDays": 365` in `~/.claude/settings.json`.

To backfill older weeks from git alone: `python3 scripts/collect.py --window 2026-01-05 2026-01-12 --no-summaries && python3 scripts/draft.py evidence/2026-01-05_to_2026-01-12` (leaves `state.json` alone). The next `/weekly-update` writes it up.

## Session evidence

`scripts/collect.py` writes one digest per project. Each session block holds the prompts, the full final reply to each, git and deploy commands, test counts and the files edited, plus any plan docs touched. Passwords, tokens, keys, private IPs and connection strings are redacted (`python3 scripts/collect.py --selftest` checks this).

Some sessions are big: a digest over 150 KB, or 10 or more commits. For each of those, the collector writes a self-summary to `evidence/<window>/session-summaries/<project>-<session-id>.md`. It runs this command from the session's own folder:

```sh
echo "Summarise this session: goal, decisions and why, what shipped, numbers measured, what's still open" |
  claude -p --resume <session-id> --fork-session --disallowedTools "Edit Write NotebookEdit Bash"
```

- **Read-only:** the fork cannot edit files or run commands.
- **Not counted as work:** the collector skips any session that starts from this prompt.
- **Reused:** an existing summary file is never redone.
- **Later:** the no-AI route skips them; `--summarise evidence/<window>` writes them afterwards (Claude usage, up to 4 in parallel).

## Weekly schedule (optional, macOS)

A headless run can't approve prompts, so the tools it needs are pre-allowed in `.claude/settings.json`. The collector runs from the shell script, so it needs no Claude permission there. Then:

```sh
mkdir -p weekly/logs
sed "s|__REPO__|$PWD|" scripts/receipts-weekly.plist > ~/Library/LaunchAgents/com.receipts.weekly.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.receipts.weekly.plist
# remove: launchctl bootout gui/$(id -u)/com.receipts.weekly
```

It runs Mondays at 10:00, or at the next wake if the Mac is asleep. On Linux, use cron: `0 10 * * 1 /path/to/receipts/scripts/run-weekly.sh`. The script holds a lock, so overlapping runs exit instead of colliding; failures are logged to `weekly/logs/<date>.log` and exit non-zero.

## Honesty rules

The procedure tells Claude to credit only your own commits and sessions, to date and source every claim, to mark anything uncertain, and to redact secrets, private IPs and customer data. Still, read each weekly note before you share it.

## Customize

- **Writing style and sections**: edit `.claude/commands/weekly-update.md`.
- **Share pages**: all content is `share/data.json` (`title`, `eyebrow`, `lede`, `footer`, `updated`, `areas`, `stats`, `results`, `attention`, `terms`, `weeks`). After editing it by hand, run `python3 scripts/build-share.py`: it checks the file and rebuilds `share/data.js`. Layout and colours are in `share/style.css`, rendering in `share/app.js`.
- **New project file layout**: `topics/_TEMPLATE.md`.
