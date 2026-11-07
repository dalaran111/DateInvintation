const moscowDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** @param {Date} [now] */
export function getMoscowDay(now = new Date()) {
  const parts = moscowDate.formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** @param {Date} [now] @param {number} [count] */
export function getDateOptions(now = new Date(), count = 6) {
  const today = getMoscowDay(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${today}T12:00:00+03:00`);
    date.setUTCDate(date.getUTCDate() + index + 1);
    return getMoscowDay(date);
  });
}

/** @param {string} value @param {Intl.DateTimeFormatOptions} [options] */
export function formatDay(value, options = { day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'Europe/Moscow' })
    .format(new Date(`${value}T12:00:00+03:00`));
}

/** @param {string} date @param {string} time @param {Date} [now] */
export function isFutureDate(date, time, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const candidate = new Date(`${date}T${time}:00+03:00`);
  return Number.isFinite(candidate.getTime()) && getMoscowDay(candidate) === date && candidate > now;
}

/** @param {string} value */
export function escapeIcs(value) {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// Fold at the RFC 5545 byte limit, including Cyrillic UTF-8 characters.
/** @param {string} line */
function foldIcsLine(line) {
  const encoder = new TextEncoder();
  let result = '';
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      result += current + '\r\n';
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  return result + current;
}

/** @param {{date: string, time: string, activity: string, location: string, coordinates?: {lat: number, lng: number}}} plan @param {Date} [now] */
export function buildCalendar(plan, now = new Date()) {
  if (!isFutureDate(plan.date, plan.time, now)) throw new Error('Выбери будущую дату и время.');
  const start = new Date(`${plan.date}T${plan.time}:00+03:00`);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Date Invitation//Our Evening//RU',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:date-${plan.date}-${plan.time.replace(':', '')}@invitation.local`,
    `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs('Один вечер. Только мы.')}`,
    `LOCATION:${escapeIcs(plan.location)}`,
    ...(plan.coordinates ? [`GEO:${plan.coordinates.lat.toFixed(6)};${plan.coordinates.lng.toFixed(6)}`] : []),
    `DESCRIPTION:${escapeIcs(`${plan.activity}\nСанкт-Петербург. Время московское.\nДо встречи ♡`)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldIcsLine).join('\r\n');
}

/** @param {{date: string, time: string, activity: string, location: string, coordinates?: {lat: number, lng: number}}} plan */
export function buildReply(plan) {
  const point = plan.coordinates;
  const map = point ? `\nhttps://yandex.ru/maps/?ll=${point.lng.toFixed(6)},${point.lat.toFixed(6)}&z=17&pt=${point.lng.toFixed(6)},${point.lat.toFixed(6)},pm2rdm` : '';
  return `У нас свидание ♡\n${formatDay(plan.date)}, ${plan.time} (МСК)\n${plan.activity}\n${plan.location}${map}\nДо встречи!`;
}

/** @param {string} query */
export function mapUrl(query) {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`Санкт-Петербург, ${query}`)}`;
}
