const db = require('./db');
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const tickets = [
  { customer_name:'Meera Shah', customer_email:'meera@demo.com', title:'Laptop won’t boot before client demo', description:'BSOD on startup, demo in 30 min', priority:'urgent', status:'open', assigned_to:'priya', created_at:hoursAgo(2.5) },
  { customer_name:'Rohan Gupta', customer_email:'rohan@demo.com', title:'VPN drops every few minutes', description:'Remote customer call starts soon', priority:'urgent', status:'open', assigned_to:null, created_at:hoursAgo(.5) },
  { customer_name:'Ananya Iyer', customer_email:'ananya@demo.com', title:'Request bigger monitor', description:'Current one is 19", would like 27"', priority:'normal', status:'open', assigned_to:'priya', created_at:hoursAgo(30) },
  { customer_name:'Vikram Nair', customer_email:'vikram@demo.com', title:'Printer on 3rd floor out of toner', description:'Finance team cannot print invoices', priority:'normal', status:'open', assigned_to:null, created_at:hoursAgo(4) },
  { customer_name:'Sara Khan', customer_email:'sara@demo.com', title:'Password reset for shared drive', description:'', priority:'normal', status:'in_progress', assigned_to:'dev', created_at:hoursAgo(1) },
  { customer_name:'Karan Mehta', customer_email:'karan@demo.com', title:'Old ticket, already resolved', description:'Fixed last week', priority:'normal', status:'resolved', assigned_to:'dev', created_at:hoursAgo(72) },
  { customer_name:'Meera Shah', customer_email:'meera@demo.com', title:'Second monitor flickering', description:'', priority:'normal', status:'open', assigned_to:'priya', created_at:hoursAgo(6) },
  { customer_name:'Divya Rao', customer_email:'divya@demo.com', title:'Onboarding: new laptop setup', description:'Starts Monday', priority:'normal', status:'open', assigned_to:null, created_at:hoursAgo(20) },
  { customer_name:'Arjun Patel', customer_email:'arjun@demo.com', title:'Client VPN access', description:'Needs access before 5 PM', priority:'urgent', status:'open', assigned_to:'amit', created_at:hoursAgo(1.2) },
  { customer_name:'Neha Joshi', customer_email:'neha@demo.com', title:'Keyboard replacement', description:'Several keys stopped working', priority:'normal', status:'open', assigned_to:null, created_at:hoursAgo(8) }
];
const insert=db.prepare(`INSERT INTO tickets (customer_name, customer_email, title, description, priority, status, assigned_to, created_at) VALUES (@customer_name,@customer_email,@title,@description,@priority,@status,@assigned_to,@created_at)`);
db.prepare('DELETE FROM tickets').run();tickets.forEach(t=>insert.run(t));console.log(`Seeded ${tickets.length} tickets.`);
