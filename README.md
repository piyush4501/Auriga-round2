# Helpdesk Queue

A production-minded helpdesk ticket queue built around one rule: **the right ticket should always be on top**.

## Queue rule

Every open ticket gets a live SLA deadline from its creation time and priority:

- **Urgent:** 2-hour response SLA
- **Normal:** 24-hour response SLA

Queue ordering is deliberately applied **before pagination**:

1. Any ticket that has breached its SLA comes before a ticket that has not.
2. Within the same breached/not-breached bucket, higher priority comes first.
3. If priority is equal, the earliest SLA deadline comes first.

This means a normal ticket that is already overdue can jump ahead of a fresh urgent ticket. Resolved/closed tickets are never treated as overdue.

## Features

- Live overdue-first queue
- Urgent/normal priority and SLA countdowns
- Create and edit tickets
- Customer name + email
- Assignment and status management
- Search by ticket ID, customer, email, title, or description
- Filters for priority, status, assignee, overdue, and closed tickets
- Dashboard metrics
- Pagination over the fully ordered result set
- Safer DOM rendering on the client
- API validation
- Unit tests for queue ordering and API behavior
- SQLite persistence

## Architecture

```text
Browser
  ↓
Express REST API
  ↓
SQLite
  ↓
Queue engine (SLA + overdue detection + ordering)
```

The important data flow is:

```text
All matching tickets
        ↓
Calculate live SLA state
        ↓
Sort complete queue
        ↓
Apply filters
        ↓
Paginate
        ↓
Return page
```

That prevents a ticket on a later page from outranking a ticket on the current page.

## Run locally

```bash
npm install
npm run seed
npm start
```

Open `http://localhost:3000`.

## Tests

```bash
npm test
```

## GitHub Codespaces

1. Create a GitHub repository.
2. Upload/push the project files.
3. Open **Code → Codespaces → Create codespace on main**.
4. In the Codespace terminal run:

```bash
npm install
npm run seed
npm start
```

Forward port **3000** and open the browser preview.

## API

### `GET /api/tickets`

Query parameters:

- `search`
- `assigned_to`
- `overdue=true`
- `priority=urgent|normal`
- `status=open|in_progress|resolved|closed`
- `include_closed=true`
- `page`
- `pageSize`

### `GET /api/tickets/:id`

Returns a single ticket with derived SLA fields.

### `POST /api/tickets`

Creates a ticket.

### `PATCH /api/tickets/:id`

Updates customer, title, description, priority, status, or assignee.

### `GET /api/summary`

Returns current dashboard counts.

### `GET /api/agents`

Returns the configured helpdesk agents.
