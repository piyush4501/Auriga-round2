const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Avoid sharing a stale database during tests.
const dbFile = path.join(__dirname, 'tickets.db');
if (fs.existsSync(dbFile)) fs.rmSync(dbFile);
if (fs.existsSync(dbFile + '-wal')) fs.rmSync(dbFile + '-wal');
if (fs.existsSync(dbFile + '-shm')) fs.rmSync(dbFile + '-shm');
const db = require('./db');
const app = require('./server');
const server = app.listen(0);

function request(method, pathName, body) {
  return new Promise((resolve, reject) => {
    const req=http.request({port:server.address().port,path:pathName,method,headers:{'Content-Type':'application/json'}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,body:raw?JSON.parse(raw):{}}))});req.on('error',reject);if(body)req.write(JSON.stringify(body));req.end();
  });
}

(async()=>{
  try {
    db.prepare(`INSERT INTO tickets (customer_name, customer_email, title, description, priority, status, assigned_to, created_at) VALUES (?,?,?,?,?,?,?,?)`).run('Asha','asha@example.com','Laptop issue','Boot error','urgent','open','priya','2026-09-16T08:30:00.000Z');
    db.prepare(`INSERT INTO tickets (customer_name, customer_email, title, description, priority, status, assigned_to, created_at) VALUES (?,?,?,?,?,?,?,?)`).run('Ben','ben@example.com','Monitor request','Need a larger display','normal','open',null,'2026-09-16T07:00:00.000Z');

    let r=await request('GET','/api/tickets?search=laptop');assert.strictEqual(r.status,200);assert.strictEqual(r.body.total,1);console.log('PASS: search finds issue title');
    r=await request('GET','/api/tickets?assigned_to=priya');assert.strictEqual(r.body.total,1);console.log('PASS: assignee filter');
    r=await request('POST','/api/tickets',{customer_name:'Cara',customer_email:'cara@example.com',title:'Wi-Fi',description:'Disconnected',priority:'normal',assigned_to:'amit'});assert.strictEqual(r.status,201);console.log('PASS: create ticket');
    r=await request('PATCH','/api/tickets/3',{status:'in_progress',assigned_to:'priya'});assert.strictEqual(r.status,200);assert.strictEqual(r.body.assigned_to,'priya');console.log('PASS: update ticket');
    r=await request('POST','/api/tickets',{customer_name:'Bad',title:'Bad',priority:'critical'});assert.strictEqual(r.status,400);console.log('PASS: validation rejects bad priority');
    r=await request('GET','/api/summary');assert.ok(Number.isInteger(r.body.overdue));console.log('PASS: summary endpoint');

    // Regression check: an explicit status=resolved (or closed) filter must
    // surface matching tickets on its own, without also needing
    // include_closed=true. Resolving a ticket that's currently visible,
    // then asking for it by status, is the exact scenario that broke.
    r=await request('PATCH','/api/tickets/1',{status:'resolved'});assert.strictEqual(r.status,200);
    r=await request('GET','/api/tickets?status=resolved');assert.strictEqual(r.status,200);assert.ok(r.body.items.some(t=>t.id===1),'resolved ticket should appear when explicitly filtered by status=resolved');console.log('PASS: explicit status=resolved filter surfaces resolved tickets');
    r=await request('PATCH','/api/tickets/1',{status:'closed'});assert.strictEqual(r.status,200);
    r=await request('GET','/api/tickets?status=closed');assert.strictEqual(r.status,200);assert.ok(r.body.items.some(t=>t.id===1),'closed ticket should appear when explicitly filtered by status=closed');console.log('PASS: explicit status=closed filter surfaces closed tickets');
  } finally {
    server.close();db.close();
    for(const suffix of ['','-wal','-shm']){const f=dbFile+suffix;if(fs.existsSync(f))fs.rmSync(f)}
  }
})().catch(err=>{console.error(err);process.exitCode=1});
