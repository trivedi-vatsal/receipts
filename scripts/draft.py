#!/usr/bin/env python3
"""Turn a collected evidence folder into a facts-only draft, with no AI involved.

  python3 scripts/draft.py                      # the folder collect.py just made (state.json pending_until)
  python3 scripts/draft.py evidence/<window>    # a specific folder, e.g. a --window backfill
  python3 scripts/draft.py --selftest

Writes weekly/<window>.md (tables, commits, sessions, tests, PRs, tickets, carried-over open items),
marked as a draft on its first line, and adds the week to share/data.json as a draft. /weekly-update
later writes up every draft note: the drafts are its queue. An empty window gets a final
"no recorded work" note and no share entry, so the agent never sees it.
"""
import collections, datetime as dt, glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = '<!-- draft: facts only. /weekly-update writes this up and removes this line. -->'
COMMIT = re.compile(r'^([0-9a-f]{10}) (\d{4}-\d\d-\d\d) (.*)$')
STAT = re.compile(r'^\s*\d+ files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?')
TICKET = re.compile(r'\b[A-Z][A-Z0-9]{1,9}-\d+\b')  # ponytail: also catches UTF-8 style tokens; listed as candidates
PR = re.compile(r'\(#(\d+)\)|/pull/(\d+)')
SESSION = re.compile(r'^### SESSION (\S+) start=(\S+) cwd=\S* branch=(\S*) commits=(\d+)', re.M)


def parse_git(txt):
    """git.txt -> {repo: [[hash, date, subject, added, deleted], ...]}"""
    repos, cur = {}, None
    for l in txt.splitlines():
        if l.startswith('## '):
            cur = repos.setdefault(l[3:].rsplit(' (', 1)[0], [])
        elif cur is not None and COMMIT.match(l):
            cur.append([*COMMIT.match(l).groups(), 0, 0])
        elif cur and STAT.match(l):
            a, d = STAT.match(l).groups()
            cur[-1][3:] = [int(a or 0), int(d or 0)]
    return repos


def parse_sessions(txt):
    """A sessions-<project>.md digest -> [(id, start, branch, commits, last test line)]"""
    heads = list(SESSION.finditer(txt))
    out = []
    for i, m in enumerate(heads):
        body = txt[m.end():heads[i + 1].start() if i + 1 < len(heads) else len(txt)]
        tests = re.findall(r'^\s*TEST: .*?-> (.*)$', body, re.M)
        out.append((m[1][:8], m[2].replace('T', ' '), m[3], int(m[4]), tests[-1] if tests else ''))
    return out


def open_items(path):
    """The '## Open items' section of an earlier note, or ''."""
    m = re.search(r'^## Open items\s*\n(.*?)(?=^## |\Z)', open(path).read(), re.M | re.S)
    return m[1].strip() if m else ''


def evidence_dir():
    if len(sys.argv) > 1:
        return os.path.abspath(sys.argv[1])
    state = json.load(open(os.path.join(ROOT, 'state.json')))
    if 'pending_until' not in state:
        sys.exit('nothing collected: run python3 scripts/collect.py first')
    for f in glob.glob(os.path.join(ROOT, 'evidence', '*', 'summary.json')):
        if json.load(open(f)).get('until') == state['pending_until']:
            return os.path.dirname(f)
    sys.exit(f"no evidence folder ends at {state['pending_until']}")


def main():
    ev = evidence_dir()
    name = os.path.basename(ev)
    since, until = name.split('_to_')
    summary = json.load(open(os.path.join(ev, 'summary.json')))
    git = parse_git(open(os.path.join(ev, 'git.txt')).read()) if os.path.exists(os.path.join(ev, 'git.txt')) else {}
    sessions = {os.path.basename(f)[9:-3]: parse_sessions(open(f).read()) for f in sorted(glob.glob(os.path.join(ev, 'sessions-*.md')))}
    note = os.path.join(ROOT, 'weekly', f'{name}.md')
    if os.path.exists(note) and not open(note).read().startswith(MARK):
        sys.exit(f'weekly/{name}.md is already written up; not overwriting it')

    n_commits, n_sessions = sum(map(len, git.values())), sum(map(len, sessions.values()))
    if not n_commits and not n_sessions:
        open(note, 'w').write(f'# {since} to {until}\n\nNo recorded work.\n')
        return print(f'weekly/{name}.md: no recorded work')

    subjects = ' '.join(c[2] for cs in git.values() for c in cs)
    branches = ' '.join(s[2] for ss in sessions.values() for s in ss)
    digests = ' '.join(open(f).read() for f in glob.glob(os.path.join(ev, 'sessions-*.md')))
    prs = sorted({int(a or b) for a, b in PR.findall(subjects + ' ' + digests)})
    tickets = sorted(set(TICKET.findall(subjects + ' ' + branches)))
    L = [MARK, f'# {since} to {until} (draft)', '', '## At a glance', '',
         '| Repo | Commits | + lines | - lines |', '|---|---:|---:|---:|']
    for r, cs in sorted(git.items()):
        L.append(f'| `{r}` | {len(cs)} | {sum(c[3] for c in cs)} | {sum(c[4] for c in cs)} |')
    L += [f'| **Total** | **{n_commits}** | **{sum(c[3] for cs in git.values() for c in cs)}** | **{sum(c[4] for cs in git.values() for c in cs)}** |', '',
          f'- Claude Code sessions: {n_sessions} across {len(sessions)} project(s)',
          f"- PRs referenced: {', '.join(f'#{p}' for p in prs) or 'none found'}",
          f"- Ticket keys (candidates): {', '.join(tickets) or 'none found'}", '']
    if sessions:
        L += ['## Sessions', '', '| Project | Session | Start | Branch | Commits | Last test run |', '|---|---|---|---|---:|---|']
        L += [f'| {p} | `{s[0]}` | {s[1]} | `{s[2]}` | {s[3]} | {s[4]} |' for p, ss in sessions.items() for s in ss] + ['']
    for r, cs in sorted(git.items()):
        L += [f'## Commits: {r}', ''] + [f'- {c[1]} `{c[0][:7]}` {c[2]} (+{c[3]}/-{c[4]})' for c in sorted(cs, key=lambda c: c[1])] + ['']
    prev = [f for f in sorted(glob.glob(os.path.join(ROOT, 'weekly', '*_to_*.md'))) if os.path.basename(f) < f'{name}.md']
    carried = open_items(prev[-1]) if prev else ''
    L += ['## Open items', '', f'Carried over from {os.path.basename(prev[-1])[:-3]}, status not checked yet:', '', carried, ''] if carried else []
    if summary.get('big_sessions') and not summary.get('self_summaries'):
        L += [f"Big sessions without a self-summary yet: {len(summary['big_sessions'])} "
              f'(`python3 scripts/collect.py --summarise evidence/{name}`).', '']
    open(note, 'w').write('\n'.join(L))

    # Share pages: a draft week, counted by area through data.json "repos" (repo -> area key, kept up by /weekly-update).
    p = os.path.join(ROOT, 'share', 'data.json')
    data = json.load(open(p))
    old = next((w for w in data.get('weeks', []) if w.get('start') == since), None)
    if old and not old.get('draft'):
        print(f'share: week {since} already written up; left alone')
    else:
        by_area, unmapped = collections.Counter(), {}
        for r, cs in git.items():
            a = (data.get('repos') or {}).get(r)
            if a in data.get('areas', {}):
                by_area[a] += len(cs)
            else:
                unmapped[r] = len(cs)
        week = {'start': since, 'end': until, 'draft': True, 'commits': dict(by_area),
                'headline': f'{n_commits} code changes in {len(git)} repos, not written up yet', 'items': []}
        if unmapped:
            week['unmapped'] = unmapped
        data['weeks'] = [w for w in data.get('weeks', []) if w.get('start') != since] + [week]
        data['updated'] = str(dt.date.today())
        with open(p, 'w') as w:
            json.dump(data, w, ensure_ascii=False, indent=1)
            w.write('\n')
    print(f'weekly/{name}.md: draft, {n_commits} commits, {n_sessions} sessions')
    subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build-share.py')], check=True)


def selftest():
    g = parse_git('## acme/api (git@x:acme/api.git)\nabc1234567 2026-01-05 Fix login (#12)\n'
                  ' 3 files changed, 10 insertions(+), 2 deletions(-)\ndef1234567 2026-01-06 Merge\n'
                  '## acme/web (x)\n0123456789 2026-01-07 ACME-9 deletes only\n 1 file changed, 4 deletions(-)\n')
    assert g == {'acme/api': [['abc1234567', '2026-01-05', 'Fix login (#12)', 10, 2], ['def1234567', '2026-01-06', 'Merge', 0, 0]],
                 'acme/web': [['0123456789', '2026-01-07', 'ACME-9 deletes only', 0, 4]]}, g
    s = parse_sessions('\n\n### SESSION 1234567890ab start=2026-01-05T09:00 cwd=/x branch=main commits=2 tools={}\n'
                       '  TEST: npm test -> 4 tests\n  TEST: npm test -> 5 tests\n### SESSION ffffffffffff start=2026-01-06T10:00 cwd=/x branch=f commits=0 tools={}\n')
    assert s == [('12345678', '2026-01-05 09:00', 'main', 2, '5 tests'), ('ffffffff', '2026-01-06 10:00', 'f', 0, '')], s
    assert PR.findall('Fix (#12) see https://github.com/a/b/pull/34') == [('12', ''), ('', '34')]
    print('selftest ok')


if __name__ == '__main__':
    selftest() if '--selftest' in sys.argv else main()
