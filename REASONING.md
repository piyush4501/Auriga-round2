# Reasoning

This documents the thinking behind the helpdesk queue, in the order decisions
actually had to be made: what the problem was really asking for, then the
ordering rule, then everything else, then the escalation twist.

## 1. Finding the real requirement inside the story

The brief is written as a story about Priya, not a spec, so the first job was
translating "the way she talks about her queue" into a concrete rule. Three
sentences carry all the weight:

> she wants to always pick the most pressing ticket next, with anything past
> its promised time jumping to the front.

That's not one rule, it's two, in a specific order:

1. "Most pressing ticket next" → sort by priority.
2. "Anything past its promised time jumping to the front" → but overdue beats
   priority, unconditionally.

The rest of the paragraph ("what's overdue", "what's assigned to me", "look
up a customer by name", "pages through it") is filters, lookup, and
pagination — real requirements, but secondary. The prompt says as much
directly: *"Get tickets and the queue order right first, then filters and
assignment."* So the design effort went disproportionately into the ordering
rule, and everything else was built to not interfere with it.

## 2. Deciding the exact ordering rule

"Jumping to the front" is ambiguous on its own — front of what, relative to
what? Two readings seemed possible:

- **A. Overdue is a tiebreaker within priority.** Urgent tickets sort among
  themselves, normal tickets sort among themselves, and overdue only breaks
  ties inside each group.
- **B. Overdue is a bucket above priority.** Every overdue ticket, regardless
  of priority, outranks every non-overdue ticket. Priority only matters
  *within* the overdue bucket and *within* the non-overdue bucket.

Reading A keeps urgent tickets permanently ahead of normal ones, breach or
not — which contradicts "jumping to the front." Reading B is the only one
that actually produces the behavior Priya describes: a normal ticket that's
been sitting for a day can leapfrog a fresh urgent ticket that's only two
minutes old. So the rule became:

1. Breached beats not-breached, always.
2. Within the same breach state, higher priority wins.
3. Within the same breach state and priority, the earliest deadline wins
   (oldest breach surfaces first among breached tickets; the ticket closest
   to breaching surfaces first among healthy ones).

Rule 3 needed its own justification: without it, ties inside a bucket are
arbitrary, and "arbitrary" is exactly what a queue that's supposed to always
put the right ticket on top shouldn't be. Earliest deadline is the natural
tiebreak because it's the same signal driving rule 1 — it's not a new rule,
it's the same "how close to/how far past the promised time" logic taken to
its next decimal place.

This rule lives in exactly one function, `compareTickets` in `queue.js`,
because a rule this central should be checkable by reading ten lines, not by
tracing it through the whole codebase.

## 3. Deriving "overdue" instead of storing it

A ticket's SLA state changes with the clock, not with user action. Storing
`is_overdue` as a column would mean either a background job constantly
rewriting rows, or a queue that's wrong the moment nobody's looking at it.
Instead, `sla_deadline` and `is_overdue` are computed on read, from
`created_at` and `priority`, against `now`. This has a real cost — every
`GET /api/tickets` recomputes the whole table — but at helpdesk scale that's
irrelevant, and in exchange the queue is *always* correct, including the
one case that's easy to get wrong: a resolved or closed ticket is never
overdue, breach or not, because it's done. That's an explicit check
(`isOpen && now > deadline`), not an incidental one, because the alternative
— a "closed but still flashing red" ticket — is exactly the kind of bug that
erodes trust in the queue.

`now` is a parameter, not a call to `new Date()` buried in the sort, purely
so the ordering logic can be unit-tested without racing the clock.

## 4. Sort-then-filter-then-paginate, in that order

The most likely correctness bug in a "queue + pagination" feature is sorting
each page independently, or filtering after paginating. Either one lets a
lower-priority ticket outrank a higher-priority one just because they landed
on different pages. So the pipeline is fixed as:

```
all matching rows → compute SLA state → sort the whole set → filter → paginate
```

`buildQueue` always runs on the complete set before anything is sliced.
Filters run after sorting so that a filtered view is a faithful subset of the
same order Priya sees in the unfiltered queue — "what's overdue" isn't a
different sort, it's the same sort with rows removed. This is called out
explicitly in the README's architecture diagram, because it's the kind of
constraint that's invisible in the output until someone breaks it.

## 5. Everything downstream of the queue is intentionally boring

Filters (assignee, overdue, priority, status, closed), search (id, name,
email, title, description substring match), and CRUD are built as
straightforward, well-tested plumbing on purpose. None of them encode
judgment calls the way the ordering rule does — they're either "does this
field match" or "does this string contain that string" — so the design goal
here was just correctness and validation (rejecting bad priorities/statuses/
emails, capping text length, escaping output in the DOM), not cleverness. The
one deliberate choice worth naming: `assigned_to=unassigned` is a distinct
filter value from an empty filter, because "who has nothing assigned" and
"don't filter by assignee" are different questions Priya would actually ask.

## 6. The escalation twist: reusing the same primitive

The added requirement was an automated check that escalates a breached
ticket one priority level (normal → high → urgent), at most one level per
run. Three design questions came up, in this order:

**Where does "high" sit, and does it change the queue rule?** It's inserted
into the same `PRIORITIES` array that already drives sort order
(`PRIORITY_RANK` is generated from that array's position), so the existing
`compareTickets` needed zero changes to understand three priorities instead
of two. This is the payoff of having put the ordering rule in one place
originally — adding a priority level is a one-line change to a lookup table.

**What does "one level per run" actually mean, mechanically?** Rather than
building a batch that decides how far to escalate, the escalation function
(`nextPriority`) can only ever answer "what's the *next* rung up," never
"how many rungs is this ticket overdue by." A ticket breached ten days ago
and a ticket breached ten minutes ago both move exactly one step per call.
That makes "one level per run" true by construction — it's not a limit
enforced by a counter or a check, it's the only thing the function is capable
of doing. Running the check again later lets a badly-overdue ticket keep
climbing, one rung at a time, until it reaches urgent and has nowhere further
to go. That felt like the right behavior for real usage: a ticket that's been
ignored for a week should end up urgent eventually, just not in one jump.

**What counts as "automated"?** A function that escalates tickets is not
itself a check that runs — something has to call it without a person
remembering to. Rather than pick one mechanism, three were built, because
each solves a different deployment reality: a `setInterval` inside the
running server so it works with zero external setup; a `POST /api/escalate`
endpoint for a UI button or an external scheduler that prefers HTTP; and a
plain CLI script (`escalate-run.js`, exit-code friendly) for cron or a
systemd timer in a real deployment. All three call the same
`escalateOverdueTickets`, so "automated" doesn't mean three different
implementations to keep in sync — it means three doors into one function.

**Does escalation fight the SLA-deadline math?** Raising a ticket's priority
changes its SLA hours, which changes its deadline, computed from the same
`created_at`. A ticket escalated from normal (24h) to high (8h) may *still*
be overdue under the new, stricter deadline — which is correct, not a bug:
it just means the next run will escalate it again, on schedule, one more
rung. No special-casing was needed here because `is_overdue` was already
derived live rather than cached; escalation just changes an input to a
calculation that was already always re-run.

## 7. What was deliberately left out

- **Priority downgrade / de-escalation.** Nothing in the brief asks for it,
  and inventing a rule for "when does urgency go back down" risked adding
  behavior nobody asked for and nobody could verify against the spec.
- **A persistent escalation audit log.** `escalate.js` returns what it
  changed on each run (useful for the API response and the CLI's printed
  report), but nothing is written to a table. It was easy to add and easy to
  get wrong (retention policy, schema, who reads it) for a requirement that
  never mentioned auditing.
- **Configurable SLA hours for "high" via the API.** The brief didn't specify
  a number for the new tier, so `high: 8` is a documented assumption in
  `sla.js`, not a hardcoded guess buried in logic — it's the one number in
  the whole feature that's an editorial call rather than a derivation from
  the spec, and it's called out as such in a comment so it's easy to
  challenge or change.
