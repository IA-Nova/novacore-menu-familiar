import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy,
  query, startAfter, Timestamp, serverTimestamp, updateDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase.js';
import { BACKUP_FORMAT, BACKUP_COLLECTIONS, validateBackup } from '../utils/backupValidation.js';
import { assertPlanningCycle } from '../utils/cyclePlanning.js';

// Timestamps are explicit markers so that no string date becomes a Firestore Timestamp by accident.
export function serializeValue(value) {
  if (value && typeof value.toDate === 'function' && typeof value.toMillis === 'function')
    return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeValue(v)]));
  return value;
}
export function restoreValue(value) {
  if (Array.isArray(value)) return value.map(restoreValue);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.__timestamp === 'string')
      return Timestamp.fromDate(new Date(value.__timestamp));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreValue(v)]));
  }
  return value;
}

async function readCollection(path, pageSize = 100) {
  const result = [];
  let last = null;
  while (true) {
    const q = query(collection(db, ...path), orderBy(documentId()), ...(last ? [startAfter(last)] : []), limit(pageSize));
    const snap = await getDocsFromServer(q);
    for (const d of snap.docs) result.push({ id: d.id, data: serializeValue(d.data()) });
    if (snap.size < pageSize) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return result;
}
export async function exportFamilyBackup(adminUid, onProgress = () => {}) {
  const output = { format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: new Date().toISOString(),
    source: { projectId: firebaseConfig.projectId }, collections: {} };
  for (const name of BACKUP_COLLECTIONS.filter(k => k !== 'wishes')) {
    onProgress(`Leyendo ${name}...`);
    output.collections[name] = await readCollection([name]);
  }
  // Orphaned old image documents are not part of any current dish backup.
  const pictured = new Set(output.collections.dishes.filter(r => r.data.hasPhoto).map(r => r.id));
  output.collections.dishPhotos = output.collections.dishPhotos.filter(r => pictured.has(r.id));
  output.collections.dishThumbnails = output.collections.dishThumbnails.filter(r => pictured.has(r.id));
  output.collections.wishes = [];
  const cycles = output.collections.cycles;
  for (let i = 0; i < cycles.length; i++) {
    onProgress(`Leyendo antojos (${i + 1} de ${cycles.length})...`);
    const wishes = await readCollection(['cycles', cycles[i].id, 'wishes']);
    output.collections.wishes.push(...wishes.map(row => ({ cycleId: cycles[i].id, ...row })));
  }
  validateBackup(output, adminUid, firebaseConfig.projectId);
  return output;
}
export function saveBackupFile(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = `novacore-menu-respaldo-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 15000); }
}

// Preflight refuses to write *anything* if Firebase Auth-linked profiles cannot be reconciled.
export async function preflightRestore(backup, adminUid) {
  validateBackup(backup, adminUid, firebaseConfig.projectId);
  const liveUsers = await readCollection(['users']);
  const existing = new Map(liveUsers.map(r => [r.id, r.data]));
  for (const row of backup.collections.users) {
    const current = existing.get(row.id);
    if (!current || current.username !== row.data.username || current.role !== row.data.role)
      throw new Error(`La cuenta «${row.data.username}» no coincide con Authentication/Firestore actual. Reconcilia las cuentas antes de restaurar.`);
  }
  const restored = new Set(backup.collections.users.map(r => r.id));
  const activeExtra = liveUsers.filter(r => r.data.status === 'active' && !restored.has(r.id)).length;
  const activeRestore = backup.collections.users.filter(r => r.data.status === 'active').length;
  if (activeExtra + activeRestore > 5) throw new Error('La restauración excedería cinco integrantes activos.');
  const cfg = backup.collections.config[0];
  if (cfg) {
    const current = await getDocFromServer(doc(db, 'config', 'app'));
    if (current.exists() && (current.data().anchorMonday !== cfg.data.anchorMonday || current.data().schemaVersion !== cfg.data.schemaVersion))
      throw new Error('El lunes de referencia o la versión del proyecto no coinciden.');
  }
  // Recipes that already exist must retain the original author identity.
  for (const row of backup.collections.dishes) {
    const current = await getDocFromServer(doc(db, 'dishes', row.id));
    if (current.exists() && current.data().createdBy !== row.data.createdBy)
      throw new Error(`El autor del platillo «${row.data.name}» no coincide con el registro existente.`);
  }
  return { activeAfter: activeExtra + activeRestore, ...Object.fromEntries(BACKUP_COLLECTIONS.map(k => [k, backup.collections[k].length])) };
}

export async function restoreFamilyBackup(backup, adminUid, onProgress = () => {}) {
  const summary = await preflightRestore(backup, adminUid);
  const photos = new Map(backup.collections.dishPhotos.map(row => [row.id, row.data]));
  const thumbs = new Map(backup.collections.dishThumbnails.map(row => [row.id, row.data]));
  const done = { platillos: 0, ciclos: 0, antojos: 0, usuarios: 0, configuracion: 0 };
  // Each recipe and its images commit as one unit. The overall restore is NOT atomic.
  for (const row of backup.collections.dishes) {
    const ref = doc(db, 'dishes', row.id);
    const before = await getDocFromServer(ref);
    const data = restoreValue(row.data);
    const batch = writeBatch(db);
    if (before.exists()) {
      // Don't change the immutable author / creation timestamp of a live recipe.
      data.createdAt = before.data().createdAt;
      batch.update(ref, { ...data, updatedAt: serverTimestamp() });
    } else batch.set(ref, { ...data, updatedAt: serverTimestamp() });
    if (data.hasPhoto) {
      batch.set(doc(db, 'dishPhotos', row.id), { ...restoreValue(photos.get(row.id)), updatedAt: serverTimestamp() });
      batch.set(doc(db, 'dishThumbnails', row.id), { ...restoreValue(thumbs.get(row.id)), updatedAt: serverTimestamp() });
    }
    await batch.commit();
    onProgress(`Platillos: ${++done.platillos} de ${summary.dishes}`);
  }
  for (const row of backup.collections.cycles) {
    assertPlanningCycle(row.data);
    const ref = doc(db, 'cycles', row.id);
    const current = await getDocFromServer(ref);
    const data = restoreValue(row.data);
    data.revision = Math.max(data.revision, current.exists() ? (current.data().revision || 0) : 0) + 1;
    data.createdAt = current.exists() ? current.data().createdAt : data.createdAt;
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
    onProgress(`Ciclos: ${++done.ciclos} de ${summary.cycles}`);
  }
  for (const row of backup.collections.wishes) {
    const ref = doc(db, 'cycles', row.cycleId, 'wishes', row.id);
    const current = await getDocFromServer(ref);
    const data = restoreValue(row.data);
    await setDoc(ref, { ...data, createdAt: current.exists() ? current.data().createdAt : data.createdAt,
      updatedAt: serverTimestamp() });
    onProgress(`Antojos: ${++done.antojos} de ${summary.wishes}`);
  }
  for (const row of backup.collections.users) {
    const changes = row.id === adminUid
      ? { displayName: row.data.displayName, updatedAt: serverTimestamp() }
      : { displayName: row.data.displayName, status: row.data.status,
          approvedAt: row.data.status === 'active' ? serverTimestamp() : null,
          approvedBy: row.data.status === 'active' ? adminUid : null,
          updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'users', row.id), changes);
    onProgress(`Integrantes: ${++done.usuarios} de ${summary.users}`);
  }
  const cfg = backup.collections.config[0];
  if (cfg) {
    const ref = doc(db, 'config', 'app');
    const current = await getDocFromServer(ref);
    if (current.exists()) await updateDoc(ref, {
      familyName: cfg.data.familyName, defaultDayTypes: cfg.data.defaultDayTypes, updatedAt: serverTimestamp() });
    else await setDoc(ref, { ...restoreValue(cfg.data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    done.configuracion = 1;
  }
  return done;
}
