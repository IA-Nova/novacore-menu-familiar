import { collection, deleteField, doc, FieldPath, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { DISH_VOTES } from '../utils/dishVotes.js';

const dishVoteRef = id => doc(db, 'dishVotes', id);

export const watchDishVotes = (onChange, onError) => onSnapshot(collection(db, 'dishVotes'), snapshot => {
  const byDish = {};
  for (const entry of snapshot.docs) byDish[entry.id] = entry.data();
  onChange(byDish);
}, onError);

// Las rutas dinámicas evitan reemplazar los votos de otras personas al guardar el propio.
export async function saveDishVote(dishId, uid, vote) {
  if (typeof dishId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(dishId) ||
      typeof uid !== 'string' || !uid || (vote !== null && !DISH_VOTES.includes(vote))) {
    throw new Error('Voto no válido.');
  }
  const ref = dishVoteRef(dishId);
  if (vote === null) {
    await updateDoc(ref, new FieldPath('votes', uid), deleteField(), 'updatedAt', serverTimestamp());
  } else {
    await setDoc(ref, { votes: { [uid]: vote }, updatedAt: serverTimestamp() }, { merge: true });
  }
}
