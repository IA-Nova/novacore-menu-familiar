import { addDays, dateToEpochDay, TIME_ZONE } from './dates.js';

export const MAX_WISH_DISHES = 6; // Límite derivado de llamadas máximas de reglas Firestore.
export const MAX_WISH_NOTE = 250;

/** La primera medianoche posterior al ciclo, en hora de Ciudad de México. */
export function mexicoMidnightUtc(localDate) {
  const wantedDay = dateToEpochDay(localDate);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  let candidate = new Date(`${localDate}T06:00:00.000Z`);
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(candidate);
    const part = (type) => parts.find(p => p.type === type)?.value;
    const shownDate = `${part('year')}-${part('month')}-${part('day')}`;
    const offsetMinutes = (dateToEpochDay(shownDate) - wantedDay) * 1440 + Number(part('hour')) * 60 + Number(part('minute'));
    if (offsetMinutes === 0) break;
    candidate = new Date(candidate.getTime() - offsetMinutes * 60000);
  }
  return candidate;
}

export function endOfCycleExclusive(startDate) { return mexicoMidnightUtc(addDays(startDate, 14)); }

export function wishEditDeadline(cycle, uid) {
  if (!cycle || !cycle.endAt) return null;
  const plannedDate = cycle.days?.find(day => day.type === 'wish' && day.wishUserId === uid)?.date;
  if (plannedDate) return mexicoMidnightUtc(addDays(plannedDate, -1));
  // Dates persisted by older versions are midnights on the scheduled day.
  const raw = cycle.wishDeadlines?.[uid];
  if (raw) {
    const stored = raw.toDate ? raw.toDate() : new Date(raw);
    return new Date(stored.getTime() - 86400000);
  }
  const end = cycle.endAt;
  return end?.toDate ? end.toDate() : new Date(end);
}

export function wishCanEdit(cycle, uid, now = new Date(), wishStatus = 'selected') {
  if (!cycle?.endAt) return false;
  const end = cycle.endAt?.toDate ? cycle.endAt.toDate() : new Date(cycle.endAt);
  if (!Number.isFinite(end.getTime()) || now.getTime() >= end.getTime()) return false;
  // A pending or declined choice is not "Programado", even if a date has been reserved.
  if (wishStatus !== 'selected') return true;
  const deadline = wishEditDeadline(cycle, uid);
  return Boolean(deadline && !Number.isNaN(deadline.getTime()) && now.getTime() < deadline.getTime());
}

export function normalizeWishSelection(dishIds, dishes, newNames = {}) {
  const uniqueIds = [...new Set(dishIds)];
  if (!uniqueIds.length) throw new Error('Elige al menos un platillo para tu antojo.');
  if (uniqueIds.length > MAX_WISH_DISHES) throw new Error(`Puedes seleccionar hasta ${MAX_WISH_DISHES} platillos para un antojo.`);
  return uniqueIds.map(id => {
    const dish = dishes.find(d => d.id === id);
    if (dish && dish.status !== 'active') throw new Error('Hay un platillo archivado en tu selección. Quítalo antes de guardar.');
    const name = dish?.name ?? newNames[id];
    if (!name) throw new Error('Actualiza el recetario antes de guardar este platillo.');
    return { dishId: id, nameSnapshot: name };
  });
}

export function validateWishNote(note) {
  const value = String(note ?? '').trim();
  if (value.length > MAX_WISH_NOTE) throw new Error(`La nota no puede superar ${MAX_WISH_NOTE} caracteres.`);
  return value;
}

