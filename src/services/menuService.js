import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';

export const watchConfig = (callback, error) => onSnapshot(doc(db, 'config', 'app'),
  (snap) => callback(snap.exists() ? snap.data() : null), error);
export const watchCycle = (cycleId, callback, error) => onSnapshot(doc(db, 'cycles', cycleId),
  (snap) => callback(snap.exists() ? snap.data() : null), error);
export const watchWishes = (cycleId, callback, error) => onSnapshot(
  query(collection(db, 'cycles', cycleId, 'wishes'), limit(10)),
  (snap) => callback(snap.docs.map((d) => ({ userId: d.id, ...d.data() }))), error);
export const watchDishes = (callback, error, pageSize = 24) => onSnapshot(
  query(collection(db, 'dishes'), orderBy('createdAt', 'desc'), limit(pageSize)),
  (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), error);
