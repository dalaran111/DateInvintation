export const INVITATION_DATE = '2026-11-08';
export const TIME_OPTIONS = Array.from({ length: 11 }, (_, index) => `${17 + Math.floor(index / 2)}:${index % 2 ? '30' : '00'}`);
export const ACTIVITY_OPTIONS = ['cinema', 'dinner', 'custom'];
export const CITY_BOUNDS = { south: 59.65, north: 60.2, west: 29.4, east: 30.9 };

/** @param {unknown} candidate */
export function normalizePoint(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const point = /** @type {{lat?: unknown, lng?: unknown, label?: unknown}} */ (candidate);
  if (typeof point.lat !== 'number' || typeof point.lng !== 'number' || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  if (point.lat < CITY_BOUNDS.south || point.lat > CITY_BOUNDS.north || point.lng < CITY_BOUNDS.west || point.lng > CITY_BOUNDS.east) return null;
  return { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)), label: typeof point.label === 'string' ? point.label.slice(0, 100) : '' };
}

/** @param {{activity: string, customActivity: string}} plan */
export function activityTitle(plan) {
  if (plan.activity === 'cinema') return 'Пойдём в кино';
  if (plan.activity === 'dinner') return 'Покушаем вкусно';
  return plan.customActivity.trim();
}

/** @param {{lat: number, lng: number}} point */
export function pointUrl(point) {
  const position = `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
  return `https://yandex.ru/maps/?ll=${position}&z=17&pt=${position},pm2rdm`;
}

/** @param {{lat: number, lng: number, label?: string}} point */
export function pointDescription(point) {
  return `${point.label?.trim() || 'Наша точка встречи'} · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
