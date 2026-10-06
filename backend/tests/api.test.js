/**
 * End-to-end API test against an in-memory MongoDB.
 * Uses MONGOMS_SYSTEM_BINARY if set, otherwise mongodb-memory-server downloads a binary.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const { connectDB } = require('../src/config/db');

let mongo;
const api = (token) => {
  const wrap = (method) => (url, body) => {
    let r = request(app)[method](`/api${url}`);
    if (token) r = r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), del: wrap('delete') };
};

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});
test.after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('full monthly flow', async (t) => {
  const anon = api();
  let res = await anon.post('/auth/register', { name: 'Rahim', email: 'rahim@example.com', password: 'password123' });
  assert.equal(res.status, 201, res.text);
  const admin = api(res.body.token);
  assert.equal(res.body.user.passwordHash, undefined);

  res = await anon.post('/auth/login', { email: 'rahim@example.com', password: 'wrong-pass' });
  assert.equal(res.status, 401);

  res = await admin.post('/households', { name: 'Bachelor House', type: 'mess' });
  assert.equal(res.status, 201, res.text);
  const hid = res.body.household._id;

  res = await admin.get(`/households/${hid}/categories`);
  assert.ok(res.body.categories.length > 20);

  res = await admin.post(`/households/${hid}/months`, { year: 2026, month: 10, startingBalance: 0, budget: { food: 1000 } });
  assert.equal(res.status, 201, res.text);
  const mid = res.body.month._id;
  res = await admin.post(`/households/${hid}/months`, { year: 2026, month: 10 });
  assert.equal(res.status, 409);

  // Creator was added as the admin member automatically.
  res = await admin.get(`/months/${mid}/members`);
  assert.equal(res.body.items.length, 1);
  const rahimId = res.body.items[0]._id;

  res = await admin.post(`/months/${mid}/members`, { fullName: 'Karim', email: 'karim@example.com' });
  assert.equal(res.status, 201, res.text);
  const karimId = res.body.item._id;
  res = await admin.post(`/months/${mid}/members`, { fullName: 'Sakib', joinDate: '2026-10-17' });
  const sakibId = res.body.item._id;

  // Karim registers later and gets access through the invite.
  res = await anon.post('/auth/register', { name: 'Karim', email: 'karim@example.com', password: 'password123' });
  const karim = api(res.body.token);
  res = await karim.get(`/months/${mid}`);
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body.role, 'member');
  assert.equal(res.body.selfMember._id, karimId);

  await t.test('meals: quick entry, validation, copy', async () => {
    res = await admin.post(`/months/${mid}/meals/quick`, { date: '2026-10-05', members: [rahimId, karimId], mealTypes: ['lunch', 'dinner'], value: 1 });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.changed, 2);
    // Sakib has not joined yet on the 5th.
    res = await admin.post(`/months/${mid}/meals/quick`, { date: '2026-10-05', members: [sakibId], mealTypes: ['lunch'], value: 1 });
    assert.equal(res.status, 400);
    res = await admin.put(`/months/${mid}/meals/day/2026-10-05`, { entries: [{ member: rahimId, counts: { breakfast: -1 } }] });
    assert.equal(res.status, 400);
    res = await admin.put(`/months/${mid}/meals/day/2026-11-01`, { entries: [] });
    assert.equal(res.status, 400);
    res = await admin.post(`/months/${mid}/meals/copy`, { from: '2026-10-05', to: '2026-10-06' });
    assert.equal(res.body.changed, 2);
    // A member can't record meals for someone else by default.
    res = await karim.put(`/months/${mid}/meals/day/2026-10-07`, { entries: [{ member: rahimId, counts: { lunch: 1 } }] });
    assert.equal(res.status, 403);
    res = await karim.put(`/months/${mid}/meals/day/2026-10-07`, { entries: [{ member: karimId, counts: { lunch: 1, breakfast: 1 } }] });
    assert.equal(res.status, 200, res.text);
    res = await admin.get(`/months/${mid}/meals/day/2026-10-07`);
    assert.equal(res.body.rows.length, 2); // Sakib not present yet
  });

  await t.test('bazar, expenses, deposits', async () => {
    res = await karim.post(`/months/${mid}/bazar`, { date: '2026-10-05', itemName: 'Rice', category: 'rice', quantity: 10, unit: 'kg', unitPrice: 70 });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.item.totalPrice, 700);
    assert.equal(res.body.item.category, 'Rice');
    assert.equal(res.body.item.purchasers[0].member, karimId);
    res = await admin.post(`/months/${mid}/bazar`, { date: '2026-10-06', itemName: 'Chicken', category: 'Chicken', totalPrice: 300, purchasers: [{ member: rahimId, amount: 200 }, { member: karimId, amount: 50 }] });
    assert.equal(res.status, 400); // split doesn't add up
    res = await admin.post(`/months/${mid}/bazar`, { date: '2026-10-06', itemName: 'Chicken', category: 'Chicken', totalPrice: 300, paidFrom: 'fund' });
    assert.equal(res.status, 201, res.text);
    const chickenId = res.body.item._id;
    res = await admin.post(`/months/${mid}/bazar`, { date: '2026-10-06', itemName: 'Oil', category: 'Oil', totalPrice: -5 });
    assert.equal(res.status, 400);
    res = await admin.post(`/months/${mid}/bazar`, { date: '2026-10-06', itemName: 'x', category: 'Nope', totalPrice: 5 });
    assert.equal(res.status, 400);

    res = await karim.post(`/months/${mid}/expenses`, { date: '2026-10-05', title: 'Internet', category: 'Internet', amount: 900 });
    assert.equal(res.status, 403); // members can't add general expenses
    res = await admin.post(`/months/${mid}/expenses`, { date: '2026-10-05', title: 'Internet', category: 'Internet', amount: 900, recurring: true });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.item.expenseType, 'utility');

    res = await karim.post(`/months/${mid}/contributions`, { date: '2026-10-01', member: rahimId, amount: 100 });
    assert.equal(res.status, 403);
    res = await karim.post(`/months/${mid}/contributions`, { date: '2026-10-01', member: karimId, amount: 1000, paymentMethod: 'bkash', reference: 'TX1' });
    assert.equal(res.status, 201, res.text);
    res = await admin.post(`/months/${mid}/contributions`, { date: '2026-10-01', member: rahimId, amount: 2000 });
    assert.equal(res.status, 201);

    // Member edits are off by default.
    res = await karim.del(`/months/${mid}/bazar/${chickenId}`);
    assert.equal(res.status, 403);

    res = await admin.get(`/months/${mid}/bazar?q=ric&sort=highest`);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].purchasers[0].member.fullName, 'Karim');
    res = await admin.get(`/months/${mid}/bazar?minAmount=500`);
    assert.equal(res.body.total, 1);
    res = await admin.get(`/months/${mid}/bazar?sort=bogus`);
    assert.equal(res.status, 400);

    // Soft delete and restore.
    res = await admin.del(`/months/${mid}/bazar/${chickenId}`);
    assert.equal(res.status, 200);
    res = await admin.get(`/months/${mid}/trash`);
    assert.equal(res.body.items.length, 1);
    res = await admin.post(`/months/${mid}/bazar/${chickenId}/restore`);
    assert.equal(res.status, 200);
  });

  await t.test('guests, shopping list conversion', async () => {
    res = await admin.post(`/months/${mid}/guests`, { host: rahimId, guestName: 'Cousin', date: '2026-10-06', mealType: 'dinner', count: 1 });
    assert.equal(res.status, 201, res.text);
    res = await karim.post(`/months/${mid}/shopping-list`, { item: 'Eggs', quantity: 12, unit: 'pcs', priority: 'high', estimatedPrice: 150 });
    assert.equal(res.status, 201, res.text);
    const sid = res.body.item._id;
    res = await karim.post(`/months/${mid}/shopping-list/${sid}/convert`, { date: '2026-10-06', totalPrice: 160, category: 'Eggs' });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.item.status, 'purchased');
    assert.equal(res.body.bazarItem.totalPrice, 160);
    res = await karim.post(`/months/${mid}/shopping-list/${sid}/convert`, { date: '2026-10-06', totalPrice: 160 });
    assert.equal(res.status, 409);
  });

  await t.test('calculation, dashboard, reports', async () => {
    res = await admin.get(`/months/${mid}/calculation`);
    assert.equal(res.status, 200);
    const c = res.body;
    // Meals: Rahim 2+2 + 1 guest = 5, Karim 2+2+2 = 6 → 11. Food: 700 + 300 + 160 = 1160.
    assert.equal(c.totals.totalMeals, 11);
    assert.equal(c.totals.food, 1160);
    assert.equal(c.totals.mealRate, 105.45);
    const rahim = c.members.find((m) => m.id === rahimId);
    assert.equal(rahim.meals, 5);
    assert.equal(rahim.mealCost, Math.round(5 * 105.45));
    // Internet 900 split equally among 3 members present this month.
    assert.equal(rahim.sharedTotal, 300);
    assert.ok(c.budget.find((b) => b.label === 'Food').level >= 100);

    res = await admin.get(`/months/${mid}/dashboard`);
    assert.equal(res.status, 200);
    assert.equal(res.body.recentBazar.length, 3);
    assert.equal(res.body.trend.length, 1);

    res = await admin.get(`/months/${mid}/daily/2026-10-06`);
    assert.equal(res.body.bazar.length, 2);
    assert.equal(res.body.guests.length, 1);

    res = await admin.get(`/months/${mid}/reports`);
    assert.equal(res.status, 200);
    assert.equal(res.body.bazar.byPurchaser.find((p) => p.name === 'Karim').amount, 860);
    res = await admin.get(`/months/${mid}/reports/export.csv?section=settlement`);
    assert.equal(res.status, 200);
    assert.match(res.text, /Rahim/);

    res = await admin.get(`/months/${mid}/notifications`);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((n) => n.type === 'budget'));
    const key = res.body.items.find((n) => n.type === 'budget').key;
    await admin.post(`/months/${mid}/notifications/dismiss`, { keys: [key] });
    res = await admin.get(`/months/${mid}/notifications`);
    assert.ok(!res.body.items.some((n) => n.key === key));
  });

  await t.test('settings change recalculates (weighted meals)', async () => {
    res = await admin.patch(`/months/${mid}`, {
      mealTypes: [
        { key: 'breakfast', label: 'Breakfast', weight: 0.5, order: 0 },
        { key: 'lunch', label: 'Lunch', weight: 1, order: 1 },
        { key: 'dinner', label: 'Dinner', weight: 1, order: 2 },
      ],
      settings: { mealMode: 'weighted', distribution: { utility: { method: 'percentage', shares: { [rahimId]: 50, [karimId]: 50 } } } },
    });
    assert.equal(res.status, 200, res.text);
    res = await admin.get(`/months/${mid}/calculation`);
    assert.equal(res.body.totals.totalMeals, 10.5);
    assert.equal(res.body.members.find((m) => m.id === sakibId).sharedTotal, 0);
    assert.equal(res.body.members.find((m) => m.id === karimId).sharedByType.utility, 450);
    res = await karim.patch(`/months/${mid}`, { name: 'hack' });
    assert.equal(res.status, 403);
  });

  await t.test('closing locks the month; next month carries balances', async () => {
    res = await admin.get(`/months/${mid}/close-preview`);
    assert.equal(res.status, 200);
    const prevCalc = (await admin.get(`/months/${mid}/calculation`)).body;
    res = await admin.post(`/months/${mid}/close`);
    assert.equal(res.status, 200);
    res = await admin.post(`/months/${mid}/bazar`, { date: '2026-10-08', itemName: 'Late', category: 'Rice', totalPrice: 10 });
    assert.equal(res.status, 423);
    res = await karim.post(`/months/${mid}/reopen`);
    assert.equal(res.status, 403);

    res = await admin.post(`/households/${hid}/months`, { year: 2026, month: 11 });
    assert.equal(res.status, 201, res.text);
    const nov = res.body.month;
    assert.equal(nov.carryBalance, prevCalc.totals.cashInHand);
    assert.equal(nov.settings.mealMode, 'weighted');
    res = await admin.get(`/months/${nov._id}/members`);
    assert.equal(res.body.items.length, 3);
    const novKarim = res.body.items.find((m) => m.fullName === 'Karim');
    assert.equal(novKarim.openingBalance, prevCalc.members.find((m) => m.id === karimId).balance);
    assert.equal(String(novKarim.user), String((await karim.get('/auth/me')).body.user._id));
    res = await admin.get(`/months/${nov._id}`);
    const shares = res.body.month.settings.distribution.utility.shares;
    assert.equal(shares[novKarim._id], 50);
    res = await admin.get(`/months/${nov._id}/expenses/recurring`);
    assert.equal(res.body.items[0].title, 'Internet');

    // October is untouched and still closed.
    res = await admin.get(`/months/${mid}`);
    assert.equal(res.body.month.status, 'closed');
    res = await admin.get(`/households/${hid}/history`);
    assert.equal(res.body.history.length, 2);

    res = await admin.post(`/months/${mid}/reopen`);
    assert.equal(res.status, 200);
    res = await admin.get(`/households/${hid}/audit`);
    assert.ok(res.body.items.some((a) => a.action === 'close'));
    assert.ok(res.body.items.some((a) => /Karim added bazar "Rice" ৳700/.test(a.summary)));
  });

  await t.test('auth: password change invalidates old tokens; reset flow', async () => {
    res = await anon.post('/auth/forgot-password', { email: 'karim@example.com' });
    const token = new URL(res.body.devResetUrl).searchParams.get('token');
    await new Promise((r) => setTimeout(r, 1100));
    res = await anon.post('/auth/reset-password', { token, password: 'newpassword1' });
    assert.equal(res.status, 200, res.text);
    res = await karim.get('/auth/me');
    assert.equal(res.status, 401);
    res = await anon.post('/auth/login', { email: 'karim@example.com', password: 'newpassword1' });
    assert.equal(res.status, 200);
    res = await anon.post('/auth/reset-password', { token, password: 'another-pass' });
    assert.equal(res.status, 400);
  });
});
