// Verificación estática de que GitHub Pages recibirá una configuración pública válida.
// No se conecta a Firebase ni introduce credenciales privadas.
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const content = read('../.env.production');
const vars = Object.fromEntries(content.split(/\r?\n/).filter(line => /^VITE_[A-Z0-9_]+=/.test(line))
  .map(line => { const sep = line.indexOf('='); return [line.slice(0, sep), line.slice(sep + 1)]; }));
const required = ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_APP_ID'];
for (const key of required) if (!vars[key]) throw new Error(`Falta ${key} en la configuración pública de producción.`);
if (vars.VITE_FIREBASE_PROJECT_ID !== 'novacore-menu-familiar') throw new Error('Firebase projectId no corresponde al proyecto familiar.');
if (vars.VITE_USE_EMULATORS !== 'false') throw new Error('Los emuladores no deben usarse en producción.');
const rules = read('../firestore.rules');
const template = read('../firestore.rules.template');
const adminUid = 'To0mq43eJaW8sJm1W3wWzExByRs1';
if (!rules.includes(`request.auth.uid == '${adminUid}'`) || rules.includes('__ADMIN_UID__'))
  throw new Error('El administrador no está anclado en las reglas de producción.');
if (template.replaceAll('__ADMIN_UID__', adminUid) !== rules)
  throw new Error('Las reglas de producción no coinciden con la plantilla probada en el emulador.');
if (Object.keys(vars).some(key => /SECRET|TOKEN|PRIVATE|PASSWORD|SERVICE_ACCOUNT/.test(key)))
  throw new Error('Se detectó un campo sensible en la configuración pública.');
console.log('Configuración pública de Firebase y reglas de producción coherentes.');
