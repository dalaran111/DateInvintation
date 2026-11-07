import { buildReply, formatDay } from './date-utils.mjs';

export const EMAIL_ENDPOINT = 'https://shipmyform.com/f/frm_AEx7s1PNBifjsKpdN49X';

/** @param {{date: string, time: string, activity: string, location: string, coordinates?: {lat: number, lng: number}}} details */
export function emailFields(details) {
  return {
    _subject: 'Поля сказала «да» — у нас свидание ♡',
    _gotcha: '',
    'Ответ': 'Да. У нас свидание ♡',
    'Дата': formatDay(details.date),
    'Время': details.time + ' (МСК)',
    'Занятие': details.activity,
    'Место': details.location,
    ...(details.coordinates ? {
      'Карта': `https://yandex.ru/maps/?ll=${details.coordinates.lng},${details.coordinates.lat}&z=17&pt=${details.coordinates.lng},${details.coordinates.lat},pm2rdm`,
    } : {}),
    message: buildReply(details),
  };
}

/** @param {Parameters<typeof emailFields>[0]} details @param {{request?: typeof fetch, signal?: AbortSignal}} [options] */
export async function sendEmailReply(details, options = {}) {
  const body = new FormData();
  for (const [name, value] of Object.entries(emailFields(details))) body.append(name, value);
  const response = await (options.request ?? fetch)(EMAIL_ENDPOINT, {
    method: 'POST', headers: { Accept: 'application/json' }, body,
    signal: options.signal ?? AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error('Не удалось отправить билет. Попробуй ещё раз.');
  const result = await response.json();
  if (result.ok !== true) {
    throw new Error('Не удалось отправить билет. Попробуй ещё раз.');
  }
}
