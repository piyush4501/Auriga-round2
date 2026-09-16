// The whole "what's pressing?" rule lives here. Change response-time
// policy by editing this table — nothing else needs to change.
//
// PRIORITIES is ordered highest-pressing to lowest. Its array index
// doubles as the tie-break rank when two tickets are equally overdue
// (or equally not-overdue).

const PRIORITIES = ['urgent', 'normal'];

const SLA_HOURS = {
  urgent: 2,
  normal: 24,
};

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, i]));

function slaHoursFor(priority) {
  const hours = SLA_HOURS[priority];
  if (hours === undefined) {
    throw new Error(`Unknown priority "${priority}". Valid: ${PRIORITIES.join(', ')}`);
  }
  return hours;
}

module.exports = { PRIORITIES, SLA_HOURS, PRIORITY_RANK, slaHoursFor };
