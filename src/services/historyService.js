import { collection, getDocsFromServer, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';

export async function listRecentCycles(max = 40) {
  const snapshot = await getDocsFromServer(query(collection(db, 'cycles'), orderBy('startDate', 'desc'), limit(max)));
  return snapshot.docs.map(row => ({ id: row.id, ...row.data() }));
}
