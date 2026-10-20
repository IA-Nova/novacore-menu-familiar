import { collection, doc, getDoc, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { validateDish } from '../utils/dishValidation.js';
import { processDishPhoto } from '../utils/imageProcessing.js';
export { asDataUri } from '../utils/dishPhoto.js';

const dishRef = id => doc(db, 'dishes', id);
export const getThumbnail = async id => {
  const snap = await getDoc(doc(db, 'dishThumbnails', id));
  return snap.exists() ? snap.data() : null;
};
export const getFullPhoto = async id => {
  const snap = await getDoc(doc(db, 'dishPhotos', id));
  return snap.exists() ? snap.data() : null;
};

export async function saveDish({ id = null, form, file = null, uid, isAdmin = false }) {
  const content = validateDish(form);
  const approvedForHealthyMenu = form.approvedForHealthyMenu === 'on' || form.approvedForHealthyMenu === true;
  // Prepare both images before committing. A batch updates the recipe and images atomically.
  const images = file ? await processDishPhoto(file) : null;
  const ref = id ? dishRef(id) : doc(collection(db, 'dishes'));
  const batch = writeBatch(db);
  if (id) {
    batch.update(ref, { ...content, ...(isAdmin ? { approvedForHealthyMenu } : {}),
      ...(images ? { hasPhoto: true } : {}), updatedAt: serverTimestamp() });
  } else {
    batch.set(ref, { ...content, status: 'active', approvedForHealthyMenu: isAdmin && approvedForHealthyMenu,
      hasPhoto: Boolean(images), createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  if (images) {
    batch.set(doc(db, 'dishPhotos', ref.id), { dishId: ref.id, ...images.photo, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'dishThumbnails', ref.id), { dishId: ref.id, ...images.thumbnail, updatedAt: serverTimestamp() });
  }
  await batch.commit();
  return ref.id;
}
export async function setDishHealthy(id, approvedForHealthyMenu) {
  return updateDoc(dishRef(id), { approvedForHealthyMenu: Boolean(approvedForHealthyMenu), updatedAt: serverTimestamp() });
}
export async function setDishArchived(id, status) {
  if (!['archived', 'active'].includes(status)) throw new Error('Estado inválido.');
  return updateDoc(dishRef(id), { status, updatedAt: serverTimestamp() });
}
