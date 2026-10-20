import { browserLocalPersistence, createUserWithEmailAndPassword, onAuthStateChanged,
  EmailAuthProvider, reauthenticateWithCredential, setPersistence,
  signInWithEmailAndPassword, signOut as firebaseSignOut, updatePassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { emailForUsername, normalizeUsername, validateDisplayName, validatePassword } from '../utils/account.js';

export const listenAuth = (onUser, onError) => onAuthStateChanged(auth, onUser, onError);
export async function signIn(username, password) {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, emailForUsername(username), password);
}
export async function signUp(username, password, displayName) {
  const cleanUsername = normalizeUsername(username);
  const email = emailForUsername(cleanUsername);
  const cleanName = validateDisplayName(displayName);
  validatePassword(password);
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: cleanName });
  await createPendingProfile(user, cleanName);
  return user;
}
export async function createPendingProfile(user, displayName) {
  const username = (user.email || '').toLowerCase().split('@')[0];
  if (emailForUsername(username) !== (user.email || '').toLowerCase()) throw new Error('Esta cuenta no es válida.');
  await setDoc(doc(db, 'users', user.uid), {
    username,
    displayName: validateDisplayName(displayName || user.displayName || username),
    role: 'member', status: 'pending', approvedAt: null, approvedBy: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
export const signOut = () => firebaseSignOut(auth);
export async function changePassword(currentPassword, newPassword) {
  validatePassword(newPassword);
  if (!auth.currentUser) throw new Error('Inicia sesión primero.');
  const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, cred);
  await updatePassword(auth.currentUser, newPassword);
}
