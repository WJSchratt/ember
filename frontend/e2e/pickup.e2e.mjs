// End-to-end check of the McGuire Fields pickup flow at phone size (390x844).
//   BASE_URL=http://localhost:5173 ADMIN_PASSCODE=... node e2e/pickup.e2e.mjs
// Optional: CHROMIUM_PATH to reuse an already-installed Chromium.
// MODE=legacy instead checks that the full Tether app is back (flags off).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const PASS = process.env.ADMIN_PASSCODE || '';
const SHOTS = path.resolve(process.env.SHOTS_DIR || 'e2e/screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
const shot = (name, full = true) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
const step = (s) => console.log(`- ${s}`);

if (process.env.MODE === 'legacy') {
  await page.goto(BASE);
  await page.waitForURL(/\/login/);
  await page.getByRole('button', { name: /log in|sign in/i }).waitFor();
  step('flag off: / redirects to legacy login');
  await shot('legacy-01-login', false);
  await page.fill('input[type=email]', 'alice@test.dev');
  await page.fill('input[type=password]', 'password123');
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.locator('.bottomnav').waitFor();
  await page.locator('.room-card-head').first().waitFor({ timeout: 30000 });
  step('flag off: legacy login works, rooms feed + bottom nav back');
  await shot('legacy-02-home', false);
  await browser.close();
  process.exit(0);
}

// ---- home
await page.goto(BASE);
await page.getByRole('heading', { name: 'Pickup Soccer' }).waitFor();
const days = page.locator('article.pk-day');
await days.first().waitFor();
assert.ok((await days.count()) >= 3, 'shows the next few dates');
assert.equal(await page.locator('.bottomnav').count(), 0, 'no legacy nav');
step(`home shows ${await days.count()} game days, no legacy nav`);
await shot('01-home');

// Use the second upcoming date so the test does not depend on today's game.
const day = days.nth(1);
const date = await day.getAttribute('data-date');
const countOf = async (d) => Number(await d.locator('.pk-count .num').innerText());
const before = await countOf(day);

// ---- waiver is required
await day.getByRole('button', { name: /I.m in/ }).click();
await day.getByLabel('Your name').fill('Riley Tester');
await day.getByLabel(/Phone or email/).fill('555-0100');
const submit = day.getByRole('button', { name: /Count me in/ });
assert.equal(await submit.isDisabled(), true, 'submit disabled until waiver checked');
await shot('02-form-waiver-unchecked', false);
const apiNoWaiver = await page.request.post(`${BASE}/api/pickup/rsvps`, {
  data: { gameId: 1, date, name: 'Sneaky' },
});
assert.equal(apiNoWaiver.status(), 400, 'API rejects RSVP without waiver');
step('waiver required (button disabled + API 400)');

// ---- RSVP
await day.locator('.pk-waiver input').check();
await submit.click();
await day.getByText('You’re in').waitFor();
assert.equal(await countOf(day), before + 1, 'headcount +1');
assert.ok(await day.locator('.pk-name.me', { hasText: 'Riley' }).isVisible(), 'first name listed');
assert.equal(await day.locator('.pk-name', { hasText: 'Tester' }).count(), 0, 'last name not shown');
step(`RSVP for ${date}: count ${before} -> ${before + 1}, first name only shown`);
await shot('03-rsvped');

// survives reload (token in localStorage)
await page.reload();
await page.locator(`article[data-date="${date}"]`).getByText('You’re in').waitFor();
step('RSVP persists across reload via localStorage token');

// ---- cancel
const day2 = page.locator(`article[data-date="${date}"]`);
await day2.getByRole('button', { name: 'Cancel my spot' }).click();
await day2.getByRole('button', { name: /I.m in/ }).waitFor();
assert.equal(await countOf(day2), before, 'headcount back');
step('cancel my spot: count restored');

// ---- privacy
await page.getByRole('link', { name: 'Privacy' }).first().click();
await page.getByRole('heading', { name: 'Privacy' }).waitFor();
step('privacy page');
await shot('04-privacy');

// ---- admin
await page.goto(`${BASE}/admin`);
await page.fill('#pc', 'wrong-passcode');
await page.getByRole('button', { name: 'Unlock' }).click();
await page.getByText('Wrong passcode.').waitFor();
step('admin rejects wrong passcode');
await page.fill('#pc', PASS);
await page.getByRole('button', { name: 'Unlock' }).click();
const g1 = page.getByTestId('game-1');
await g1.waitFor();
await shot('05-admin');

// edit: time -> 18:30, note
await g1.getByLabel('Time').fill('18:30');
await g1.getByLabel('Note').fill('Meet by the north goal');
await g1.getByRole('button', { name: 'Save' }).click();
await page.waitForResponse((r) => r.url().includes('/admin/games') && r.request().method() === 'GET');
// cancel a date with a note
const adminDay = page.locator(`.pk-day[data-date="${date}"]`);
await adminDay.getByLabel('Date note').fill('rained out');
await adminDay.getByRole('button', { name: 'Cancel this date' }).click();
await adminDay.getByRole('button', { name: 'Restore date' }).waitFor();
// add a one-off Saturday game
const gamesBefore = await page.locator('[data-testid^="game-"]').count();
const nw = page.getByTestId('new-game');
await nw.locator('.pk-inline input').uncheck();
const sat = await page.evaluate(() => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
});
await nw.getByLabel('Date').fill(sat);
await nw.getByLabel('Time').fill('10:00');
await nw.getByLabel('Title').fill('Saturday Morning Pickup');
await nw.getByRole('button', { name: 'Add game' }).click();
await page.locator('[data-testid^="game-"]').nth(gamesBefore).waitFor();
step(`admin: time edited, ${date} cancelled ("rained out"), one-off ${sat} added`);
await shot('06-admin-edited');

// public page reflects admin edits
await page.goto(BASE);
const pubDay = page.locator(`article[data-date="${date}"]`);
await pubDay.waitFor();
assert.ok(await pubDay.getByText('Cancelled: rained out').isVisible(), 'cancelled banner');
assert.equal(await pubDay.getByRole('button', { name: /I.m in/ }).count(), 0, 'no RSVP on cancelled date');
assert.ok(await page.getByText('6:30 PM').first().isVisible(), 'new time shown');
assert.ok(await page.getByText('Meet by the north goal').first().isVisible(), 'game note shown');
assert.ok(await page.locator(`article[data-date="${sat}"]`).isVisible(), 'one-off game listed');
step('public page shows new time, note, rained-out date, one-off game');
await shot('07-home-after-admin');

// ---- QR + sign
await page.goto(`${BASE}/qr`);
await page.locator('.pk-qr-img').waitFor();
await shot('08-qr', false);
await page.setViewportSize({ width: 816, height: 1056 });
await page.goto(`${BASE}/sign`);
await page.locator('.pk-sign-qr').waitFor();
await shot('09-sign');
step('QR page + printable sign render');

// ---- restore the seeded schedule so the run is repeatable
const H = { 'x-admin-passcode': PASS };
await page.request.patch(`${BASE}/api/pickup/admin/games/1`, { headers: H, data: { startTime: '18:00', note: '' } });
await page.request.put(`${BASE}/api/pickup/admin/games/1/dates/${date}`, { headers: H, data: { cancelled: false } });
const all = await (await page.request.get(`${BASE}/api/pickup/admin/games`, { headers: H })).json();
for (const g of all.games.filter((g) => g.id !== 1 && g.active)) {
  await page.request.patch(`${BASE}/api/pickup/admin/games/${g.id}`, { headers: H, data: { active: false } });
}
step('restored seed schedule');

await browser.close();
console.log('ALL PICKUP CHECKS PASSED');
