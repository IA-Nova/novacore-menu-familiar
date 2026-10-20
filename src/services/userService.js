import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, limit } from 'firebase/firestore';
import { db } from './firebase.js';
import { validateDisplayName } from '../utils/account.js';

export function watchProfile(uid, callback, error) {
  return onSnapshot(doc(db, 'users', uid), (snap) => callback(snap.exists() ? { uid: snap.id, ...snap.data() } : null), error);
}
export function watchFamily(callback, error) {
  return onSnapshot(query(collection(db, 'users'), where('status', '==', 'active'), limit(10)),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))), error);
}
export function watchAdminUsers(callback, error) {
  return onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'asc'), limit(100)),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))), error);
}
export const updateDisplayName = (uid, name) => updateDoc(doc(db, 'users', uid), {
  displayName: validateDisplayName(name), updatedAt: serverTimestamp(),
});
export function updateApproval(uid, status, approverUid) {
  if (!['active', 'disabled'].includes(status)) throw new Error('Estado de usuario inválido.');
  return updateDoc(doc(db, 'users', uid), {
    status, approvedAt: status === 'active' ? serverTimestamp() : null,
    approvedBy: status === 'active' ? approverUid : null, updatedAt: serverTimestamp(),
  });
}
