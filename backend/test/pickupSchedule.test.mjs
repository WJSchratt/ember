import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingOccurrences, isValidOccurrence, addDays } from '../src/pickup/schedule.js';

const tue = { id: 1, active: true, recurring: true, day_of_week: 2, start_time: '18:00' };
// 2026-11-17 is a Tuesday.
test('recurring Tuesday expands to the next Tuesdays', () => {
  const occ = upcomingOccurrences([tue], { days: 21, now: { date: '2026-11-18', time: '09:00' } });
  assert.deepEqual(occ.map((o) => o.date), ['2026-11-24', '2026-12-01', '2026-12-08']);
});
test('game day stays open until 2h after kickoff', () => {
  assert.equal(isValidOccurrence(tue, '2026-11-17', { date: '2026-11-17', time: '19:59' }), true);
  assert.equal(isValidOccurrence(tue, '2026-11-17', { date: '2026-11-17', time: '20:00' }), false);
  assert.equal(isValidOccurrence(tue, '2026-11-18', { date: '2026-11-17', time: '10:00' }), false);
});
test('one-off and inactive games', () => {
  const one = { id: 2, active: true, recurring: false, game_date: '2026-11-21', start_time: '10:00' };
  const off = { ...tue, active: false };
  const occ = upcomingOccurrences([one, off], { days: 28, now: { date: '2026-11-18', time: '09:00' } });
  assert.deepEqual(occ.map((o) => o.date), ['2026-11-21']);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
