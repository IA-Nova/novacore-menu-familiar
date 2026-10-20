import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { DEFAULT_ANCHOR_MONDAY } from '../utils/dates.js';
import { assertPlanningCycle, changeRequiresHistoryConfirmation, editPlannedDay, moveDayContent, templateForFuture, withPlanningDeadlines, finalizeDeclinedWish } from '../utils/cyclePlanning.js';

export async function saveCycleEdit({ cycleId, expectedRevision, operation, firstDate, secondDate,
  draft, familyUsers, dishes = [], confirmedHistory = false, today }) {
  const ref = doc(db, 'cycles', cycleId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Primero prepara este ciclo.');
    const oldCycle = snap.data();
    assertPlanningCycle(oldCycle);
    if (oldCycle.revision !== expectedRevision) throw new Error('El calendario cambió en otra sesión. Actualízalo antes de guardar.');
    const affectedDates = operation === 'swap' ? [firstDate, secondDate] : [firstDate];
    if (changeRequiresHistoryConfirmation(oldCycle, affectedDates, today) && !confirmedHistory)
      throw new Error('Debes confirmar la corrección de fechas anteriores.');
    let next;
    if (operation === 'swap') next = moveDayContent(oldCycle, firstDate, secondDate);
    else if (operation === 'edit') {
      next = editPlannedDay(oldCycle, firstDate, draft, familyUsers);
      const priorIds = new Set(oldCycle.days.find(d => d.date === firstDate).healthyDishes.map(d => d.dishId));
      const additions = (draft.healthyDishes || []).filter(item => !priorIds.has(item.dishId));
      // The checks are read in the same Firestore transaction as the plan update.
      for (const item of additions) {
        const matching = dishes.find(d => d.id === item.dishId);
        if (!matching || matching.status !== 'active')
          throw new Error('Solo puedes agregar platillos activos del recetario.');
        const recipeSnap = await transaction.get(doc(db, 'dishes', item.dishId));
        const recipe = recipeSnap.data();
        if (!recipeSnap.exists() || recipe.status !== 'active' || recipe.name !== item.nameSnapshot)
          throw new Error('Cambió un platillo del recetario. Actualiza la selección.');
      }
    } else throw new Error('Operación desconocida.');
    next = withPlanningDeadlines(oldCycle, next);
    transaction.update(ref, { days: next.days, wishDeadlines: next.wishDeadlines,
      lockedWishes: next.lockedWishes, revision: oldCycle.revision + 1, updatedAt: serverTimestamp() });
  });
}

export async function saveTemplate({ currentConfig, familyName, dayTypes }) {
  const types = templateForFuture(dayTypes);
  const name = String(familyName || '').trim();
  if (!name || name.length > 60) throw new Error('El nombre de la familia debe tener de 1 a 60 caracteres.');
  const ref = doc(db, 'config', 'app');
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data();
    if (!snap.exists()) {
      transaction.set(ref, { familyName: name, timeZone: 'America/Mexico_City',
        anchorMonday: DEFAULT_ANCHOR_MONDAY, maxActiveUsers: 5,
        defaultDayTypes: types, schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      transaction.update(ref, { familyName: name, defaultDayTypes: types, updatedAt: serverTimestamp() });
    }
  });
}

export async function finalizeWishDecline(cycleId, uid) {
  const cycleRef = doc(db, 'cycles', cycleId);
  const wishRef = doc(db, 'cycles', cycleId, 'wishes', uid);
  return runTransaction(db, async transaction => {
    const [cycleSnap, wishSnap] = await Promise.all([transaction.get(cycleRef), transaction.get(wishRef)]);
    if (!cycleSnap.exists() || !wishSnap.exists() || wishSnap.data().status !== 'declined')
      throw new Error('La renuncia ya no está disponible para procesar.');
    const current = cycleSnap.data();
    if (current.lockedWishes?.includes(uid)) return false;
    const next = finalizeDeclinedWish(current, uid);
    transaction.update(cycleRef, { days: next.days, wishDeadlines: next.wishDeadlines,
      lockedWishes: next.lockedWishes, revision: current.revision + 1, updatedAt: serverTimestamp() });
    return true;
  });
}
