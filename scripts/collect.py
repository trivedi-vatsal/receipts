#!/usr/bin/env python3
"""Collect work evidence since the last weekly run into evidence/<since>_to_<until>/.

  python3 scripts/collect.py              # collect; prints the evidence folder
  python3 scripts/collect.py --mark-done  # after the write-up: advance state.json to that folder's end
  python3 scripts/collect.py --window 2026-01-05 2026-01-12 [--no-summaries]  # fixed window, state untouched
  python3 scripts/collect.py --summarise evidence/<window>  # self-summaries for a folder collected with --no-summaries
  python3 scripts/collect.py --selftest   # check the redaction and test-count parsing

Evidence = Claude Code session digests (~/.claude/projects), your git commits in matching repos,
and CLI prompt history. What counts as "work" is set in config.json (`match`, `code_dir`, `authors`). Big sessions (digest over 150 KB or 10+ commits) also get a self-summary:
a read-only forked resume of the session, saved to session-summaries/. Transcripts are purged after
cleanupPeriodDays (default 30), so a missed week can lose detail.
"""
import argparse, collections, datetime as dt, glob, json, os, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, 'config.json')))
CODE = os.path.expanduser(CFG.get('code_dir', '~/code')).rstrip('/')
STATE = os.path.join(ROOT, 'state.json')
MATCH = re.compile(CFG.get('match') or '(?!)', re.I)  # project dirs, repo paths, remotes
PREFIX = re.sub(r'[^A-Za-z0-9]', '-', CODE) + '-'  # how Claude Code names ~/.claude/projects/<dir>
AUTHORS = [f'--author={a}' for a in CFG.get('authors') or [
    subprocess.run(['git', 'config', 'user.email'], capture_output=True, text=True).stdout.strip()] if a]
SKIP = ('<command-', '<local-command', '<system-reminder', 'Caveat:', '[Request interrupted',
        '<task-notification', 'This session is being continued')
SUMMARY_PROMPT = "Summarise this session: goal, decisions and why, what shipped, numbers measured, what's still open"
EDITS = {'Edit', 'Write', 'MultiEdit', 'NotebookEdit'}
PLAN_DOC = re.compile(r'(AUDIT|PLAN|TASKS)[^/]*\.md$|/plans?/', re.I)
GIT_COMMIT = re.compile(r'\bgit\b[^|;&\n]*\bcommit\b')
NODE_TEST = re.compile(r'^(?:#|ℹ) (tests|pass|fail) (\d+)\s*$', re.M)  # node:test summary lines
TEST_LINE = re.compile(r'^\W*(?:Tests:?\s+)?\d+ (?:passed|failed)\b.*$', re.M)  # pytest/vitest/jest/playwright
SECRETS = [  # (pattern, replacement), applied to everything written to evidence/
    (re.compile(r'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|mssql)://\S+', re.I), '[REDACTED-CONN]'),
    (re.compile(r'\b[a-z][\w+.-]*://[^\s/:@]+:[^\s/@]+@\S+', re.I), '[REDACTED-CONN]'),
    (re.compile(r'\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b'), '[PRIVATE-IP]'),
    (re.compile(r'\b(?:sk-[\w-]{16,}|gh[pousr]_\w{20,}|github_pat_\w{20,}|xox[abprs]-[\w-]{10,}|AKIA[0-9A-Z]{16}'
                r'|AIza[\w-]{30,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})'), '[REDACTED-TOKEN]'),
    (re.compile(r'(?i)\b(bearer\s+)[\w.~+/-]{16,}=*'), r'\1[REDACTED]'),
    (re.compile(r'(?i)\b([\w-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)["\']?\s*[:=]\s*["\']?)[^\s"\',;]{6,}'),
     r'\1[REDACTED]'),
]


def redact(s):
    for pat, rep in SECRETS:
        s = pat.sub(rep, s)
    return s


def utc(t):
    """Local naive datetime -> UTC ISO string, the format Claude Code transcripts use."""
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')


def write_json(path, obj):
    """Atomic write: an interrupted run never leaves a half-written state.json."""
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, 'w') as w:
        json.dump(obj, w, indent=2)
    os.replace(tmp, path)


def check_config():
    errs = []
    if not CFG.get('name') or CFG['name'] == 'Your Name':
        errs.append('set "name"')
    if not CFG.get('match') or CFG['match'] == 'acme|another-work-repo':
        errs.append('set "match" to a regex for your work repos')
    if not os.path.isdir(CODE):
        errs.append(f'"code_dir" {CODE} is not a folder')
    if not AUTHORS:
        errs.append('set "authors" (or `git config --global user.email`)')
    if errs:
        sys.exit('config.json: ' + '; '.join(errs))


def test_counts(s):
    """Summary line of a test run found in a tool result, or None."""
    node = dict(NODE_TEST.findall(s))
    if 'tests' in node:
        return f"{node['tests']} tests, {node.get('pass', '?')} pass, {node.get('fail', '?')} fail"
    hits = [l.strip(' =') for l in TEST_LINE.findall(s) if len(l) < 200]
    return hits[-1] if hits else None


def text(c):
    if isinstance(c, str):
        return c
    return '\n'.join(b.get('text', '') for b in c or [] if isinstance(b, dict) and b.get('type') == 'text')


def digest_sessions(since, until, out):
    proj, big = collections.defaultdict(list), []
    lo, hi = utc(since), utc(until)
    for f in glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')):
        d = f.split('/')[-2].replace(PREFIX, '')
        if not MATCH.search(d) or os.path.getmtime(f) < since.timestamp():
            continue
        ev, start, cwd, branch, tools = [], None, None, None, collections.Counter()
        labels, edited, plans, commits, reply, fork = {}, set(), set(), 0, None, False
        for line in open(f, errors='ignore'):
            try:
                o = json.loads(line)
            except ValueError:
                continue
            m = o.get('message') or {}
            if o.get('type') == 'user' and text(m.get('content', '')).startswith(SUMMARY_PROMPT[:40]):
                fork = True  # a self-summary fork made by this script: not work
                break
            ts = o.get('timestamp', '')
            if not ts or not (lo <= ts < hi):
                continue
            if o.get('isSidechain') or o.get('isMeta'):
                continue
            start = start or ts
            cwd, branch = cwd or o.get('cwd'), o.get('gitBranch') or branch
            if o.get('type') == 'user':
                c = m.get('content', '')
                for b in c if isinstance(c, list) else []:
                    if isinstance(b, dict) and b.get('type') == 'tool_result':
                        r = test_counts(text(b.get('content')) if isinstance(b.get('content'), list) else str(b.get('content') or ''))
                        if r and not (ev and ev[-1].endswith('-> ' + r)):
                            ev.append(f"  TEST: {labels.get(b.get('tool_use_id'), '?')} -> {r}")
                s = re.sub(r'<ide_\w+>.*?</ide_\w+>', '', text(c), flags=re.S).strip()
                if s and not s.startswith(SKIP):
                    if reply:
                        ev.append(f'  A: {reply}')
                        reply = None
                    ev.append(f'[{ts[5:16]}] USER: {s[:1500]}')
            elif o.get('type') == 'assistant':
                for b in m.get('content') or []:
                    if b.get('type') != 'tool_use':
                        continue
                    name, inp = b['name'], b.get('input') or {}
                    tools[name] += 1
                    path, cmd = inp.get('file_path') or inp.get('notebook_path') or '', inp.get('command', '')
                    labels[b.get('id')] = cmd[:120].replace('\n', ' ') if cmd else f'{name} {path}'.strip()
                    if name in EDITS and path and not path.startswith(('/tmp/', '/private/tmp/')):  # skip scratch files
                        edited.add(path)
                    if path and PLAN_DOC.search(path):
                        plans.add(path)
                    commits += bool(GIT_COMMIT.search(cmd))
                    if re.search(r'git (commit|push|merge)|gh pr|deploy', cmd):
                        ev.append(f'  CMD: {cmd[:300]}')
                reply = text(m.get('content')).strip() or reply  # the last text before the next prompt, in full
        if reply:
            ev.append(f'  A: {reply}')
        if fork or not any(e.startswith('[') for e in ev):
            continue
        rel = lambda p: os.path.relpath(p, cwd) if cwd and p.startswith(cwd) else p.replace(os.path.expanduser('~'), '~')
        sid = os.path.basename(f)[:-6]
        body = '\n'.join(ev) + f'\n  FILES EDITED ({len(edited)}): ' + ', '.join(sorted(map(rel, edited)))
        if plans:
            body += '\n  PLAN DOCS: ' + ', '.join(sorted(map(rel, plans)))
        head = f'\n\n### SESSION {sid} start={start[:16]} cwd={cwd} branch={branch} commits={commits} tools={dict(tools.most_common(6))}\n'
        proj[d].append((start, head + body))
        if len(body) > 150_000 or commits >= 10:
            big.append((d, sid, cwd))
    sizes = {}
    for d, ss in proj.items():
        path = os.path.join(out, f'sessions-{d}.md')
        with open(path, 'w') as w:
            w.write(redact(''.join(block for _, block in sorted(ss))))
        sizes[os.path.basename(path)] = (len(ss), os.path.getsize(path))
    return sizes, big


def summarise(big, out):
    """Self-summary per big session: a read-only forked resume, run in the session's own folder."""
    d = os.path.join(out, 'session-summaries')
    os.makedirs(d, exist_ok=True)
    claude = shutil.which('claude') or '/opt/homebrew/bin/claude'
    env = {k: v for k, v in os.environ.items() if k != 'CLAUDECODE'}  # allow running inside a Claude Code session

    def one(item):
        proj, sid, cwd = item
        path = os.path.join(d, f'{proj}-{sid}.md')
        if os.path.exists(path):
            return path, 'exists'
        if not cwd or not os.path.isdir(cwd):
            return path, 'skipped: session folder missing'
        try:  # prompt on stdin: --disallowedTools takes a list and would swallow a positional prompt
            r = subprocess.run([claude, '-p', '--resume', sid, '--fork-session',
                                '--disallowedTools', 'Edit Write NotebookEdit Bash'],
                               input=SUMMARY_PROMPT, cwd=cwd, env=env, capture_output=True, text=True, timeout=1200)
        except subprocess.TimeoutExpired:
            return path, 'failed: timeout'
        except OSError as e:  # claude CLI not installed or not on PATH
            return path, f'failed: {e}'
        if r.returncode or not r.stdout.strip():
            return path, f'failed: exit {r.returncode} {r.stderr.strip()[:200]}'
        with open(path, 'w') as w:
            w.write(redact(f'# Self-summary: {proj} {sid}\n\nWritten {dt.date.today()} by a read-only forked resume in {cwd}. '
                           f'It covers the whole session, which may run outside this window.\n\n{r.stdout.strip()}\n'))
        return path, 'ok'

    with ThreadPoolExecutor(4) as ex:
        return {os.path.relpath(p, out): st for p, st in ex.map(one, big)}


def git_log(since, until, out):
    repos = []
    for g in glob.glob(f'{CODE}/**/.git', recursive=True):
        r = os.path.dirname(g)
        if 'node_modules' in r:
            continue
        remote = subprocess.run(['git', '-C', r, 'remote', 'get-url', 'origin'], capture_output=True, text=True).stdout
        if MATCH.search(r.replace(CODE, '')) or MATCH.search(remote):
            repos.append((r, remote.strip()))
    counts, seen = {}, set()  # seen: same commit in a second checkout counts once
    with open(os.path.join(out, 'git.txt'), 'w') as w:
        for r, remote in sorted(repos):
            log = subprocess.run(['git', '-C', r, 'log', '--all', '-i', *AUTHORS, f'--since={since.isoformat()}',
                                  f'--until={until.isoformat()}', '--date=short', '--pretty=%H %ad %s', '--shortstat'],
                                 capture_output=True, text=True).stdout
            keep, new = [], False
            for l in log.splitlines():
                if re.match(r'[0-9a-f]{40} \d{4}-', l):
                    new = l[:40] not in seen
                    seen.add(l[:40])
                    l = l[:10] + l[40:]
                if new and l.strip():
                    keep.append(l)
            if keep:
                counts[os.path.relpath(r, CODE)] = sum(1 for l in keep if re.match(r'[0-9a-f]{10} \d{4}-', l))
                w.write(redact(f'## {os.path.relpath(r, CODE)} ({remote})\n' + '\n'.join(keep) + '\n\n'))
    return counts


def prompts(since, until, out):
    n, hist = 0, os.path.expanduser('~/.claude/history.jsonl')
    with open(os.path.join(out, 'cli-prompts.txt'), 'w') as w:
        for l in open(hist) if os.path.exists(hist) else []:
            try:
                o = json.loads(l)
            except ValueError:
                continue
            t = dt.datetime.fromtimestamp(o.get('timestamp', 0) / 1000)
            p = o.get('project', '')
            if since <= t < until and MATCH.search(p):
                n += 1
                w.write(redact(f"{t:%Y-%m-%d %H:%M} [{p.replace(CODE + '/', '')}] {o.get('display', '')[:600]}\n"))
    return n


def selftest():
    assert redact('postgres://u:p@db.local:5432/x ok') == '[REDACTED-CONN] ok'
    assert redact('https://bob:hunter2@host/x') == '[REDACTED-CONN]'
    assert redact('ssh 192.168.1.20 and 10.0.0.5, not 8.8.8.8') == 'ssh [PRIVATE-IP] and [PRIVATE-IP], not 8.8.8.8'
    assert redact('DB_PASSWORD=s3cretvalue') == 'DB_PASSWORD=[REDACTED]'
    assert redact('Authorization: Bearer abcdefghijklmnopqrstuvwx') == 'Authorization: Bearer [REDACTED]'
    assert 'ghp_' not in redact('token ghp_' + 'a' * 30)
    assert redact('max_tokens: 4000') == 'max_tokens: 4000'
    assert test_counts('# tests 12\n# pass 11\n# fail 1\n') == '12 tests, 11 pass, 1 fail'
    assert test_counts('==== 2 failed, 40 passed in 3.1s ====') == '2 failed, 40 passed in 3.1s'
    assert test_counts(' Tests  40 passed (40)') == 'Tests  40 passed (40)'
    assert test_counts('nothing here') is None
    assert len(utc(dt.datetime(2026, 1, 5))) == 19
    print('selftest ok')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--selftest', action='store_true', help='check redaction and test-count parsing')
    ap.add_argument('--mark-done', action='store_true', help="advance state.json after the write-up")
    ap.add_argument('--window', nargs=2, metavar=('SINCE', 'UNTIL'), type=dt.datetime.fromisoformat,
                    help='fixed window (YYYY-MM-DD YYYY-MM-DD); state.json untouched')
    ap.add_argument('--no-summaries', action='store_true', help='skip self-summaries of big sessions (no Claude usage)')
    ap.add_argument('--summarise', metavar='EVIDENCE_DIR', help='write the skipped self-summaries for an evidence folder')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if a.summarise:
        p = os.path.join(os.path.abspath(a.summarise), 'summary.json')
        s = json.load(open(p))
        s['self_summaries'] = summarise([tuple(b) for b in s.get('big_sessions', [])], os.path.dirname(p))
        write_json(p, s)
        return print(json.dumps(s['self_summaries'], indent=2))
    state = json.load(open(STATE)) if os.path.exists(STATE) and os.path.getsize(STATE) else {}
    if a.mark_done:
        if 'pending_until' not in state:
            sys.exit('nothing to mark done: run collect.py first')
        state['last_run'] = state.pop('pending_until')
        state.setdefault('runs', []).append(state['last_run'])
        write_json(STATE, state)
        print('state advanced to', state['last_run'])
        return
    check_config()
    until = dt.datetime.now().replace(microsecond=0)
    # First run: go back 30 days, about as far as Claude Code keeps transcripts by default.
    since = dt.datetime.fromisoformat(state['last_run']) if 'last_run' in state else until - dt.timedelta(days=30)
    if a.window:
        since, until = a.window
        if since >= until:
            sys.exit('--window: SINCE must be before UNTIL')
    out = os.path.join(ROOT, 'evidence', f'{since:%Y-%m-%d}_to_{until:%Y-%m-%d}')
    os.makedirs(out, exist_ok=True)
    sessions, big = digest_sessions(since, until, out)
    summary = {'since': since.isoformat(), 'until': until.isoformat(), 'sessions': sessions,
               'commits': git_log(since, until, out), 'cli_prompts': prompts(since, until, out),
               'big_sessions': big, 'self_summaries': {} if a.no_summaries else summarise(big, out)}
    write_json(os.path.join(out, 'summary.json'), summary)
    if not a.window:
        state['pending_until'] = until.isoformat()
        write_json(STATE, state)
    print(out)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
