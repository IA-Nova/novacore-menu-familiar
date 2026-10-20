export const TIME_ZONE = 'America/Mexico_City';
export const DEFAULT_ANCHOR_MONDAY = '2026-10-19'; // solo valor inicial editable al instalar, nunca regla fija de negocio
export const DEFAULT_DAY_TYPES = Object.freeze([
  'free', 'wish', 'free', 'wish', 'free', 'free', 'free',
  'wish', 'free', 'wish', 'free', 'wish', 'free', 'free',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateToEpochDay(isoDate) {
  if (typeof isoDate !== 'string' || !DATE_RE.test(isoDate)) {
    throw new Error('La fecha debe tener el formato YYYY-MM-DD.');
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const check = new Date(timestamp);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error('Fecha de calendario inválida.');
  }
  return Math.floor(timestamp / 86400000);
}

export function epochDayToDate(epochDay) {
  return new Date(epochDay * 86400000).toISOString().slice(0, 10);
}

export function addDays(isoDate, numberOfDays) {
  if (!Number.isInteger(numberOfDays)) throw new Error('El desplazamiento debe ser entero.');
  return epochDayToDate(dateToEpochDay(isoDate) + numberOfDays);
}

export function getMonday(isoDate) {
  const day = dateToEpochDay(isoDate);
  const weekday = (new Date(day * 86400000).getUTCDay() + 6) % 7;
  return epochDayToDate(day - weekday);
}

export function currentMexicoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function cycleStartForDate(isoDate, anchorMonday = DEFAULT_ANCHOR_MONDAY) {
  if (getMonday(anchorMonday) !== anchorMonday) {
    throw new Error('El lunes de referencia debe ser lunes.');
  }
  const dayDifference = dateToEpochDay(isoDate) - dateToEpochDay(anchorMonday);
  return addDays(anchorMonday, Math.floor(dayDifference / 14) * 14);
}

export function createCycle(startDate, dayTypes = DEFAULT_DAY_TYPES) {
  if (getMonday(startDate) !== startDate) throw new Error('El ciclo debe comenzar un lunes.');
  if (!Array.isArray(dayTypes) || dayTypes.length !== 14 ||
      dayTypes.some((day) => !['wish', 'healthy', 'free'].includes(day))) {
    throw new Error('La plantilla debe tener 14 tipos válidos.');
  }
  return {
    startDate,
    endDate: addDays(startDate, 13),
    revision: 1,
    days: dayTypes.map((type, i) => ({
      date: addDays(startDate, i), type: type === 'healthy' ? 'free' : type, wishUserId: null, healthyDishes: [],
    })),
  };
}

const formatter = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'long' });
const fullFormatter = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

export function formatDate(isoDate, long = false) {
  const timestamp = dateToEpochDay(isoDate) * 86400000;
  return (long ? fullFormatter : formatter).format(new Date(timestamp));
}

export function weekdayShort(isoDate) {
  const date = new Date(dateToEpochDay(isoDate) * 86400000);
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short' }).format(date).replace('.', '');
}
