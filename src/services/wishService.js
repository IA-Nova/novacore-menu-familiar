import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { createCycle } from '../utils/dates.js';
import { endOfCycleExclusive, normalizeWishSelection, validateWishNote } from '../utils/wishValidation.js';

export async function prepareWishCycle(startDate, defaultDayTypes) {
  const cycle = createCycle(startDate, defaultDayTypes);
  const ref = doc(db, 'cycles', startDate);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    // Existing plans are never overwritten. A legacy incomplete cycle receives
    // the deadline fields only; the other fields remain unchanged.
    if (snapshot.exists()) {
      const existing = snapshot.data();
      if ((!existing.endAt || !existing.wishDeadlines || !existing.lockedWishes) && existing.endDate === cycle.endDate) {
        transaction.update(ref, {
          ...(!existing.endAt ? { endAt: endOfCycleExclusive(startDate) } : {}),
          ...(!existing.wishDeadlines ? { wishDeadlines: {} } : {}),
          ...(!existing.lockedWishes ? { lockedWishes: [] } : {}),
          updatedAt: serverTimestamp(),
        });
      }
      return false;
    }
    transaction.set(ref, {
      ...cycle, endAt: endOfCycleExclusive(startDate), wishDeadlines: {}, lockedWishes: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return true;
  });
}

export async function saveMyWish({ cycleId, uid, selection, dishes, newNames = {}, note = '', declined = false }) {
  const entries = declined ? [] : normalizeWishSelection(selection, dishes, newNames);
  const cleanNote = declined ? '' : validateWishNote(note);
  const ref = doc(db, 'cycles', cycleId, 'wishes', uid);
  return runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);
    const data = { userId: uid, status: declined ? 'declined' : 'selected', dishes: entries,
      note: cleanNote, updatedAt: serverTimestamp() };
    if (existing.exists()) transaction.update(ref, data);
    else transaction.set(ref, { ...data, createdAt: serverTimestamp() });
  });
}
