const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'tickets.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    title         TEXT NOT NULL,
    description   TEXT,
    priority      TEXT NOT NULL CHECK(priority IN ('urgent','high','normal')),
    status        TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
    assigned_to   TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_tickets_customer_name ON tickets(customer_name);
`);

// Tiny migration for databases created by the previous version.
const columns = db.prepare('PRAGMA table_info(tickets)').all().map((c) => c.name);
if (!columns.includes('customer_email')) {
  db.exec('ALTER TABLE tickets ADD COLUMN customer_email TEXT');
}

// Migration for databases created before 'high' priority existed.
// SQLite can't ALTER a CHECK constraint in place, so rebuild the
// table when the old, narrower constraint is detected.
const tableDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'").get();
if (tableDef && /CHECK\(priority IN \('urgent','normal'\)\)/.test(tableDef.sql)) {
  db.exec(`
    ALTER TABLE tickets RENAME TO tickets_old_priority_migration;

    CREATE TABLE tickets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      title         TEXT NOT NULL,
      description   TEXT,
      priority      TEXT NOT NULL CHECK(priority IN ('urgent','high','normal')),
      status        TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
      assigned_to   TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    INSERT INTO tickets
      (id, customer_name, customer_email, title, description, priority, status, assigned_to, created_at)
      SELECT id, customer_name, customer_email, title, description, priority, status, assigned_to, created_at
      FROM tickets_old_priority_migration;

    DROP TABLE tickets_old_priority_migration;

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tickets_customer_name ON tickets(customer_name);
  `);
}

module.exports = db;
