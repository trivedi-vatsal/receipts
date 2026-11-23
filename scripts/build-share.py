#!/usr/bin/env python3
"""Validate share/data.json and build share/data.js (data + every weekly note) for the share pages.
Run after editing data.json or writing a weekly note:  python3 scripts/build-share.py"""
import datetime as dt, glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARE = os.path.join(ROOT, 'share')


def check(d):
    errs = []
    areas = d.get('areas')
    if not isinstance(areas, dict):
        return ['"areas" must be an object {"key": "Label"}']
    if len(areas) > 6:
        errs.append('"areas": 6 at most (the chart has 6 colours)')

    def date(v, where):
        try:
            return dt.date.fromisoformat(v)
        except (TypeError, ValueError):
            errs.append(f'{where}: {v!r} is not YYYY-MM-DD')

    if d.get('updated'):
        date(d['updated'], 'updated')
    for i, w in enumerate(d.get('weeks', [])):
        at = f'weeks[{i}]'
        a, b = date(w.get('start'), at + '.start'), w.get('end') and date(w['end'], at + '.end')
        if a and b and b <= a:
            errs.append(f'{at}: end is not after start')
        for k, n in (w.get('commits') or {}).items():
            if k not in areas:
                errs.append(f'{at}.commits: unknown area {k!r}')
            if not isinstance(n, int) or n < 0:
                errs.append(f'{at}.commits.{k}: {n!r} is not a count')
        for it in w.get('items', []):
            if not (isinstance(it, list) and len(it) == 2 and it[0] in areas):
                errs.append(f'{at}.items: {it!r} must be [<area key>, "text"]')
        if not w.get('draft') and not w.get('items'):
            errs.append(f'{at}: written-up week has no items')
        if not w.get('headline'):
            errs.append(f'{at}: missing headline')
    for it in d.get('attention', []):
        if not (isinstance(it, list) and len(it) == 3 and it[0] in ('decide', 'fix')):
            errs.append(f'attention: {it!r} must be ["decide" or "fix", "title", "text"]')
    for key in ('results', 'stats', 'terms'):
        for it in d.get(key, []):
            if not (isinstance(it, list) and len(it) == 2):
                errs.append(f'{key}: {it!r} must be a pair')
    for r, k in (d.get('repos') or {}).items():
        if k not in areas:
            errs.append(f'repos.{r}: unknown area {k!r}')
    starts = [w.get('start') for w in d.get('weeks', [])]
    errs += [f'weeks: {s} appears twice' for s in sorted(set(starts)) if starts.count(s) > 1]
    return errs


def main():
    d = json.load(open(os.path.join(SHARE, 'data.json')))
    errs = check(d)
    if errs:
        sys.exit('share/data.json:\n  ' + '\n  '.join(errs))
    files = {os.path.basename(f)[:-3]: f for f in sorted(glob.glob(os.path.join(ROOT, 'weekly', '*_to_*.md')))}
    notes = {}
    for w in d.get('weeks', []):  # the note named <start>_to_<end>, else the one starting on <start>
        f = files.get(f"{w['start']}_to_{w.get('end')}") or next((p for k, p in files.items() if k.startswith(w['start'])), None)
        if f:
            notes[w['start']] = open(f).read()
    d['notes'] = notes
    with open(os.path.join(SHARE, 'data.js'), 'w') as w:
        w.write('// Built by scripts/build-share.py from share/data.json and weekly/*.md. Do not edit.\n')
        w.write('window.RECEIPTS = ' + json.dumps(d, ensure_ascii=False, indent=1) + ';\n')
    print(f"share/data.js: {len(d.get('weeks', []))} weeks, {len(notes)} notes")


if __name__ == '__main__':
    main()
