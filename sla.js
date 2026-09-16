// The whole "what's pressing?" rule lives here. Change response-time
// policy by editing this table — nothing else needs to change.
//
// PRIORITIES is ordered highest-pressing to lowest. Its array index
// doubles as the tie-break rank when two tickets are equally overdue
// (or equally not-overdue).

const PRIORITIES = ['urgent', 'high', 'normal'];

// Response-time policy. 'high' sits between the original two levels —
// tune this to your org's real policy; only this table needs to change.
const SLA_HOURS = {
  urgent: 2,
  high: 8,
  normal: 24,
};

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, i]));

// The escalation ladder: breaching a promised response time bumps a
// ticket exactly one rung towards more pressing. 'urgent' has no
// entry — it's already the top, there's nowhere left to escalate to.
const ESCALATION_ORDER = {
  normal: 'high',
  high: 'urgent',
};

function slaHoursFor(priority) {
  const hours = SLA_HOURS[priority];
  if (hours === undefined) {
    throw new Error(`Unknown priority "${priority}". Valid: ${PRIORITIES.join(', ')}`);
  }
  return hours;
}

// The next priority up the ladder, or null if this priority is already
// at the top (nothing more urgent to escalate to).
function nextPriority(priority) {
  return ESCALATION_ORDER[priority] || null;
}

module.exports = { PRIORITIES, SLA_HOURS, PRIORITY_RANK, ESCALATION_ORDER, slaHoursFor, nextPriority };
