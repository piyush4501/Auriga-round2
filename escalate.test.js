const assert = require('assert');
const Database = require('better-sqlite3');
const { escalateOverdueTickets } = require('./escalate');

const NOW = new Date('2026-09-16T12:00:00.000Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();

// A throwaway in-memory DB with the same shape as db.js, so these
// tests don't touch the real tickets.db file.
function makeDb(rows) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const insert = db.prepare(`
    INSERT INTO tickets (customer_name, title, priority, status, created_at)
    VALUES (@customer_name, @title, @priority, @status, @created_at)
  `);
  for (const r of rows) insert.run({ customer_name: 'Test', title: 'Test ticket', status: 'open', ...r });
  return db;
}

{
  // Normal ticket, way past its 24h SLA — should climb exactly one
  // rung (normal → high), not jump straight to urgent.
  const db = makeDb([{ priority: 'normal', created_at: hoursAgo(48) }]);
  const escalated = escalateOverdueTickets(db, NOW);
  assert.strictEqual(escalated.length, 1);
  assert.strictEqual(escalated[0].from, 'normal');
  assert.strictEqual(escalated[0].to, 'high');
  assert.strictEqual(db.prepare('SELECT priority FROM tickets WHERE id = 1').get().priority, 'high');
  db.close();
  console.log('PASS: overdue normal ticket escalates to high, one rung');
}

{
  // High ticket, past its 8h SLA — should climb to urgent.
  const db = makeDb([{ priority: 'high', created_at: hoursAgo(10) }]);
  const escalated = escalateOverdueTickets(db, NOW);
  assert.strictEqual(escalated.length, 1);
  assert.strictEqual(escalated[0].to, 'urgent');
  db.close();
  console.log('PASS: overdue high ticket escalates to urgent');
}

{
  // Already urgent and breached — nowhere higher to go, left alone.
  const db = makeDb([{ priority: 'urgent', created_at: hoursAgo(5) }]);
  const escalated = escalateOverdueTickets(db, NOW);
  assert.strictEqual(escalated.length, 0);
  assert.strictEqual(db.prepare('SELECT priority FROM tickets WHERE id = 1').get().priority, 'urgent');
  db.close();
  console.log('PASS: urgent ticket already at the top is left alone');
}

{
  // Not overdue yet — must not be touched.
  const db = makeDb([{ priority: 'normal', created_at: hoursAgo(1) }]);
  const escalated = escalateOverdueTickets(db, NOW);
  assert.strictEqual(escalated.length, 0);
  assert.strictEqual(db.prepare('SELECT priority FROM tickets WHERE id = 1').get().priority, 'normal');
  db.close();
  console.log('PASS: ticket within SLA is not escalated');
}

{
  // Resolved tickets are done, breach or not — never escalated.
  const db = makeDb([{ priority: 'normal', status: 'resolved', created_at: hoursAgo(72) }]);
  const escalated = escalateOverdueTickets(db, NOW);
  assert.strictEqual(escalated.length, 0);
  db.close();
  console.log('PASS: resolved ticket is never escalated');
}

{
  // Simulate two runs of the scheduled check on the same badly
  // overdue normal ticket: it should climb one rung per run, not
  // skip levels — normal -> high on run 1, high -> urgent on run 2.
  const db = makeDb([{ priority: 'normal', created_at: hoursAgo(100) }]);
  const run1 = escalateOverdueTickets(db, NOW);
  assert.strictEqual(run1[0].to, 'high');
  const run2 = escalateOverdueTickets(db, NOW);
  assert.strictEqual(run2[0].to, 'urgent');
  const run3 = escalateOverdueTickets(db, NOW);
  assert.strictEqual(run3.length, 0); // already urgent, nothing left to do
  db.close();
  console.log('PASS: badly overdue ticket climbs one rung per run, not all at once');
}

console.log('\nAll escalation tests passed.');
