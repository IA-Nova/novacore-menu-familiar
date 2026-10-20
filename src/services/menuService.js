import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';

export const watchConfig = (callback, error) => onSnapshot(doc(db, 'config', 'app'),
  (snap) => callback(snap.exists() ? snap.data() : null), error);
export const watchCycle = (cycleId, callback, error) => onSnapshot(doc(db, 'cycles', cycleId),
  (snap) => callback(snap.exists() ? snap.data() : null), error);
export const watchWishes = (cycleId, callback, error) => onSnapshot(
  query(collection(db, 'cycles', cycleId, 'wishes'), limit(10)),
  (snap) => callback(snap.docs.map((d) => ({ userId: d.id, ...d.data() }))), error);
// Cargar todos los metadatos permite buscar por cualquier parte del nombre.
// Las tarjetas siguen paginadas en la interfaz y las fotos se descargan bajo demanda.
export const watchDishes = (callback, error) => onSnapshot(
  query(collection(db, 'dishes'), orderBy('createdAt', 'desc')),
  (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), error);
