const assert = require('assert');
const { buildQueue } = require('./queue');
const NOW = new Date('2026-09-16T12:00:00.000Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const t=(overrides)=>({id:overrides.id,customer_name:'Test',title:'Test ticket',status:'open',assigned_to:null,...overrides});

{
  const q=buildQueue([t({id:1,priority:'urgent',created_at:hoursAgo(.5)}),t({id:2,priority:'normal',created_at:hoursAgo(30)})],NOW);
  assert.strictEqual(q[0].id,2); console.log('PASS: overdue beats priority');
}
{
  const q=buildQueue([t({id:1,priority:'normal',created_at:hoursAgo(1)}),t({id:2,priority:'urgent',created_at:hoursAgo(1)})],NOW);
  assert.strictEqual(q[0].id,2); console.log('PASS: priority orders fresh tickets');
}
{
  const q=buildQueue([t({id:1,priority:'urgent',created_at:hoursAgo(3)}),t({id:2,priority:'urgent',created_at:hoursAgo(10)})],NOW);
  assert.strictEqual(q[0].id,2); console.log('PASS: oldest breach wins tie');
}
{
  const q=buildQueue([t({id:1,priority:'normal',status:'resolved',created_at:hoursAgo(48)})],NOW);
  assert.strictEqual(q[0].is_overdue,false); console.log('PASS: resolved ticket is not overdue');
}
{
  const q=buildQueue([t({id:1,priority:'normal',created_at:hoursAgo(20)}),t({id:2,priority:'normal',created_at:hoursAgo(10)})],NOW);
  assert.strictEqual(q[0].id,1); console.log('PASS: earliest deadline wins within same bucket');
}
console.log('\nAll queue ordering tests passed.');
