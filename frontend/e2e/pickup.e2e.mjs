// End-to-end check of Tether's pickup pages at phone size (390x844):
// Tether home (/) -> McGuire Fields sheet (/pickup/mcguire) -> RSVP/cancel,
// waiver, privacy, admin edits, QR + sign.
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
const SHEET = '/pickup/mcguire';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
const shot = async (name, full = true) => {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
};
const step = (s) => console.log(`- ${s}`);
const H = { 'x-admin-passcode': PASS };

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

// ---- sample sign-ups on the next date's two slots so screenshots look like a
// real week (removed again at the end with their own tokens). A contact value
// is sent on purpose to prove the server ignores it.
const seeded = [];
{
  const g = await (await page.request.get(`${BASE}/api/pickup/games`)).json();
  const nextDate = g.occurrences.find((o) => !o.cancelled).date;
  const sample = { '18:00': ['Marco', 'Dana K', 'Theo', 'Priya', 'Sam', 'Jo'], '19:30': ['Luis', 'Kenji', 'Abby'] };
  for (const o of g.occurrences.filter((x) => x.date === nextDate)) {
    for (const name of sample[o.startTime] || []) {
      const r = await page.request.post(`${BASE}/api/pickup/rsvps`, {
        data: { gameId: o.gameId, date: o.date, name, contact: 'ignored@example.com', waiverAccepted: true },
      });
      seeded.push(await r.json());
    }
  }
}

let date = null;
try {
  // ---- Tether home (/): just the pickup games, linking to the McGuire sheet
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Pickup games' }).waitFor();
  assert.ok(await page.getByRole('link', { name: 'Tether home' }).isVisible(), 'Tether brand in shell');
  const place = page.getByTestId('place-mcguire');
  await place.getByText('Tuesdays, 6 PM and 7:30 PM').waitFor();
  assert.equal(await place.locator('.pk-place-next li').count(), 2, 'two Tuesday slots on next date');
  assert.equal(await page.locator('.bottomnav').count(), 0, 'no legacy nav');
  step('Tether home lists McGuire Fields (Tuesdays 6 PM and 7:30 PM) in the Tether shell, no legacy nav');
  await shot('00-tether-home');
  await place.getByRole('link', { name: /sign up/i }).click();
  await page.waitForURL(`**${SHEET}`);

  // ---- McGuire sheet
  await page.getByRole('heading', { name: /Pickup Soccer/ }).waitFor();
  const slots = page.locator('article.pk-day');
  await slots.first().waitFor();
  assert.equal(await page.locator('.pk-next article.pk-day.featured').count(), 2, 'next date shows both slots');
  assert.ok((await slots.count()) >= 6, 'next few dates x 2 slots');
  assert.ok((await page.locator('.pk-day.featured .pk-sheet li').count()) >= 12, 'numbered sign-up sheets');
  assert.ok(
    await page.getByRole('link', { name: /More pickup games and groups on Tether/ }).isVisible(),
    'low-key link into Tether'
  );
  step(`${SHEET}: ${await slots.count()} slots, next date featured with 2 sign-up sheets, link into Tether`);
  await shot('01-mcguire');

  // Use the 6 PM slot on the second date so the test does not depend on today.
  date = await page.locator('.pk-later-day').first().locator('article.pk-day').first().getAttribute('data-date');
  const slot = (time) => page.locator(`article[data-slot="${date}T${time}"]`);
  const countOf = async (d) => Number(await d.locator('.pk-count .num').innerText());
  const before = await countOf(slot('18:00'));

  // ---- name only + waiver is required
  await slot('18:00').getByRole('button', { name: /I.m in/ }).click();
  await slot('18:00').getByLabel('Your name').fill('Riley Tester');
  assert.equal(await page.getByLabel(/phone|email/i).count(), 0, 'no phone/email field');
  const submit = slot('18:00').getByRole('button', { name: /Count me in/ });
  assert.equal(await submit.isDisabled(), true, 'submit disabled until waiver checked');
  await shot('02-form-waiver-unchecked', false);
  const apiNoWaiver = await page.request.post(`${BASE}/api/pickup/rsvps`, { data: { gameId: 1, date, name: 'Sneaky' } });
  assert.equal(apiNoWaiver.status(), 400, 'API rejects RSVP without waiver');
  step('form asks for name only; waiver required (button disabled + API 400)');

  // ---- RSVP
  await slot('18:00').locator('.pk-waiver input').check();
  await submit.click();
  await slot('18:00').getByText('You’re in').waitFor();
  assert.equal(await countOf(slot('18:00')), before + 1, 'headcount +1');
  assert.ok(await slot('18:00').locator('.pk-name.me', { hasText: 'Riley' }).isVisible(), 'first name listed');
  assert.equal(await slot('18:00').locator('.pk-name', { hasText: 'Tester' }).count(), 0, 'last name not shown');
  assert.equal(await countOf(slot('19:30')), 0, 'other slot untouched');
  step(`RSVP for ${date} 6 PM: count ${before} -> ${before + 1}, first name only, 7:30 slot untouched`);
  await shot('03-rsvped');

  // survives reload (token in localStorage)
  await page.reload();
  await slot('18:00').getByText('You’re in').waitFor();
  step('RSVP persists across reload via localStorage token');

  // ---- cancel
  await slot('18:00').getByRole('button', { name: 'Cancel my spot' }).click();
  await slot('18:00').getByRole('button', { name: /I.m in/ }).waitFor();
  assert.equal(await countOf(slot('18:00')), before, 'headcount back');
  step('cancel my spot: count restored');

  // contact sent to the API is never stored
  {
    const adm = await (await page.request.get(`${BASE}/api/pickup/admin/games`, { headers: H })).json();
    const stored = adm.occurrences.flatMap((o) => o.players).filter((pl) => seeded.some((s) => s.id === pl.id));
    assert.ok(stored.length > 0 && stored.every((pl) => pl.contact === null), 'contact never stored');
    step('server ignores contact even if sent (stored as null)');
  }

  // ---- privacy
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await page.getByRole('heading', { name: 'Privacy' }).waitFor();
  assert.equal(await page.getByText(/if you gave one/i).count(), 0, 'privacy no longer describes collected contact');
  step('privacy page (name only)');
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

  // edit: 6 PM slot -> 6:30, with a note
  await g1.getByLabel('Time').fill('18:30');
  await g1.getByLabel('Note').fill('Meet by the north goal');
  await g1.getByRole('button', { name: 'Save' }).click();
  const adminDay = page.locator(`.pk-day[data-slot="${date}T18:30"]`);
  await adminDay.waitFor();
  // cancel that slot's date with a note
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
  step(`admin: 6 PM slot moved to 6:30, ${date} cancelled ("rained out"), one-off ${sat} added`);
  await shot('06-admin-edited');

  // public sheet reflects admin edits
  await page.goto(`${BASE}${SHEET}`);
  const pub = page.locator(`article[data-slot="${date}T18:30"]`);
  await pub.waitFor();
  assert.ok(await pub.getByText('Cancelled: rained out').isVisible(), 'cancelled banner');
  assert.equal(await pub.getByRole('button', { name: /I.m in/ }).count(), 0, 'no RSVP on cancelled slot');
  assert.equal(await slot('19:30').getByRole('button', { name: /I.m in/ }).count(), 1, '7:30 slot that day still open');
  assert.ok(await page.getByText('Meet by the north goal').first().isVisible(), 'game note shown');
  assert.ok(await page.locator(`article[data-date="${sat}"]`).first().isVisible(), 'one-off game listed');
  step('sheet shows 6:30 time, note, rained-out slot (7:30 still open), one-off game');
  await shot('07-mcguire-after-admin');

  // ---- QR + sign point at the McGuire sheet
  await page.goto(`${BASE}/qr`);
  await page.locator('.pk-qr-img').waitFor();
  assert.match(await page.locator('.pk-qr-img').getAttribute('alt'), /\/pickup\/mcguire$/);
  await shot('08-qr', false);
  await page.setViewportSize({ width: 816, height: 1056 });
  await page.goto(`${BASE}/sign`);
  await page.locator('.pk-sign-qr').waitFor();
  assert.match(await page.locator('.pk-sign-url').innerText(), /\/pickup\/mcguire$/);
  await shot('09-sign');
  await page.emulateMedia({ media: 'print' });
  await shot('10-sign-print');
  await page.emulateMedia({ media: 'screen' });
  step('QR page + printable sign render and point at /pickup/mcguire');
} finally {
  // ---- restore the seeded schedule so the run is repeatable
  await page.request.patch(`${BASE}/api/pickup/admin/games/1`, { headers: H, data: { startTime: '18:00', note: '' } });
  if (date) {
    await page.request.put(`${BASE}/api/pickup/admin/games/1/dates/${date}`, { headers: H, data: { cancelled: false } });
  }
  const all = await (await page.request.get(`${BASE}/api/pickup/admin/games`, { headers: H })).json();
  for (const g of all.games.filter((x) => x.title === 'Saturday Morning Pickup' && x.active)) {
    await page.request.patch(`${BASE}/api/pickup/admin/games/${g.id}`, { headers: H, data: { active: false } });
  }
  for (const s of seeded) {
    await page.request.delete(`${BASE}/api/pickup/rsvps/${s.id}`, { data: { cancelToken: s.cancelToken } });
  }
  step('restored seed schedule, removed sample sign-ups');
}

await browser.close();
console.log('ALL PICKUP CHECKS PASSED');
