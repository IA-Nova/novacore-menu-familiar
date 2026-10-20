import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { needsCalendarRedirect, routeFromHash } from '../src/utils/navigationRoutes.js';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('la raíz abre directamente Calendario', () => {
  for (const hash of ['', '#', '#/', '#/inicio', '#/inicio?desde=antiguo']) {
    assert.equal(needsCalendarRedirect(hash), true);
    assert.equal(routeFromHash(hash), 'calendario');
  }
});
test('las rutas funcionales permanecen sin cambios', () => {
  for (const route of ['calendario', 'antojos', 'recetario', 'administracion', 'perfil', 'registro']) {
    assert.equal(routeFromHash(`#/${route}`), route);
    assert.equal(needsCalendarRedirect(`#/${route}`), false);
  }
});
test('una ruta desconocida no es tratada como Inicio', () => {
  assert.equal(routeFromHash('#/no-existe'), 'no-existe');
  assert.equal(needsCalendarRedirect('#/no-existe'), false);
});
test('Inicio se elimina de la navegación y el logotipo enlaza a Calendario', () => {
  const layout = read('src/components/layout.js');
  assert.doesNotMatch(layout, /#\/inicio|route: 'inicio'/);
  assert.match(layout, /href="#\/calendario" class="brand"/);
  assert.match(layout, /href="#\/calendario" class="mobile-brand"/);
});
test('la navegación móvil queda distribuida en tres columnas', () => {
  assert.match(read('src/styles/layout.css'), /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('la vista Inicio no se importa ni queda habilitada como renderer', () => {
  const main = read('src/main.js');
  assert.doesNotMatch(main, /renderHome|pages\/home|inicio: \(/);
  assert.match(main, /ensureCalendarUrl\(\)/);
  assert.match(main, /requested : 'calendario'/);
});
test('se conserva la ruta base pública que usa GitHub Pages', () => {
  assert.match(read('.env.production'), /^VITE_BASE_PATH=\/novacore-menu-familiar\/$/m);
});
