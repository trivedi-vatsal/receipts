// Renders every share page from window.RECEIPTS (share/data.js). <body data-page> picks the view.
(() => {
  const D = window.RECEIPTS, page = document.body.dataset.page, app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const rich = s => esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>');  // data fields may use <b>, nothing else

  const PAGES = [['index', 'Summary'], ['timeline', 'Timeline'], ['areas', 'Areas']];
  document.getElementById('nav').innerHTML = `<div class="wrap"><a class="brand" href="index.html">${esc(D?.title || 'Receipts')}</a>
    <div class="links">${PAGES.map(([p, l]) => `<a href="${p}.html"${p === page || (page === 'week' && p === 'timeline') ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</div></div>`;
  if (!D) { app.innerHTML = '<p class="empty">No data yet. Run <code>python3 scripts/build-share.py</code>.</p>'; return; }

  const AREAS = Object.keys(D.areas || {}), NOTES = D.notes || {};
  const W = (D.weeks || []).slice().sort((a, b) => a.start.localeCompare(b.start));
  const color = a => `var(--a-${Math.max(0, AREAS.indexOf(a)) % 6})`;
  const dot = a => `<span class="dot" style="background:${color(a)}"></span>`;
  const label = a => esc(D.areas[a] || a);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (s, add = 0) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + add); return d; };
  const md2 = d => `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const fmtDay = d => `${md2(d)}, ${d.getUTCFullYear()}`;
  const lastDay = w => w.end ? day(w.end, -1) : day(w.start, 6);
  const range = w => { const a = day(w.start), b = lastDay(w);
    if (+a >= +b) return md2(a);
    return a.getUTCMonth() === b.getUTCMonth() ? `${md2(a)}–${b.getUTCDate()}` : `${md2(a)} – ${md2(b)}`; };
  // unmapped: draft-week commits in repos not yet assigned an area; they count toward totals only
  const count = (w, keys = AREAS) => keys.reduce((s, a) => s + (w.commits?.[a] || 0), keys === AREAS ? Object.values(w.unmapped || {}).reduce((x, y) => x + y, 0) : 0);
  const weekHref = w => `week.html#${w.start}`;
  const areaHref = a => `areas.html#${encodeURIComponent(a)}`;
  const draft = w => w.draft ? ' <span class="pill decide">Draft</span>' : '';
  const plural = (n, s) => `${n.toLocaleString('en-US')} ${s}${n === 1 ? '' : 's'}`;

  const sec = (title, sub, body, extra = '') => `<section><div class="sec-head${extra ? ' row' : ''}"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${extra}</div>${body}</section>`;
  const hero = (eyebrow, title, lede) => `<header class="hero">${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
  const stats = list => `<div class="stats">${list.map(([n, t]) => `<div class="stat card"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}</div>`;
  const footer = () => `<footer>${D.footer ? `<p>${esc(D.footer)}</p>` : ''}${D.updated ? `<p>Last updated ${fmtDay(day(D.updated))}.</p>` : ''}</footer>`;

  function itemList(items) {
    return `<ul class="items">${items.map(([a, t]) => `<li><a class="tag" href="${areaHref(a)}">${dot(a)}${label(a)}</a><span>${esc(t)}</span></li>`).join('')}</ul>`;
  }
  function weekRow(w, only) {
    const items = w.items.filter(([a]) => !only || a === only);
    return `<li class="week"><div class="when"><b>${range(w)}</b><span>${day(w.start).getUTCFullYear()} · ${plural(count(w), 'change')}</span></div>
      <div style="min-width:0"><h3><a href="${weekHref(w)}">${esc(w.headline)}</a>${draft(w)}</h3>${itemList(items)}
      ${w.note && !only ? `<p class="note">${rich(w.note)}</p>` : ''}<a class="more" href="${weekHref(w)}">Read the full week →</a></div></li>`;
  }
  const touches = (w, a) => w.commits?.[a] > 0 || w.items.some(([k]) => k === a);
  function areaStats(a) {
    const active = W.filter(w => touches(w, a));
    return {active, changes: W.reduce((s, w) => s + (w.commits?.[a] || 0), 0)};
  }
  function areaCards() {
    return `<div class="areas">${AREAS.map(a => {
      const {active, changes} = areaStats(a), latest = active.length && active[active.length - 1].items.find(([k]) => k === a);
      return `<a class="area card" href="${areaHref(a)}"><h3>${dot(a)}${label(a)}</h3>
        <span class="meta">${plural(changes, 'change')} · ${plural(active.length, 'week')}</span>${latest ? `<p>${esc(latest[1])}</p>` : ''}</a>`;
    }).join('')}</div>`;
  }

  // Stacked bars per week; each bar links to its week page. Drawn after layout so it fits the box.
  function drawCharts() {
    document.querySelectorAll('.chart').forEach(box => {
      const keys = box.dataset.area ? [box.dataset.area] : AREAS;
      const H = 200, padL = 34, padB = 26, padT = 8, n = W.length, Wd = Math.max(300, box.clientWidth);
      const slot = (Wd - padL - 4) / n, bw = Math.max(6, Math.min(30, slot * 0.62));
      const max = Math.max(1, ...W.map(w => count(w, keys)));
      const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => max / s <= 5) || 1000, top = Math.ceil(max / step) * step;
      const y = v => padT + (H - padT - padB) * (1 - v / top);
      let s = `<svg width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Code changes per week">`;
      for (let v = 0; v <= top; v += step) s += `<line class="grid-line" x1="${padL}" x2="${Wd - 4}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
      const every = Math.ceil(40 / slot);
      W.forEach((w, i) => {
        const x = padL + slot * i + (slot - bw) / 2, tip = [`${range(w)}: ${plural(count(w, keys), 'change')}`,
          ...keys.filter(a => w.commits?.[a]).map(a => `${D.areas[a]}: ${w.commits[a]}`)].join('\n');
        s += `<a href="${weekHref(w)}" aria-label="${esc(tip)}"><title>${esc(tip)}</title><rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${H - padT - padB}"/>`;
        let acc = 0;
        keys.forEach(a => {
          const v = w.commits?.[a] || 0; if (!v) return;
          const y1 = y(acc + v), h = y(acc) - y1; acc += v;
          s += `<rect class="seg" x="${x}" y="${y1}" width="${bw}" height="${Math.max(1, h - (h > 3 ? 2 : 0))}" rx="2" fill="${color(a)}"/>`;
        });
        s += '</a>';
        if (i % every === 0 || i === n - 1) s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${md2(day(w.start))}</text>`;
      });
      box.innerHTML = s + '</svg>';
    });
  }
  const chartCard = (only, legend) => `<div class="chart-card card">${legend ? `<div class="legend">${AREAS.map(a =>
    `<a class="chip" href="${areaHref(a)}">${dot(a)}${label(a)}</a>`).join('')}</div>` : ''}
    <div class="chart"${only ? ` data-area="${esc(only)}"` : ''}></div>
    <details class="tbl"><summary>Show as a table</summary><div class="tbl-wrap"><table><thead><tr><th>Week</th>${(only ? [only] : AREAS).map(a => `<th>${label(a)}</th>`).join('')}${only ? '' : '<th>Total</th>'}</tr></thead><tbody>
    ${W.map(w => `<tr><td><a href="${weekHref(w)}">${range(w)}</a></td>${(only ? [only] : AREAS).map(a => `<td>${w.commits?.[a] || ''}</td>`).join('')}${only ? '' : `<td><b>${count(w)}</b></td>`}</tr>`).join('')}</tbody></table></div></details></div>`;

  // Minimal Markdown for the weekly notes: headings, tables, bullets, paragraphs, `code`, **bold**, http links.
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^https?:/.test(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t);
  function md(src) {
    const L = src.split('\n'), out = []; let i = 0;
    const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
    while (i < L.length) {
      const l = L[i];
      if (/^# |^<!--/.test(l) || !l.trim()) { i++; continue; }  // the page already shows the week title
      if (/^#{2,} /.test(l)) { out.push(`<h4>${inline(l.replace(/^#+ /, ''))}</h4>`); i++; continue; }
      if (l.startsWith('|')) {
        const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
        const body = rows.filter(r => !/^\|[\s:|-]+$/.test(r.trim()));
        out.push(`<div class="tw"><table>${body.map((r, k) => `<tr>${cells(r).map(c => k ? `<td>${c}</td>` : `<th>${c}</th>`).join('')}</tr>`).join('')}</table></div>`);
        continue;
      }
      if (/^\s*[-*] /.test(l)) {
        const items = []; while (i < L.length && /^\s*[-*] /.test(L[i])) items.push(L[i++].replace(/^\s*[-*] /, ''));
        out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`); continue;
      }
      const p = []; while (i < L.length && L[i].trim() && !/^(#|\||\s*[-*] )/.test(L[i])) p.push(L[i++]);
      out.push(`<p>${inline(p.join(' '))}</p>`);
    }
    return out.join('');
  }

  const noWeeks = '<p class="empty">No weeks yet. Run <code>/weekly-update</code> in Claude Code.</p>';
  const views = {
    index() {
      document.title = D.title || 'Receipts';
      if (!W.length) return hero(esc(D.eyebrow), esc(D.title || 'Receipts'), esc(D.lede)) + noWeeks;
      const total = W.reduce((s, w) => s + count(w), 0), first = day(W[0].start), last = lastDay(W[W.length - 1]);
      return hero(esc(D.eyebrow), esc(D.title), esc(D.lede)) +
        stats([[W.length, `weeks recorded, ${md2(first)} to ${fmtDay(last)}`], [total.toLocaleString('en-US'), 'code changes saved'], ...(D.stats || [])]) +
        (D.attention?.length ? sec('Needs attention', `Open at the end of ${range(W[W.length - 1])}, needing a decision or a hand from someone else.`,
          `<ul class="attn card">${D.attention.map(([k, t, p]) => `<li><span class="pill ${k === 'decide' ? 'decide' : 'fix'}">${k === 'decide' ? 'Decision' : 'Action'}</span><div><strong>${esc(t)}</strong><p>${esc(p)}</p></div></li>`).join('')}</ul>`) : '') +
        (D.results?.length ? sec('Results you can point to', 'Measured before and after, taken from the work itself.',
          `<ul class="results">${D.results.map(([n, t]) => `<li><span class="big">${esc(n)}</span><span>${rich(t)}</span></li>`).join('')}</ul>`) : '') +
        sec('Where the effort went', 'Code changes per week, by area. Select a bar to open that week.', chartCard(null, true)) +
        sec('Areas of work', '', areaCards()) +
        sec('Latest weeks', '', `<ol class="weeks">${W.slice(-3).reverse().map(w => weekRow(w)).join('')}</ol>`,
          W.length > 3 ? `<a href="timeline.html">All ${W.length} weeks →</a>` : '') +
        (D.terms?.length ? sec('Terms used here', '', `<dl class="terms">${D.terms.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`) : '') +
        footer();
    },
    timeline() {
      const only = AREAS.includes(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : null;
      document.title = `Timeline · ${D.title || 'Receipts'}`;
      const list = W.slice().reverse().filter(w => !only || touches(w, only));
      return hero('Timeline', only ? `${label(only)}, week by week` : 'Week by week', 'Latest first. Pick an area to narrow the list.') +
        `<div class="legend"><a class="chip" href="#" aria-current="${!only}">All areas</a>${AREAS.map(a =>
          `<a class="chip" href="#${encodeURIComponent(a)}" aria-current="${only === a}">${dot(a)}${label(a)}</a>`).join('')}</div>` +
        (list.length ? `<ol class="weeks">${list.map(w => weekRow(w, only)).join('')}</ol>` : W.length ? '<p class="empty">No weeks with this area yet.</p>' : noWeeks) + footer();
    },
    week() {
      const i = W.findIndex(w => w.start === location.hash.slice(1));
      if (i < 0) { if (W.length) { location.replace('#' + W[W.length - 1].start); return ''; } return noWeeks; }
      const w = W[i], prev = W[i - 1], next = W[i + 1], n = count(w), used = AREAS.filter(a => w.commits?.[a]);
      document.title = `${range(w)} · ${D.title || 'Receipts'}`;
      return `<a class="back" href="timeline.html">← All weeks</a>` +
        hero(`${range(w)}, ${day(w.start).getUTCFullYear()} · ${plural(n, 'change')}`, esc(w.headline) + draft(w), w.draft ? 'Facts only so far. The plain-language write-up comes with the next update.' : '') +
        (n ? `<section><div class="split" role="img" aria-label="${esc(used.map(a => `${D.areas[a]}: ${w.commits[a]}`).join(', '))}">${used.map(a =>
          `<span style="flex:${w.commits[a]};background:${color(a)}"></span>`).join('')}</div>
          <div class="split-legend">${used.map(a => `<span>${dot(a)}${label(a)} <b class="num">${w.commits[a]}</b></span>`).join('')}</div></section>` : '') +
        (w.items.length || w.note ? sec('Highlights', '', itemList(w.items) + (w.note ? `<p class="note">${rich(w.note)}</p>` : '')) : '') +
        (NOTES[w.start] ? sec('Full notes', 'The engineering write-up for this week.', `<div class="md card">${md(NOTES[w.start])}</div>`) : '') +
        `<nav class="pager">${prev ? `<a href="${weekHref(prev)}">← ${range(prev)}</a>` : '<span></span>'}${next ? `<a href="${weekHref(next)}">${range(next)} →</a>` : '<span></span>'}</nav>`;
    },
    areas() {
      const a = decodeURIComponent(location.hash.slice(1));
      if (!AREAS.includes(a)) {
        document.title = `Areas · ${D.title || 'Receipts'}`;
        return hero('Areas', 'Areas of work', 'Each area collects every highlight from every week.') + (AREAS.length ? areaCards() : noWeeks) + footer();
      }
      const {active, changes} = areaStats(a);
      document.title = `${D.areas[a]} · ${D.title || 'Receipts'}`;
      return `<a class="back" href="areas.html">← All areas</a>` + hero(`${dot(a)} Area`, label(a), '') +
        stats([[changes.toLocaleString('en-US'), 'code changes'], [active.length, 'weeks with work here'],
          ...(active.length ? [[md2(day(active[0].start)), `first seen, ${day(active[0].start).getUTCFullYear()}`]] : [])]) +
        (W.length ? sec('Changes per week', 'Select a bar to open that week.', chartCard(a, false)) : '') +
        sec('Highlights', 'Latest first.', active.length ? `<ol class="weeks">${active.slice().reverse().map(w => weekRow(w, a)).join('')}</ol>` : '<p class="empty">Nothing recorded yet.</p>',
          `<a href="timeline.html#${encodeURIComponent(a)}">On the timeline →</a>`);
    },
  };

  function render() { app.innerHTML = views[page](); drawCharts(); scrollTo(0, 0); }
  render();
  addEventListener('hashchange', render);
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawCharts, 120); });
})();
