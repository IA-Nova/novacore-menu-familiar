import { collection, doc, getDocs, limit, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { markImportDuplicates, MAX_IMPORT_DISHES } from '../utils/dishImport.js';

async function existingDishNames(dishes) {
  const names = [...new Set(dishes.map(d => d.searchName))];
  const exists = await Promise.all(names.map(async name => {
    const snap = await getDocs(query(collection(db, 'dishes'), where('searchName', '==', name), limit(1)));
    return snap.empty ? null : name;
  }));
  return new Set(exists.filter(Boolean));
}

export async function previewDishImport(dishes) {
  if (!Array.isArray(dishes) || !dishes.length || dishes.length > MAX_IMPORT_DISHES)
    throw new Error('Selecciona entre 1 y 50 recetas.');
  return markImportDuplicates(dishes, await existingDishNames(dishes));
}

export async function saveDishImport(rows, adminUid) {
  if (!adminUid || !Array.isArray(rows) || !rows.length || rows.length > MAX_IMPORT_DISHES)
    throw new Error('No se puede importar esta selección.');
  const pending = rows.filter(row => row.status === 'nueva').map(row => row.dish);
  if (!pending.length) return { created: 0, skipped: rows.length };
  // Revalidar justo antes de escribir, por si alguien creó una receta mientras se revisaba.
  const fresh = markImportDuplicates(pending, await existingDishNames(pending));
  const available = fresh.filter(row => row.status === 'nueva');
  if (!available.length) return { created: 0, skipped: rows.length };
  // Un solo lote: no deja importaciones parcialmente guardadas si falla el commit.
  const batch = writeBatch(db);
  for (const { dish } of available) {
    const ref = doc(collection(db, 'dishes'));
    batch.set(ref, {
      ...dish, status: 'active', hasPhoto: false, createdBy: adminUid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return { created: available.length, skipped: rows.length - available.length };
}
