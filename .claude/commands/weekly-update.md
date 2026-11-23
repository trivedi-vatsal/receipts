---
description: Add the past week's work to your receipts (collect evidence, write the weekly note, update topics, overview and share pages)
---

Add the work done since the last run to these receipts. Read `config.json` first: `name` is the person, `org` the employer, `pronouns` how to refer to them. Work only inside this folder; treat every repo under `code_dir` as read-only.

## 1. Prepare (scripts, no AI)

Arguments: $ARGUMENTS

If the arguments say the drafts are ready (the scheduled run does this), skip to the queue below. Otherwise run, in order:
1. `python3 scripts/collect.py --no-summaries`: gathers the evidence since the last run.
2. `python3 scripts/draft.py`: writes the facts-only draft note and the draft week on the share pages.
3. `python3 scripts/collect.py --mark-done`: advances `state.json`.
4. For each draft in the queue, `python3 scripts/collect.py --summarise evidence/<name>` in the background. It writes self-summaries of the big sessions and can take 10 to 20 minutes; it does nothing for folders that have none. Wait for it before step 2.

**The queue** is every `weekly/*_to_*.md` whose first line starts with `<!-- draft`, oldest first. Do steps 2 to 4 for each one in turn. An empty queue means there is nothing to do: say so and stop. For a draft named `<since>_to_<until>`, the evidence folder is `evidence/<since>_to_<until>/`. It holds:
- `sessions-<project>.md`: Claude Code session digests. Each `### SESSION <id>` header gives the start, folder, branch and number of commits. The block lists:
  - the person's prompts (`USER:`);
  - the assistant's full final reply to each one (`A:`);
  - git, PR and deploy commands (`CMD:`);
  - test-run counts (`TEST: <command> -> <counts>`).
  It ends with `FILES EDITED (n)` and, if any, `PLAN DOCS` (AUDIT, PLAN and TASKS files touched).
- `session-summaries/<project>-<session-id>.md`: self-summaries of the big sessions (digest over 150 KB or 10 or more commits). Each one covers goal, decisions and why, what shipped, numbers measured and what is still open. It covers the whole session, which may start before this window. `summary.json` → `self_summaries` lists any that failed.
- `git.txt`: the person's commits in matching repos, deduplicated, with `--shortstat`.
- `cli-prompts.txt`: terminal prompts.

The draft already holds the counted facts: the at-a-glance table, sessions with branches and test results, PRs, candidate ticket keys, every commit with its line counts, and the previous week's open items. **Trust those numbers and do not recount them from `git.txt`.** Drop candidate ticket keys that are clearly not tickets (such as `UTF-8`).

Secrets, tokens, private IPs and connection strings are already redacted. Keep them redacted if you find any that slipped through.

## 2. Read

Read every self-summary in `session-summaries/` first. They give the goal, the decisions and why, and the measured numbers for the biggest sessions. Then check each one against its digest and the draft's commit list, and use only the parts that fall inside this window. Where a summary and the digest or git disagree, trust the digest and git, and note the difference. Read every digest in full. For any digest over 150 KB, give it to a `general-purpose` subagent. Pass it the file path, the topic file it belongs to, and the rules in step 4, and ask it for dated notes in return. Run those subagents in parallel. You may read the repos to confirm facts, using `git log`, `git show --stat`, `gh pr view` and the READMEs and plan folders. Never write to a repo.

## 3. Map to topics

Use the **Topic map** table in `topics/00-OVERVIEW.md` (evidence project dir or repo → topic file).

If a project has no row, it is new. When it has 3 or more commits or 2 or more sessions this week, create `topics/NN-<name>.md` with the next free number from `topics/_TEMPLATE.md`. Add a row for it to the Topic map and to the file list in `topics/00-OVERVIEW.md`. Smaller new work goes in the weekly note only.

## 4. Write

Writing rules:
- Be plain, factual and dated (YYYY-MM-DD). Give commit short hashes, PR numbers, ticket keys, branches, test counts and measured outcomes. Avoid marketing tone, filler and heavy use of em dashes.
- Call the person by `name` and use `pronouns`. Where the work was done with an AI assistant, describe it as the person directing it (briefs, reviews, corrections, decisions).
- Credit only the person's own commits and sessions. Name colleagues only where commit authorship or the sessions name them.
- Redact passwords, tokens, keys, private IPs and connection strings. Leave out customer personal data. Don't invent; mark anything uncertain.

Write these, in order:
1. **`weekly/<since>_to_<until>.md`**: rewrite the draft in place. Remove the `<!-- draft` first line and "(draft)" from the title. Keep the at-a-glance table and the sessions table, and add a line for tests. Replace the `## Commits:` lists with a section per topic of dated bullets that cite commit short hashes. End with **Open items**: new items this week, plus each carried-over item marked done, still open or unknown.
2. **Each touched topic file**: append under a `## Weekly log` heading at the end of the file (create the heading once). Add a `### <since> to <until>` section of dated bullets with links back to the weekly note. Edit earlier sections only to correct facts the new evidence disproves, and say so.
3. **`topics/00-OVERVIEW.md`**: under `## Weekly log`, add one table row: week (linked to its note) | commits | sessions | main work in one line. Update the headline numbers only if the change is large.
4. **`share/data.json`** (feeds the plain-language share pages for managers, reviews and promotion packets: `share/index.html` summary, `timeline.html`, `week.html`, `areas.html`). Edit only this JSON file; never edit `share/data.js`, it is generated.
   - If `title` is empty (first run), fill `title` ("<name> at <org>"), `eyebrow`, `lede` and `footer` from `config.json`, and set `areas` to 3 to 6 broad areas of the person's work (`{"key": "Label"}`, short lowercase keys), most active first.
   - `draft.py` already added this week to `weeks` with `"draft": true`. Finish that object; don't add a second one with the same `start`. Write `headline` and 3 or 4 `items` (`[[<area>, "..."], ...]`), then delete `draft`. Add `note` only for an incident or a security finding. If new work fits no area, use the closest one; add an area only if there are fewer than 6.
   - `repos` maps each repo (as named in the draft's table) to an area key; `draft.py` uses it to count commits by area without AI. If the week has an `unmapped` object, add each of its repos to `repos`, add their counts to `commits`, then delete `unmapped`.
   - Replace `attention` with the current open items that need a decision or someone else's help, 6 at most: `["decide" or "fix", "short title", "one or two sentences"]`.
   - Add to `results` only for a new measured before/after: `["29 s → 4.8 s", "<b>What got faster.</b> One line of context."]`. These are the headlines, so keep them exact and sourced. `<b>` is the only HTML allowed, in `results` and `note`.
   - `stats` holds up to 2 extra headline tiles `["~80", "reviewed PRs merged this quarter"]`; update them only when the number changes a lot. `terms` holds `["Term", "plain definition"]` pairs for jargon the pages use.
   - Set `updated` to today.
   - Write for non-technical readers. Leave out commit hashes, PR and ticket numbers, and repo or library names. Say what users, customers or the team get. Same honesty rules as above.
   - Run `python3 scripts/build-share.py`. It validates `data.json` and builds `share/data.js` with every weekly note. If it reports errors, fix `data.json` and run it again.
   - The pages are local files only. Do not publish them anywhere.

## 5. Finish

Once every draft in the queue is written up, run `python3 scripts/build-share.py` one last time. Do not run `--mark-done` here: step 1 already did. If you stop partway, the notes still marked draft stay in the queue for the next run. Finish with a five-line summary.
