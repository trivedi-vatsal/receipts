// Built by scripts/build-share.py from share/data.json and weekly/*.md. Do not edit.
window.RECEIPTS = {
 "title": "Alex Moreno at Acme",
 "eyebrow": "Demo · made-up data",
 "lede": "What Alex shipped this autumn, week by week. Every item here comes from a dated code change, pull request or measurement.",
 "footer": "This is a demo of receipts with fictional data. Alex Moreno and Acme are made up.",
 "updated": "2026-11-23",
 "areas": {
  "payments": "Payments",
  "search": "Search",
  "platform": "Reliability",
  "tooling": "Developer tooling"
 },
 "repos": {
  "acme/payments": "payments",
  "acme/search-service": "search",
  "acme/infra": "platform",
  "acme/ci-tools": "tooling"
 },
 "stats": [
  [
   "3",
   "measured improvements shipped"
  ],
  [
   "22 min",
   "to resolve the one incident"
  ]
 ],
 "results": [
  [
   "38 s → 6 s",
   "<b>Search results on busy days (slowest 5% of loads).</b> A missing database index, found and added in early November."
  ],
  [
   "2.1% → 0.4%",
   "<b>Card payments that fail at checkout.</b> Temporary bank declines are now retried automatically. Measured over two weeks."
  ],
  [
   "14 → 5 min",
   "<b>Wait for automated checks on each code change.</b> Median over 120 changes."
  ]
 ],
 "attention": [
  [
   "decide",
   "Retire the old search endpoint?",
   "Two internal tools still call it. Retiring it removes about 900 lines of code and one on-call alert; the owners of both tools need to agree on a date."
  ],
  [
   "decide",
   "Faster checks cost about 8% more",
   "Running tests on 4 machines instead of 1 saves 9 minutes per change. Keep it, or drop to 3 machines for a smaller saving?"
  ],
  [
   "fix",
   "Six unreliable tests need owners",
   "They were set aside so they stop blocking work. Each needs a team to fix or delete it."
  ]
 ],
 "terms": [
  [
   "Code change",
   "One saved step of work in the code (a commit)."
  ],
  [
   "Slowest 5%",
   "The page loads that take longer than 95 out of 100 others. It shows what customers feel on a bad day."
  ],
  [
   "Automated checks",
   "Tests that run on every code change before it can be merged."
  ],
  [
   "Draft week",
   "Counted automatically from the code history; the plain-language write-up comes with the next update."
  ]
 ],
 "weeks": [
  {
   "start": "2026-10-12",
   "end": "2026-10-19",
   "commits": {
    "payments": 9,
    "search": 3,
    "platform": 2
   },
   "headline": "Failed card payments get a second chance",
   "items": [
    [
     "payments",
     "Built automatic retries for card payments the bank declines for temporary reasons, switched off until tested."
    ],
    [
     "payments",
     "Made sure a retried payment can never charge a customer twice."
    ],
    [
     "search",
     "Started tracking slow searches after support reported complaints."
    ],
    [
     "platform",
     "Stopped the payments service restarting under heavy load."
    ]
   ]
  },
  {
   "start": "2026-10-19",
   "end": "2026-10-26",
   "commits": {
    "payments": 12,
    "platform": 4,
    "tooling": 2
   },
   "headline": "Payment retries live for half of customers",
   "items": [
    [
     "payments",
     "Turned retries on for 10% of customers, then 50%. Failed payments in that group dropped from 2.1% to 1.2% in the first three days."
    ],
    [
     "payments",
     "Customers now get a payment-failed email only after the last attempt, not the first."
    ],
    [
     "platform",
     "Added an alert if retries start piling up."
    ],
    [
     "tooling",
     "Wrote a report of the slowest automated checks, to pick what to speed up next."
    ]
   ]
  },
  {
   "start": "2026-10-26",
   "end": "2026-11-02",
   "commits": {
    "search": 8,
    "payments": 3,
    "platform": 5
   },
   "headline": "Found why search got slow, and fixed it in testing",
   "items": [
    [
     "search",
     "Traced slow searches to a missing database index after an October change. The fix cut the slowest loads from 38 to 9 seconds in testing."
    ],
    [
     "payments",
     "Payment retries now on for all customers, after finance approved the fees."
    ],
    [
     "platform",
     "Settings that would take a service down are now rejected before they go out."
    ],
    [
     "platform",
     "Search updates now go to a small share of traffic first."
    ]
   ],
   "note": "<b>Incident, Oct 28.</b> Search was down for 22 minutes after a settings change. Alex rolled it back, wrote the review, and added the check that now blocks that kind of change."
  },
  {
   "start": "2026-11-02",
   "end": "2026-11-09",
   "commits": {
    "search": 11,
    "payments": 2,
    "tooling": 4
   },
   "headline": "Search is six times faster for customers",
   "items": [
    [
     "search",
     "The search fix went live. On busy days the slowest loads went from 38 seconds to 6."
    ],
    [
     "search",
     "Tested double the normal traffic; search stayed under 7 seconds."
    ],
    [
     "payments",
     "Final numbers: failed card payments fell from 2.1% to 0.4% over two weeks."
    ],
    [
     "tooling",
     "Tried caching for the automated checks: 14 minutes down to 9 on a test branch."
    ]
   ]
  },
  {
   "start": "2026-11-09",
   "end": "2026-11-16",
   "commits": {
    "tooling": 9,
    "platform": 6,
    "payments": 2
   },
   "headline": "Automated checks now take 5 minutes, down from 14",
   "items": [
    [
     "tooling",
     "Spread the automated checks across 4 machines and cached the slow setup step. The median wait per change fell from 14 to 5 minutes."
    ],
    [
     "tooling",
     "Set aside six unreliable tests so they no longer block everyone's work."
    ],
    [
     "platform",
     "The machines that run the checks now scale with demand, with an alert on cost."
    ],
    [
     "payments",
     "Fixed payment-failed emails going out in the wrong language."
    ]
   ]
  },
  {
   "start": "2026-11-16",
   "end": "2026-11-23",
   "draft": true,
   "commits": {
    "payments": 5,
    "search": 3,
    "platform": 2
   },
   "headline": "10 code changes in 3 repos, not written up yet",
   "items": []
  }
 ],
 "notes": {
  "2026-10-12": "# 2026-10-12 to 2026-10-19\n\n## At a glance\n\n| Repo | Commits | + lines | - lines |\n|---|---:|---:|---:|\n| `acme/infra` | 2 | 34 | 12 |\n| `acme/payments` | 9 | 612 | 140 |\n| `acme/search-service` | 3 | 88 | 21 |\n| **Total** | **14** | **734** | **173** |\n\n- Claude Code sessions: 5 across 3 project(s)\n- PRs referenced: #229, #231\n- Tickets: PAY-412, SRCH-88\n- Tests: payments suite 412 → 430 passing\n\n## Payments\n\n- 2026-10-13 `a41c9e2` Classified card declines into retryable and final, using the processor's decline codes (PAY-412).\n- 2026-10-14 `5d07b3f` Retry queue for soft declines: at most 2 attempts, 30 minutes apart, behind the flag `payments.retry_soft_declines` (#231).\n- 2026-10-15 `e9a2210` Idempotency key on every charge attempt, so a retry cannot double-charge. 18 new tests.\n- 2026-10-16 `7f3c18d` Dashboard panel for retry outcomes (#229).\n\n## Search\n\n- 2026-10-15 `b20e4c7` Logged queries slower than 2 s to chase the p95 regression support reported (SRCH-88). Root cause not found yet.\n\n## Reliability\n\n- 2026-10-17 `c6d1f05` Raised the payments service memory limit from 512 to 768 MB after two OOM restarts on 2026-10-14.\n\n## Open items\n\n- Rollout plan for the retry flag needs sign-off from the payments lead.\n- Search p95 regression (SRCH-88): cause unknown.\n",
  "2026-10-19": "# 2026-10-19 to 2026-10-26\n\n## At a glance\n\n| Repo | Commits | + lines | - lines |\n|---|---:|---:|---:|\n| `acme/ci-tools` | 2 | 61 | 8 |\n| `acme/infra` | 4 | 96 | 40 |\n| `acme/payments` | 12 | 540 | 210 |\n| **Total** | **18** | **697** | **258** |\n\n- Claude Code sessions: 6 across 3 project(s)\n- PRs referenced: #238, #241, #244\n- Tickets: PAY-419\n- Tests: payments suite 430 → 437 passing\n\n## Payments\n\n- 2026-10-20 `1b8e6a0` Retries on for 10% of customers (#238). Measured 2026-10-23: failed payments in that cohort 2.1% → 1.2% over 3 days.\n- 2026-10-21 `0c4f7d9` Fix: retries were running for expired cards. `expired_card` is now a final decline (PAY-419).\n- 2026-10-23 `9e51ab3` Payment-failed email sent only after the last attempt (#241).\n- 2026-10-24 `f2a8c61` Retries on for 50% (#244).\n\n## Reliability\n\n- 2026-10-20 `4d9b2e7` Alert when the retry queue holds more than 500 jobs.\n- 2026-10-22 `ab03f51` Nightly snapshot of the staging database.\n\n## Developer tooling\n\n- 2026-10-23 `66c0e1a` Script that ranks CI jobs by median duration. Slowest: dependency install (6 min) and the integration suite (5 min).\n\n## Open items\n\n- Done: retry rollout plan signed off (2026-10-19).\n- Full rollout waits on finance confirming the processor's retry fees.\n- Still open: search p95 regression (SRCH-88).\n",
  "2026-10-26": "# 2026-10-26 to 2026-11-02\n\n## At a glance\n\n| Repo | Commits | + lines | - lines |\n|---|---:|---:|---:|\n| `acme/infra` | 5 | 188 | 61 |\n| `acme/payments` | 3 | 70 | 22 |\n| `acme/search-service` | 8 | 402 | 95 |\n| **Total** | **16** | **660** | **178** |\n\n- Claude Code sessions: 7 across 3 project(s)\n- PRs referenced: #252, #256, #258\n- Tickets: SRCH-88, OPS-57\n- Tests: search suite 208 → 221 passing\n\n## Search\n\n- 2026-10-27 `3e7d0b4` Found the cause of SRCH-88: the filter query does a full table scan on `listings` since the 2026-10-02 schema change.\n- 2026-10-29 `d81a6f2` Composite index on `(region, category, updated_at)` (#252). Staging p95 38 s → 9 s.\n- 2026-10-30 `5aa1c3e` Cache facet counts for 60 s (#258).\n\n## Incident 2026-10-28\n\nSearch was down 14:05 to 14:27 UTC (22 min). A config push set the database connection pool size to 0. Alex reverted it (`8c2e917`) and wrote the postmortem (OPS-57).\n\n## Reliability\n\n- 2026-10-28 `e4f0a3b` Config validation rejects pool sizes below 1 and other values that would stop a service.\n- 2026-10-31 `7b2d5c4` Canary step for search deploys: 5% of traffic for 15 minutes before full rollout.\n\n## Payments\n\n- 2026-10-27 `2f6b9d8` Retries on for 100% of customers after finance approved the fees (#256).\n\n## Open items\n\n- New: production index build needs a low-traffic window and DBA approval.\n- Done: full retry rollout.\n- Done: cause of SRCH-88 found; fix waits on the production index.\n",
  "2026-11-02": "# 2026-11-02 to 2026-11-09\n\n## At a glance\n\n| Repo | Commits | + lines | - lines |\n|---|---:|---:|---:|\n| `acme/ci-tools` | 4 | 150 | 35 |\n| `acme/payments` | 2 | 44 | 10 |\n| `acme/search-service` | 11 | 530 | 260 |\n| **Total** | **17** | **724** | **305** |\n\n- Claude Code sessions: 6 across 3 project(s)\n- PRs referenced: #263, #265, #66\n- Tickets: SRCH-88, SRCH-94\n- Tests: search suite 221 → 229 passing\n\n## Search\n\n- 2026-11-03 Index built online in production (DBA-approved window, 02:00 UTC).\n- 2026-11-04 Measured over 24 h in production: p95 38 s → 6 s. SRCH-88 closed.\n- 2026-11-05 `0f9e2d1` Removed the old query path, -180 lines (#263).\n- 2026-11-06 `c3a7b88` Load test at 2x peak traffic: p95 stays under 7 s (#265, SRCH-94).\n\n## Payments\n\n- 2026-11-05 `91d4e60` Removed the retry flag now that retries are on for everyone.\n- 2026-11-06 Two weeks at 100%: failed card payments 2.1% → 0.4%.\n\n## Developer tooling\n\n- 2026-11-06 `5e8a1f3` Prototype dependency cache for CI (#66): 14 → 9 min on a test branch.\n\n## Open items\n\n- New: retire the legacy search endpoint? Two internal callers remain.\n- Done: production index (SRCH-88).\n",
  "2026-11-09": "# 2026-11-09 to 2026-11-16\n\n## At a glance\n\n| Repo | Commits | + lines | - lines |\n|---|---:|---:|---:|\n| `acme/ci-tools` | 9 | 380 | 140 |\n| `acme/infra` | 6 | 210 | 95 |\n| `acme/payments` | 2 | 30 | 12 |\n| **Total** | **17** | **620** | **247** |\n\n- Claude Code sessions: 5 across 3 project(s)\n- PRs referenced: #71, #73, #75\n- Tickets: PAY-431\n- Tests: 6 flaky tests quarantined; everything else green\n\n## Developer tooling\n\n- 2026-11-10 `a7d3c20` Dependency cache for all CI pipelines (#71).\n- 2026-11-11 `2c9f4e1` Test suite split across 4 runners (#73).\n- 2026-11-12 `f81b0d7` Quarantine list for flaky tests, starting with 6 (#75).\n- 2026-11-13 Measured over 120 PRs: median CI time per PR 14 → 5 min.\n\n## Reliability\n\n- 2026-11-10 `6e2a9c5` Runner pool autoscaling.\n- 2026-11-14 `b4c8e13` Cost alarm on CI runners. Runner cost is up 8% week on week.\n\n## Payments\n\n- 2026-11-12 `d5f1a72` Payment-failed emails used the account's default locale instead of the customer's (PAY-431).\n\n## Open items\n\n- New: 6 quarantined tests need owners.\n- New: is +8% CI cost acceptable for 9 minutes saved per PR?\n- Still open: retire the legacy search endpoint?\n",
  "2026-11-16": "<!-- draft: facts only. /weekly-update writes this up and removes this line. -->\n# 2026-11-16 to 2026-11-23 (draft)\n\n## At a glance\n\n| Repo | Commits | + lines | - lines |\n|---|---:|---:|---:|\n| `acme/infra` | 2 | 40 | 8 |\n| `acme/payments` | 5 | 210 | 60 |\n| `acme/search-service` | 3 | 95 | 30 |\n| **Total** | **10** | **345** | **98** |\n\n- Claude Code sessions: 4 across 3 project(s)\n- PRs referenced: #270, #272\n- Ticket keys (candidates): PAY-436, SRCH-97\n\n## Commits: acme/infra\n\n- 2026-11-18 `0a7e4c2` Rotate staging snapshot retention to 7 days (+22/-6)\n- 2026-11-20 `e13b9f8` Bump base image (+18/-2)\n\n## Commits: acme/payments\n\n- 2026-11-17 `4c2d8a1` PAY-436 add retry reason to receipts export (+96/-20)\n- 2026-11-18 `b97f0e3` Tests for export columns (+58/-4)\n- 2026-11-19 `1f6a2d9` Backfill retry reason for October (#270) (+40/-12)\n- 2026-11-20 `8e3c5b7` Fix timezone in export dates (+10/-18)\n- 2026-11-21 `c04d9a6` Docs for finance export (+6/-6)\n\n## Commits: acme/search-service\n\n- 2026-11-17 `7d1e0b4` SRCH-97 log callers of legacy endpoint (+45/-5)\n- 2026-11-19 `2b8f6c3` Deprecation header on legacy endpoint (#272) (+38/-10)\n- 2026-11-21 `9a4c1e5` Remove unused facet config (+12/-15)\n\n## Open items\n\nCarried over from 2026-11-09_to_2026-11-16, status not checked yet:\n\n- New: 6 quarantined tests need owners.\n- New: is +8% CI cost acceptable for 9 minutes saved per PR?\n- Still open: retire the legacy search endpoint?\n"
 }
};
