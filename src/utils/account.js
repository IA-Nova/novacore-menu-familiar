export const SYNTHETIC_DOMAIN = 'users.novacore';
export const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;
export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}
export function emailForUsername(username) {
  const name = normalizeUsername(username);
  if (!USERNAME_RE.test(name)) throw new Error('Usa entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.');
  return `${name}@${SYNTHETIC_DOMAIN}`;
}
export function validateDisplayName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 60) throw new Error('El nombre debe tener entre 2 y 60 caracteres.');
  return clean;
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
  }
  return password;
}
export function translateAuthError(error) {
  const msg = {
    'auth/email-already-in-use': 'Ese nombre de usuario ya está registrado.',
    'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
    'auth/wrong-password': 'Usuario o contraseña incorrectos.',
    'auth/user-not-found': 'Usuario o contraseña incorrectos.',
    'auth/weak-password': 'Elige una contraseña más segura.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente más tarde.',
    'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión.',
    'permission-denied': 'No tienes permiso para realizar esta acción.',
    'unavailable': 'No hay conexión con el servicio. Intenta nuevamente.',
  };
  return msg[error?.code] || (error?.message && !String(error.message).includes('Firebase') ? String(error.message) : 'No se pudo completar la operación. Intenta nuevamente.');
}
