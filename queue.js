const { PRIORITY_RANK, slaHoursFor } = require('./sla');

const OPEN_STATUSES = new Set(['open', 'in_progress']);

/**
 * Attach the fields that only exist "right now": the promised deadline
 * and whether that deadline has already passed. A resolved/closed
 * ticket is never overdue — it's done, breach or not.
 */
function withDerivedFields(ticket, now = new Date()) {
  const createdAt = new Date(ticket.created_at);
  const slaDeadline = new Date(createdAt.getTime() + slaHoursFor(ticket.priority) * 3600 * 1000);
  const isOpen = OPEN_STATUSES.has(ticket.status);
  const isOverdue = isOpen && now.getTime() > slaDeadline.getTime();

  return {
    ...ticket,
    sla_deadline: slaDeadline.toISOString(),
    is_overdue: isOverdue,
    minutes_to_deadline: Math.round((slaDeadline.getTime() - now.getTime()) / 60000),
  };
}

/**
 * The ordering rule, in order of precedence:
 *   1. Overdue tickets always beat non-overdue ones, full stop —
 *      this is what makes a breached "normal" ticket jump ahead
 *      of a fresh "urgent" one.
 *   2. Among tickets in the same overdue/not-overdue bucket, sort
 *      by priority (urgent before normal, etc).
 *   3. Within the same bucket and priority, earliest deadline first
 *      — so among several overdue urgents, the one that breached
 *      longest ago stays on top; among non-overdue ones, the one
 *      closest to breaching stays on top.
 */
function compareTickets(a, b) {
  if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;

  const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rankDiff !== 0) return rankDiff;

  return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
}

function buildQueue(rawTickets, now = new Date()) {
  return rawTickets
    .map((t) => withDerivedFields(t, now))
    .sort(compareTickets);
}

module.exports = { withDerivedFields, compareTickets, buildQueue, OPEN_STATUSES };
