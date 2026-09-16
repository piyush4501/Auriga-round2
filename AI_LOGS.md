# AI Development Log

This project was built across two tools, used back to back: an initial build
and iteration phase in **ChatGPT**, followed by a verification, feature-add,
and documentation phase in **Claude (Anthropic)**. This log records both
phases in chronological order — prompt, intent, and (for the Claude phase,
where the resulting actions are directly available) what was actually built
and how it was verified.

**Project:** Helpdesk Queue (Auriga, Round 2)

---

## Phase 1 — Initial build and iteration (ChatGPT)

The base application — ticket schema, SLA queue ordering, filters, search,
pagination, assignment, and the frontend — was built in this phase, through
an iterative back-and-forth of build → review → fix requests.

| # | Prompt | Intent |
|---|---|---|
| 1 | Original problem statement (Priya / helpdesk queue — see full text in Phase 2, Session 1) | Define the core requirement: an SLA-aware queue where overdue tickets jump to the front, ahead of filters, search, and pagination. |
| 2 | "Build the whole system for it, and after that I need to upload it on Codespaces / GitHub." | Requested a complete, runnable system, deployable via GitHub Codespaces. |
| 3 | "How is it?" | Requested a review of the build so far. |
| 4 | "Tell me what I need to improve." | Requested a gap analysis / improvement list. |
| 5 | "Do the change and give the updated file." | Requested the improvements be implemented and delivered. |
| 6 | "Give the particular updated file." | Requested a single specific file rather than the full set. |
| 7 | "Saath me de deo" *("give them together")* | Requested multiple frontend files be combined/delivered together. |
| 8 | "How to create the `public` folder?" | Asked for guidance on the GitHub/Codespaces file structure. |
| 9 | "There is no CSS." | Reported that styling was missing from the delivered frontend. |
| 10 | "I can't add a new ticket." | Reported a functional bug in ticket creation. |
| 11 | "The prompt I gave you." | Requested the original problem statement be repeated back for reference. |
| 12 | Problem statement re-sent with **The Twist** appended: an automated check that escalates any ticket which has breached its SLA, raising priority one level (normal → high → urgent), at most one level per run. | Introduced the escalation requirement into the ChatGPT-built project. |
| 13 | "Do it." | Requested the twist be implemented. |
| 14 | "What do I need to update, and also give me the CSS and JavaScript separately." | Requested a change summary plus the frontend split into separate files. |
| 15 | "The twist problem??" | Follow-up seeking clarification on the escalation requirement/implementation. |
| 16 | "Analyse." | Requested a general analysis of the project's current state. |
| 17 | "When I create a new ticket there's a status option — why would anyone need to set that on creation? Also, when I mark a ticket resolved, why doesn't the filter show that?" | Reported two UX/logic issues: an unnecessary status field on ticket creation, and resolved tickets not surfacing under the expected filter. |
| 18 | "Do the change and give me the updated file only." | Requested both issues from #17 be fixed and delivered. |
| 19 | "Give me separate files." | Requested per-file delivery again. |
| 20 | "Saath me de deo" *("give them together")* | Requested the frontend files be delivered together again. |
| 21 | "Give me the prompt log I sent you." | First request for a development log. |
| 22 | "The prompt I gave you." | Clarified that the log should be the user's own prompts, not a summary. |
| 23 | "Give me all the user requests you received." | Final request for the complete prompt history from this phase — the source for the table above. |

**Net requirements carried out of this phase**, as distilled by the user
across the above requests:

- A complete IT helpdesk ticket system with SLA-aware queue ordering as the
  central feature — overdue tickets jump to the front, ahead of priority.
- Priority-based ordering with live SLA deadlines.
- Filters for overdue, status, priority, and assignee; search by
  customer/ticket; pagination over the full ordered set.
- Ticket assignment and editing; new tickets starting as `Open` without
  requiring a status choice at creation.
- Resolved/closed tickets remaining searchable and filterable, not hidden
  by default in a way that breaks expected filters.
- Automated SLA escalation: `normal → high → high → urgent`, capped at one
  level per automated run.
- Automated tests for queue ordering and escalation.
- A frontend split into `public/index.html`, `public/styles.css`, and
  `public/app.js`.
- GitHub / GitHub Codespaces readiness.
- A clean, professional log of the prompts used to build the project.

Several of these — most notably the escalation twist (#12–15), the ticket
creation and resolved-ticket filtering issues (#17), and the split frontend
files (#14, #19, #20) — were requested here but carried forward and
completed in Phase 2 rather than fully resolved in this phase.

---

## Phase 2 — Verification, escalation feature, and documentation (Claude)

The existing build was handed to Claude as a finished project (uploaded as a
`.zip`) for verification against the original problem statement, followed by
implementation of the escalation twist and supporting documentation.

### Session 1 — Verify the existing solution against the problem statement

**Prompt:**
> The helpdesk is drowning. Priya runs a two-person IT helpdesk and the queue
> never stops. Some tickets are 'my laptop won't boot before a client demo'
> emergencies; others are 'can I get a bigger monitor.' Each ticket has a
> priority and an agreed response time — urgent within 2 hours, normal within
> a day — and Priya wants to always pick the most pressing ticket next, with
> anything past its promised time jumping to the front. She's forever
> answering 'what's overdue?' and 'what's assigned to me?', and looking up a
> specific customer's ticket by name. The list is huge, so she pages through
> it. Build Priya something so the right ticket is always on top.
>
> This is the problem statement and in the above file I uploaded the solution
> for it — verify the files and problem.

**What was done:**
- Unzipped and read every file in the uploaded project (`sla.js`, `queue.js`,
  `db.js`, `server.js`, `seed.js`, `public/index.html`, and both test files).
- Installed dependencies and ran the existing test suite.
- Started the server and hit the live API directly (`/api/tickets`,
  `/api/summary`) with multiple filter/pagination/search combinations to
  confirm behavior matched the README's claims rather than trusting the
  README alone.
- Checked the ordering logic (`compareTickets`) line by line against the
  three-part rule implied by the problem statement: breached-before-healthy,
  then priority, then earliest deadline.
- Checked the frontend for unescaped `innerHTML` usage (XSS risk).

**Verification:**
- `npm test` — 11/11 tests passing (5 queue-ordering, 6 API).
- Live query against seeded data confirmed a breached normal ticket ranked
  above a fresh urgent ticket, and that page 2 stayed correctly ordered
  relative to page 1 (sort happens before pagination, not after).
- Frontend confirmed to escape all dynamic values before DOM insertion.

**Outcome:** Solution verified as correct and complete against the stated
requirements. No code changes made in this session.

---

### Session 2 — Add the escalation requirement ("The Twist")

**Prompt:**
> The Twist. Your solution must also include an automated check that
> escalates any ticket which has breached its agreed response time — raising
> its priority by one level (normal → high → urgent), at most one level per
> run.
>
> Wait, this implies a new priority level "high" between normal and urgent.
> Now this is the new update in the problem statement — now build this
> feature and give me the updated file only.

**What was done:**
- Identified that "normal → high → urgent" requires a third priority tier
  that didn't exist in the original schema, and traced every place a
  two-value priority was assumed (`sla.js`, the SQLite `CHECK` constraint in
  `db.js`, `server.js` validation, the frontend `<select>` options).
- Added `high` to the priority ladder in `sla.js`, with an `SLA_HOURS` entry
  and a `nextPriority()` function that returns exactly the next rung up (or
  `null` at the top) — chosen specifically so "one level per run" is
  structural, not a rule enforced by a separate check.
- Wrote `escalate.js`: loads open/in-progress tickets, computes live SLA
  state via the existing `buildQueue`, and bumps every overdue ticket's
  priority by calling `nextPriority()` once.
- Wrote `escalate-run.js` as a CLI entrypoint, for scheduling via cron or a
  systemd timer outside the running server process.
- Wired the check into `server.js` two more ways: a `setInterval` that runs
  it automatically on a timer from server startup, and a
  `POST /api/escalate` endpoint for on-demand triggering.
- Migrated `db.js`'s `CHECK(priority IN (...))` constraint to include
  `'high'`, with a runtime migration path for databases created under the
  old two-tier schema (SQLite can't `ALTER` a `CHECK` constraint in place, so
  the migration detects the old constraint and rebuilds the table).
- Added `high` to the frontend priority filter and the new/edit ticket form,
  plus a badge color for it.
- Wrote `escalate.test.js`: unit tests using an in-memory SQLite database,
  including one that runs the check twice in a row on the same badly-overdue
  ticket to prove it climbs one rung per call rather than skipping straight
  to `urgent`.

**Verification:**
- `npm test` — 17/17 tests passing (5 queue-ordering, 6 new escalation, 6
  API).
- Ran the migration against the actual database file left over from Session
  1 (created under the old schema) and confirmed all 10 rows survived with
  the constraint updated.
- Started the server against freshly seeded data and confirmed, live:
  - the startup timer escalated a breached `normal` ticket to `high` before
    any manual action was taken;
  - a manual `POST /api/escalate` call then escalated the same ticket from
    `high` to `urgent`, one rung, on the next run — the ratchet behavior
    working exactly as specified across two separate invocations.

**Outcome:** Escalation feature implemented, tested, and verified live
against a running instance, not just against unit tests.

---

### Session 3 — Deliver files individually

**Prompt:**
> Give me the updated file separately.

**What was done:**
- Re-delivered the same set of new/changed files from Session 2 as
  individual files rather than a single zip, so each could be reviewed and
  dropped into the existing project in place.

**Outcome:** No code changes — packaging only.

---

### Session 4 — Document the design reasoning

**Prompt:**
> Write the REASONING.md explanation of thought process behind the solution.

**What was done:**
- Wrote `REASONING.md` reconstructing the actual sequence of design
  decisions: how the ordering rule was derived from Priya's description
  (and why the "overdue-as-bucket" reading was chosen over the alternative
  "overdue-as-tiebreaker" reading), why SLA state is computed live instead
  of stored, why sorting happens before pagination, and — for the escalation
  twist — why `nextPriority()` makes "one level per run" a structural
  property rather than an enforced rule, why three separate trigger
  mechanisms were built for the same underlying function, and what was
  deliberately left out (de-escalation, an audit log, a configurable SLA API)
  and why.

**Outcome:** `REASONING.md` added to the project; no code changes.

---

### Session 5 — First pass at this log

**Prompt:**
> I also need to save the LLM log or prompt I used to build this project —
> can you help me create the clean and pro LLM log for this? I need it in an
> AI_LOGS.md file.

**What was done:**
- Wrote a first version of this file, covering only the Claude sessions
  (this phase), in prompt → action → verification form.

**Outcome:** `AI_LOGS.md` added to the project.

---

### Session 6 — Merge in the ChatGPT prompt history

**Prompt:**
> This is the prompt log I sent to ChatGPT — add it to the log too, and write
> it in a professional way; you can edit the actual prompts for
> professionalism.

**What was done:**
- Restructured `AI_LOGS.md` into two phases: Phase 1 (ChatGPT — initial
  build and iteration) and Phase 2 (Claude — verification, escalation
  feature, and documentation), so the full build history from both tools is
  captured in one file.
- Cleaned up the 23 raw ChatGPT prompts into a single table of
  prompt/intent pairs, correcting typos and informal phrasing (e.g. "saath
  me de deo" is noted with its meaning) while preserving what was actually
  asked for at each step.
- Cross-referenced the ChatGPT-phase requests against what Claude later
  built, and noted explicitly which ChatGPT-phase requests (the escalation
  twist, the ticket-creation/status issue, the resolved-ticket filter issue,
  the split frontend files) were carried forward and completed in Phase 2
  rather than resolved in Phase 1.

**Outcome:** `AI_LOGS.md` rewritten as a complete, two-phase development log.

---

## Files touched, by phase

| File | Origin |
|---|---|
| `queue.js`, `db.js` (pre-twist), `server.js` (pre-twist), `seed.js`, `public/index.html` (pre-twist), `queue.test.js`, `api.test.js` | Built in Phase 1 (ChatGPT); verified, not authored, in Phase 2 Session 1 |
| `sla.js` (high tier + `nextPriority`) | Modified — Phase 2, Session 2 |
| `db.js` (schema + migration) | Modified — Phase 2, Session 2 |
| `server.js` (timer + `/api/escalate`) | Modified — Phase 2, Session 2 |
| `public/index.html` (High option + escalation button) | Modified — Phase 2, Session 2 |
| `package.json` (`escalate` script, test wiring) | Modified — Phase 2, Session 2 |
| `README.md` (escalation docs) | Modified — Phase 2, Session 2 |
| `escalate.js` | New — Phase 2, Session 2 |
| `escalate-run.js` | New — Phase 2, Session 2 |
| `escalate.test.js` | New — Phase 2, Session 2 |
| `REASONING.md` | New — Phase 2, Session 4 |
| `AI_LOGS.md` | New — Phase 2, Session 5; rewritten Session 6 (this file) |
