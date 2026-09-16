const express = require('express');
const path = require('path');
const db = require('./db');
const { buildQueue } = require('./queue');
const { PRIORITIES } = require('./sla');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const AGENTS = ['priya', 'amit', 'dev'];
const MAX_TEXT = 500;

function cleanText(value, field, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${field} is required`);
  if (cleaned.length > MAX_TEXT) throw new Error(`${field} is too long (max ${MAX_TEXT} characters)`);
  return cleaned;
}

function validatePriority(priority) {
  if (!PRIORITIES.includes(priority)) {
    throw new Error(`priority must be one of: ${PRIORITIES.join(', ')}`);
  }
}

function validateStatus(status) {
  if (!STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${STATUSES.join(', ')}`);
  }
}

function validateEmail(email) {
  if (!email) return null;
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('customer_email must be a valid email address');
  }
  return email.trim().toLowerCase();
}

function validateAssignee(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !AGENTS.includes(value)) {
    throw new Error(`assigned_to must be one of: ${AGENTS.join(', ')} or null`);
  }
  return value;
}

function sendError(res, error) {
  return res.status(400).json({ error: error.message || 'Invalid request' });
}

app.get('/api/summary', (req, res) => {
  const rows = db.prepare('SELECT * FROM tickets').all();
  const queue = buildQueue(rows);
  res.json({
    open: queue.filter((t) => t.status === 'open').length,
    in_progress: queue.filter((t) => t.status === 'in_progress').length,
    overdue: queue.filter((t) => t.is_overdue).length,
    urgent: queue.filter((t) => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length,
  });
});

app.get('/api/tickets', (req, res) => {
  try {
    const { assigned_to, overdue, search, priority, status, include_closed } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    let rows = db.prepare('SELECT * FROM tickets').all();

    if (include_closed !== 'true') {
      rows = rows.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
    }

    let queue = buildQueue(rows);

    if (assigned_to) {
      queue = assigned_to === 'unassigned'
        ? queue.filter((t) => !t.assigned_to)
        : queue.filter((t) => t.assigned_to === assigned_to);
    }

    if (overdue === 'true') queue = queue.filter((t) => t.is_overdue);
    if (priority) {
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority filter' });
      queue = queue.filter((t) => t.priority === priority);
    }
    if (status) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });
      queue = queue.filter((t) => t.status === status);
    }

    if (search) {
      const needle = search.trim().toLowerCase();
      queue = queue.filter((t) => [
        String(t.id), t.customer_name, t.customer_email || '', t.title, t.description || '',
      ].some((value) => value.toLowerCase().includes(needle)));
    }

    const total = queue.length;
    const start = (page - 1) * pageSize;
    const items = queue.slice(start, start + pageSize);

    res.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/tickets/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ticket not found' });
  res.json(buildQueue([row])[0]);
});

app.post('/api/tickets', (req, res) => {
  try {
    const customer_name = cleanText(req.body.customer_name, 'customer_name', true);
    const customer_email = validateEmail(cleanText(req.body.customer_email, 'customer_email'));
    const title = cleanText(req.body.title, 'title', true);
    const description = cleanText(req.body.description, 'description');
    const priority = req.body.priority;
    validatePriority(priority);
    const assigned_to = validateAssignee(req.body.assigned_to);

    const info = db.prepare(`
      INSERT INTO tickets (customer_name, customer_email, title, description, priority, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customer_name, customer_email, title, description, priority, assigned_to ?? null);

    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(buildQueue([row])[0]);
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/api/tickets/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    const updates = {};
    if (req.body.customer_name !== undefined) updates.customer_name = cleanText(req.body.customer_name, 'customer_name', true);
    if (req.body.customer_email !== undefined) updates.customer_email = validateEmail(cleanText(req.body.customer_email, 'customer_email'));
    if (req.body.title !== undefined) updates.title = cleanText(req.body.title, 'title', true);
    if (req.body.description !== undefined) updates.description = cleanText(req.body.description, 'description');
    if (req.body.priority !== undefined) { validatePriority(req.body.priority); updates.priority = req.body.priority; }
    if (req.body.status !== undefined) { validateStatus(req.body.status); updates.status = req.body.status; }
    if (req.body.assigned_to !== undefined) updates.assigned_to = validateAssignee(req.body.assigned_to);

    const keys = Object.keys(updates);
    if (keys.length) {
      const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE tickets SET ${setClause} WHERE id = @id`).run({ ...updates, id: req.params.id });
    }

    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    res.json(buildQueue([row])[0]);
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/agents', (req, res) => res.json(AGENTS));
app.get('/api/config', (req, res) => res.json({ agents: AGENTS, priorities: PRIORITIES, statuses: STATUSES }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Helpdesk queue running on http://localhost:${PORT}`));
}

module.exports = app;
