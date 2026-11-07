import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, buildReply, getDateOptions, getMoscowDay, isFutureDate, mapUrl } from '../src/date-utils.mjs';
import { INVITATION_DATE, TIME_OPTIONS, normalizePoint, activityTitle, pointUrl, pointDescription } from '../src/plan-utils.mjs';

test('date choices use the Moscow day across UTC midnight and month boundaries', () => {
  const now = new Date('2026-12-31T22:30:00Z');
  assert.equal(getMoscowDay(now), '2027-01-01');
  assert.deepEqual(getDateOptions(now, 2), ['2027-01-02', '2027-01-03']);
});

test('past and impossible dates are rejected', () => {
  const now = new Date('2026-11-07T16:00:00Z');
  assert.equal(isFutureDate('2026-11-07', '18:00', now), false);
  assert.equal(isFutureDate('2026-11-07', '20:00', now), true);
  assert.equal(isFutureDate('2027-02-30', '18:00', now), false);
  assert.equal(isFutureDate('invalid', '18:00', now), false);
});

test('calendar export uses Moscow time, escapes user input and folds UTF-8 lines', () => {
  const ics = buildCalendar({ date: '2026-11-09', time: '18:00', activity: 'Кофе и разговоры', location: 'Кафе; Мойка, 2\nEND:VEVENT\n' + 'Очень красивое название '.repeat(8) }, new Date('2026-11-07T10:00:00Z'));
  assert.ok(ics.includes('DTSTART:20261109T150000Z'));
  assert.ok(ics.includes('DTEND:20261109T170000Z'));
  assert.ok(ics.replace(/\r\n /g, '').includes('LOCATION:Кафе\\; Мойка\\, 2\\nEND:VEVENT\\n'));
  assert.equal(ics.split('\r\n').filter((line) => line === 'END:VEVENT').length, 1);
  assert.ok(ics.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75));
});

test('expired plans cannot become calendar events', () => {
  assert.throws(() => buildCalendar({ date: '2026-01-01', time: '18:00', activity: 'Кофе', location: 'Петербург' }, new Date('2026-11-07')), /будущую дату/);
});

test('reply states the timezone and maps safely encode custom places', () => {
  assert.ok(buildReply({ date: '2026-11-09', time: '18:00', activity: 'Кофе', location: 'Новая Голландия' }).includes('18:00 (МСК)'));
  const url = new URL(mapUrl('Кафе & мост? #1'));
  assert.equal(url.origin, 'https://yandex.ru');
  assert.equal(url.searchParams.get('text'), 'Санкт-Петербург, Кафе & мост? #1');
  assert.equal(url.hash, '');
});

test('the invitation stays on November 8 and time choices begin at 17:00', () => {
  assert.equal(INVITATION_DATE, '2026-11-08');
  assert.equal(TIME_OPTIONS[0], '17:00');
  assert.equal(TIME_OPTIONS.at(-1), '22:00');
  assert.equal(TIME_OPTIONS.length, 11);
  assert.ok(!TIME_OPTIONS.includes('16:00'));
});

test('map selections reject malformed and out-of-city coordinates', () => {
  assert.equal(normalizePoint({ lat: NaN, lng: 30 }), null);
  assert.equal(normalizePoint({ lat: '59.9', lng: 30.3 }), null);
  assert.equal(normalizePoint({ lat: 55.75, lng: 37.61 }), null);
  assert.equal(normalizePoint(null), null);
  assert.deepEqual(normalizePoint({ lat: 59.9343004, lng: 30.3158002, label: 'У моста' }), { lat: 59.9343, lng: 30.3158, label: 'У моста' });
});

test('a selected point appears unchanged in both the calendar and shareable answer', () => {
  const coordinates = { lat: 59.9343, lng: 30.3158, label: 'У моста' };
  const plan = { date: INVITATION_DATE, time: '17:30', activity: 'Пойдём в кино', location: pointDescription(coordinates), coordinates };
  const ics = buildCalendar(plan, new Date('2026-11-07T10:00:00Z'));
  assert.ok(ics.includes('GEO:59.934300;30.315800'));
  assert.ok(ics.includes('DTSTART:20261108T143000Z'));
  const reply = buildReply(plan);
  assert.ok(reply.includes('У моста · 59.93430, 30.31580'));
  assert.ok(reply.includes(pointUrl(coordinates)));
});

test('custom activities and labels are preserved as plain user text', () => {
  assert.equal(activityTitle({ activity: 'custom', customActivity: '  Боулинг и какао  ' }), 'Боулинг и какао');
  assert.equal(activityTitle({ activity: 'cinema', customActivity: 'ignored' }), 'Пойдём в кино');
  assert.equal(activityTitle({ activity: 'dinner', customActivity: '' }), 'Покушаем вкусно');
  assert.equal(normalizePoint({ lat: 59.93, lng: 30.3, label: 'Я'.repeat(200) })?.label.length, 100);
});
