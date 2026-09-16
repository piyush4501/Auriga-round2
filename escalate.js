const { nextPriority } = require('./sla');
const { buildQueue, OPEN_STATUSES } = require('./queue');

/**
 * The automated escalation check: any open ticket that has breached
 * its SLA gets bumped one priority level towards more urgent
 * (normal → high → urgent), exactly once per run.
 *
 * "Once per run" falls straight out of nextPriority() only ever
 * returning the immediate next rung — a ticket that's been overdue
 * for a week doesn't skip straight to urgent in one pass, it climbs
 * one level per invocation. Run this on a schedule (see
 * escalate-run.js) and a badly overdue ticket will climb the ladder
 * one rung per run until it reaches urgent, then stay there.
 *
 * A ticket already at 'urgent' has nowhere higher to go, so it's
 * left alone — it's already sorted to the top of the queue by the
 * overdue rule in queue.js regardless.
 *
 * @param db a better-sqlite3 database handle with a `tickets` table
 * @param now reference time, injectable for tests
 * @returns the list of tickets that were escalated this run
 */
function escalateOverdueTickets(db, now = new Date()) {
  const statusPlaceholders = [...OPEN_STATUSES].map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT * FROM tickets WHERE status IN (${statusPlaceholders})`)
    .all(...OPEN_STATUSES);

  const queue = buildQueue(rows, now);
  const update = db.prepare('UPDATE tickets SET priority = ? WHERE id = ?');

  const escalated = [];
  for (const ticket of queue) {
    if (!ticket.is_overdue) continue;

    const to = nextPriority(ticket.priority);
    if (!to) continue; // already at the top of the ladder

    update.run(to, ticket.id);
    escalated.push({
      id: ticket.id,
      customer_name: ticket.customer_name,
      title: ticket.title,
      from: ticket.priority,
      to,
    });
  }

  return escalated;
}

module.exports = { escalateOverdueTickets };
