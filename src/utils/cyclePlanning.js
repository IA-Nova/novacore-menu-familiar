import { addDays, createCycle, dateToEpochDay, getMonday } from './dates.js';
import { endOfCycleExclusive, mexicoMidnightUtc } from './wishValidation.js';

// The legacy field name healthyDishes remains for existing Firestore documents and backups.
export const MAX_HEALTHY_DISHES = 10;
export const DAY_TYPES = ['healthy', 'wish', 'free'];

export function assertPlanningCycle(cycle) {
  if (!cycle || typeof cycle.startDate !== 'string' || getMonday(cycle.startDate) !== cycle.startDate ||
      cycle.endDate !== addDays(cycle.startDate, 13) || !Array.isArray(cycle.days) || cycle.days.length !== 14 ||
      !Number.isInteger(cycle.revision) || cycle.revision < 1) throw new Error('El calendario del ciclo no tiene un formato válido.');
  const assigned = [];
  cycle.days.forEach((day, index) => {
    if (day.date !== addDays(cycle.startDate, index) || !DAY_TYPES.includes(day.type) ||
      !Array.isArray(day.healthyDishes) || (day.wishUserId !== null && typeof day.wishUserId !== 'string'))
      throw new Error('Hay un día con información inválida.');
    if (day.type === 'wish') {
      if (day.healthyDishes.length) throw new Error('Un día de antojo no admite platillos libres.');
      if (day.wishUserId) assigned.push(day.wishUserId);
    } else if (day.wishUserId !== null) throw new Error('Solo un día de antojo puede tener integrante asignado.');
    if (day.type === 'wish' && day.healthyDishes.length) throw new Error('Un antojo no admite platillos del menú libre.');
    if (day.healthyDishes.length > MAX_HEALTHY_DISHES) throw new Error('Demasiados platillos en una comida.');
    if (day.healthyDishes.some(d => !d || typeof d.dishId !== 'string' || typeof d.nameSnapshot !== 'string' || !d.nameSnapshot))
      throw new Error('Hay un platillo con información inválida.');
    if (new Set(day.healthyDishes.map(d => d.dishId)).size !== day.healthyDishes.length)
      throw new Error('No repitas platillos en la misma comida.');
  });
  if (new Set(assigned).size !== assigned.length) throw new Error('Un integrante no puede ocupar dos antojos del mismo ciclo.');
  if (cycle.days.filter(d => d.type === 'wish').length > 5) throw new Error('El ciclo admite un máximo de cinco espacios de antojo.');
  return cycle;
}

export function moveDayContent(cycle, firstDate, secondDate) {
  assertPlanningCycle(cycle);
  const i = cycle.days.findIndex(d => d.date === firstDate);
  const j = cycle.days.findIndex(d => d.date === secondDate);
  if (i < 0 || j < 0 || i === j) throw new Error('Elige dos fechas distintas de este ciclo.');
  const days = structuredClone(cycle.days);
  for (const field of ['type', 'wishUserId', 'healthyDishes']) [days[i][field], days[j][field]] = [days[j][field], days[i][field]];
  return assertPlanningCycle({ ...cycle, days });
}

export function editPlannedDay(cycle, date, draft, familyUsers = []) {
  assertPlanningCycle(cycle);
  const dayIndex = cycle.days.findIndex(d => d.date === date);
  if (dayIndex < 0 || !DAY_TYPES.includes(draft.type)) throw new Error('Selecciona un día y tipo válidos.');
  const days = structuredClone(cycle.days);
  const wishUserId = draft.type === 'wish' ? draft.wishUserId || null : null;
  const healthyDishes = draft.type !== 'wish' ? structuredClone(draft.healthyDishes || []) : [];
  if (wishUserId && !familyUsers.some(u => u.uid === wishUserId && u.status === 'active')) {
    throw new Error('Selecciona un integrante activo.');
  }
  days[dayIndex] = { date, type: draft.type === 'healthy' ? 'free' : draft.type, wishUserId, healthyDishes };
  return assertPlanningCycle({ ...cycle, days });
}

function timestampToMillis(ts) {
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return ts instanceof Date ? ts.getTime() : typeof ts === 'string' ? new Date(ts).getTime() : NaN;
}

/** Persist the server-checked cutoffs on the cycle, not on wish documents. */
export function withPlanningDeadlines(previous, next, now = new Date()) {
  assertPlanningCycle(next);
  const oldAssigned = new Map((previous?.days || []).filter(d => d.type === 'wish' && d.wishUserId).map(d => [d.wishUserId, d.date]));
  const newAssigned = new Map(next.days.filter(d => d.type === 'wish' && d.wishUserId).map(d => [d.wishUserId, d.date]));
  const deadlines = {};
  const locked = new Set(previous?.lockedWishes || []);
  const oldDeadlines = previous?.wishDeadlines || {};
  for (const [uid, date] of oldAssigned) {
    const oldDeadline = timestampToMillis(oldDeadlines[uid]);
    const inferredOldDeadline = mexicoMidnightUtc(date).getTime();
    if (now.getTime() >= (Number.isFinite(oldDeadline) ? oldDeadline : inferredOldDeadline)) locked.add(uid);
  }
  for (const [uid, date] of newAssigned) {
    const cutoff = mexicoMidnightUtc(date);
    deadlines[uid] = cutoff;
    if (cutoff.getTime() <= now.getTime()) locked.add(uid);
  }
  // For an unassigned user the rules use the original cycle endAt, unless locked.
  return { ...next, endAt: previous?.endAt || endOfCycleExclusive(next.startDate),
    wishDeadlines: deadlines, lockedWishes: [...locked] };
}

export function changeRequiresHistoryConfirmation(cycle, affectedDates, today) {
  return affectedDates.some(date => date < today);
}

export function templateForFuture(types) {
  if (!Array.isArray(types) || types.length !== 14 || types.some(t => !DAY_TYPES.includes(t)))
    throw new Error('La distribución debe incluir 14 días válidos.');
  if (types.filter(t => t === 'wish').length > 5) throw new Error('Solo puede haber cinco espacios de antojo.');
  return types.map(type => type === 'healthy' ? 'free' : type);
}

/** The only administrative finalization of a declined wish: free its assigned date and lock the user's selection. */
export function finalizeDeclinedWish(cycle, uid, now = new Date()) {
  assertPlanningCycle(cycle);
  if (typeof uid !== 'string' || !uid) throw new Error('Selecciona un integrante válido.');
  const days = structuredClone(cycle.days);
  const assigned = days.find(d => d.type === 'wish' && d.wishUserId === uid);
  if (assigned) {
    assigned.type = 'free';
    assigned.wishUserId = null;
    assigned.healthyDishes = [];
  }
  const next = withPlanningDeadlines(cycle, { ...cycle, days }, now);
  next.lockedWishes = [...new Set([...(next.lockedWishes || []), uid])];
  return assertPlanningCycle(next);
}
