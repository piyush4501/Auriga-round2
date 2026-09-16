// Standalone entrypoint for the escalation check, meant to be run on
// a schedule (cron, systemd timer, a Codespaces/CI job, etc.):
//
//   */5 * * * *  cd /path/to/app && npm run escalate
//
// The server also runs this same check on an internal timer so it
// works even without external scheduling — see server.js. This file
// exists so the check can *also* be triggered from outside the
// running process, and so it has a plain exit code for monitoring.

const db = require('./db');
const { escalateOverdueTickets } = require('./escalate');

const escalated = escalateOverdueTickets(db);

if (escalated.length === 0) {
  console.log('Escalation check: no breached tickets to escalate.');
} else {
  console.log(`Escalation check: escalated ${escalated.length} ticket(s).`);
  for (const t of escalated) {
    console.log(`  #${t.id} "${t.title}" (${t.customer_name}): ${t.from} → ${t.to}`);
  }
}

db.close();
