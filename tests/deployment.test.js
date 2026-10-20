import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('la publicación tiene flujo de GitHub Pages, verificaciones y compilación', () => {
  const deploy = read('.github/workflows/pages.yml');
  for (const expected of ['npm run test:unit','npm run test:rules','npm run build',
    'npm run check:production','actions/deploy-pages@v4','actions/upload-pages-artifact@v3',
    'VITE_BASE_PATH', 'environment:', 'github-pages']) {
    assert.ok(deploy.includes(expected), `Falta ${expected}`);
  }
});
test('no se suben configuraciones privadas, pero sí los datos públicos web', () => {
  const ignore = read('.gitignore');
  assert.match(ignore, /node_modules\//);
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^!\.env\.production$/m);
  const production = read('.env.production');
  assert.match(production, /VITE_USE_EMULATORS=false/);
  assert.match(production, /VITE_FIREBASE_PROJECT_ID=novacore-menu-familiar/);
});
test('el código contiene el botón Hoy, sin mensajes de implementación a la familia', () => {
  const calendar = read('src/pages/calendar.js');
  assert.match(calendar, /data-action="calendar-today"/);
  const pages = ['src/pages/calendar.js', 'src/pages/wishes.js',
    'src/pages/recipes.js', 'src/pages/admin.js', 'src/pages/adminData.js'];
  for (const path of pages) assert.doesNotMatch(read(path), /cuando se conecte Firestore|fase pendiente|módulo en desarrollo/i);
});
test('la configuración de Firestore apunta a las reglas del proyecto', () => {
  const conf = JSON.parse(read('firebase.json'));
  assert.equal(conf.firestore.rules,'firestore.rules');
  assert.equal(conf.emulators.firestore.port, 8080);
  assert.ok(existsSync(new URL('.github/workflows/pages.yml', root)));
});
