import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { validateDish, duplicateDishNames } from '../src/utils/dishValidation.js';
import { asDataUri } from '../src/utils/dishPhoto.js';

test('un platillo se guarda con solo nombre y los demás datos opcionales', () => {
  const dish = validateDish({ name: '  Arroz rojo  ' });
  assert.equal(dish.name, 'Arroz rojo');
  assert.equal(dish.searchName, 'arroz rojo');
  assert.equal(dish.prepMinutes, null);
  assert.deepEqual(dish.tags, []);
});
test('etiquetas, tiempo y caracteres largos se validan', () => {
  assert.deepEqual(validateDish({ name: 'Tacos', tags: 'casero, casero, mexicano', prepMinutes: '30' }).tags, ['casero', 'mexicano']);
  assert.throws(() => validateDish({ name: '   ' }));
  assert.throws(() => validateDish({ name: 'Tacos', prepMinutes: '25.5' }));
  assert.throws(() => validateDish({ name: 'Tacos', description: 'x'.repeat(1001) }));
  assert.throws(() => validateDish({ name: 'Tacos', tags: Array.from({length: 11},(_,i)=>`tag${i}`).join(',') }));
});
test('duplicados consideran acentos y mayúsculas pero no bloquean el guardado', () => {
  assert.equal(duplicateDishNames([{ id: 'a', name: 'Pollo al Limón', status: 'active' }], 'POLLO AL LIMON').length, 1);
  assert.equal(duplicateDishNames([{ id: 'a', name: 'Pollo al Limón', status: 'active' }], 'POLLO AL LIMON', 'a').length, 0);
});
test('sólo se generan URI de imágenes con MIME y Base64 admitidos', () => {
  assert.equal(asDataUri({ mimeType: 'image/jpeg', base64: 'AAAA' }), 'data:image/jpeg;base64,AAAA');
  assert.equal(asDataUri({ mimeType: 'text/html', base64: 'AAAA' }), '');
  assert.equal(asDataUri({ mimeType: 'image/jpeg', base64: '" onerror="alert(1)' }), '');
});

import { renderRecipes } from '../src/pages/recipes.js';
const uiState = {
  dishes: [], thumbnails: {}, fullDishPhoto: null, recipeQuery: '', recipeFilter: 'all',
  recipeView: 'cards', recipeTag: '', recipePageSize: 24,
  recipeEditor: 'new', recipeDraft: null, recipeNotice: '', recipePhotoFile: null,
  recipeDetailId: null, familyUsers: [], user: { uid: 'admin-uid' },
  profile: { role: 'admin' },
};
test('formulario nuevo presenta agregar platillo y no instrucciones técnicas', () => {
  const html = renderRecipes(uiState);
  assert.match(html, /Agregar platillo/);
  assert.match(html, /name="name"/);
  assert.match(html, /name="photo"/);
  assert.doesNotMatch(html, /Firestore|Próximamente|fase de desarrollo|conecte Firebase/i);
});
test('conserva etiquetas de borrador y muestra controles del administrador', () => {
  const html = renderRecipes({ ...uiState, recipeDraft: { name: 'Arroz', tags: 'arroz, casero' } });
  assert.match(html, /value="arroz, casero"/);
  assert.match(html, /Agregar platillo/);
  assert.match(html, /Archivados/);
});

test('postre y bebida se guardan como etiquetas del recetario, sin quitar saludable', () => {
  const dish = validateDish({ name: 'Atole con galletas', tags: 'Casero, POSTRE', tagPostre: 'on', tagBebida: 'on' });
  assert.deepEqual(dish.tags, ['Casero', 'postre', 'bebida']);
});
test('el administrador ve Saludable, Postre y Bebida desde el formulario, sin notas de desarrollo', () => {
  const text = renderRecipes(uiState);
  assert.match(text, /name="approvedForHealthyMenu"/);
  assert.match(text, /name="tagPostre"/);
  assert.match(text, /name="tagBebida"/);
  assert.match(text, /Postres/);
  assert.match(text, /Bebidas/);
});
test('integrantes pueden clasificar Postre/Bebida pero no otorgar etiqueta saludable', () => {
  const text = renderRecipes({ ...uiState, profile: { role: 'member' } });
  assert.doesNotMatch(text, /name="approvedForHealthyMenu"/);
  assert.match(text, /name="tagPostre"/);
  assert.match(text, /name="tagBebida"/);
});

import { parseDishImport, markImportDuplicates, MAX_IMPORT_DISHES } from '../src/utils/dishImport.js';
import { renderAdminDishImport } from '../src/pages/adminImport.js';

test('importar JSON convierte recetas a documentos con campos del recetario', () => {
  const dishes = parseDishImport(JSON.stringify([
    { name: ' Arroz rojo ', approvedForHealthyMenu: true, prepMinutes: 40, tags: [] },
    { name: 'Atole de vainilla', tags: ['BEBIDA'], ingredientsText: 'Leche', instructionsText: 'Hervir.' },
  ]));
  assert.equal(dishes.length, 2);
  assert.equal(dishes[0].searchName, 'arroz rojo');
  assert.equal(dishes[0].approvedForHealthyMenu, true);
  assert.equal(dishes[0].prepMinutes, 40);
  assert.deepEqual(dishes[1].tags, ['bebida']);
  assert.equal(dishes[1].approvedForHealthyMenu, false);
  for (const dish of dishes) {
    assert.ok(!('createdBy' in dish));
    assert.ok(!('createdAt' in dish));
  }
});
test('importar omite coincidencias entre archivo y recetario, incluso acentos', () => {
  const dishes = parseDishImport(JSON.stringify([
    { name: 'Arroz rojo' }, { name: 'ARROZ ROJO' }, { name: 'Albóndigas' }, { name: 'Mortadela' },
  ]));
  assert.deepEqual(markImportDuplicates(dishes, new Set(['albondigas', 'mortadela'])).map(d => d.status),
    ['nueva', 'repetida', 'existente', 'existente']);
});
test('JSON inválido y campos no admitidos se rechazan antes de importar', () => {
  assert.throws(() => parseDishImport('{'), /JSON válido/);
  assert.throws(() => parseDishImport('{}'), /lista/);
  assert.throws(() => parseDishImport(JSON.stringify(Array(MAX_IMPORT_DISHES + 1).fill({ name: 'Arroz' }))), /lista/);
  assert.throws(() => parseDishImport(JSON.stringify([{ name: 'Arroz', createdBy: 'otro' }])), /no reconocidos/);
  assert.throws(() => parseDishImport(JSON.stringify([{ name: 'Arroz', approvedForHealthyMenu: 'true' }])), /verdadero o falso/);
  assert.throws(() => parseDishImport(JSON.stringify([{ name: 'Arroz', prepMinutes: 9999 }])), /tiempo/);
  assert.throws(() => parseDishImport(JSON.stringify([{ name: 'Arroz', tags: ['postre', {}] }])), /etiquetas/);
  assert.throws(() => parseDishImport(JSON.stringify([{ name: 'x'.repeat(101) }])), /nombre/);
});
test('importador administrativo muestra vista previa segura y sin instrucciones técnicas', () => {
  const dish = parseDishImport(JSON.stringify([{ name: '<img onerror=alert(1)>', tags: ['postre'] }]))[0];
  const html = renderAdminDishImport({
    dishImportPreview: [{dish, status:'nueva'}], dishImportBusy:false,
    dishImportError:'', dishImportMessage:'',
  });
  assert.match(html, /Importar recetas/);
  assert.match(html, /admin-dish-import-save/);
  assert.match(html, /&lt;img onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img onerror=/);
  assert.doesNotMatch(html, /cuando se conecte|fase pendiente|todav[ií]a no se ha desarrollado/i);
});

test('importar desde Recetario aparece solo al administrador', () => {
  const adminHtml = renderRecipes({ ...uiState, recipeEditor: null, dishImportOpen: true,
    dishImportPreview: null, dishImportBusy: false, dishImportError: '', dishImportMessage: '' });
  const memberHtml = renderRecipes({ ...uiState, profile: { role: 'member' }, recipeEditor: null, dishImportOpen: true });
  assert.match(adminHtml, /data-action="dish-import-toggle"/);
  assert.match(adminHtml, /data-form="admin-dish-import-preview"/);
  assert.doesNotMatch(memberHtml, /dish-import-toggle|admin-dish-import-preview/);
});

test('la búsqueda encuentra platillos posteriores a la primera página sin pulsar Mostrar más', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    id: `d${i}`, name: `Platillo ${i + 1}`, status: 'active', tags: [], createdBy: 'admin-uid',
    approvedForHealthyMenu: false, hasPhoto: false,
  }));
  items.push({ id: 'crepas', name: 'Crepas con cajeta', status: 'active', tags: [],
    createdBy: 'admin-uid', approvedForHealthyMenu: false, hasPhoto: true });
  const queryState = { ...uiState, recipeEditor: null, dishes: items, recipeQuery: 'CREPAS', recipePageSize: 24 };
  const html = renderRecipes(queryState);
  assert.match(html, /Crepas con cajeta/);
  assert.match(html, /<strong>1 platillos<\/strong>/);
  assert.doesNotMatch(html, /data-action="dish-more"/);
});

test('paginación visual respeta Mostrar más y búsqueda global por etiqueta', () => {
  const items = Array.from({ length: 31 }, (_, i) => ({
    id: `d${i}`, name: `Receta ${i + 1}`, status: 'active', tags: i === 30 ? ['postre'] : [],
    createdBy: 'admin-uid', approvedForHealthyMenu: i === 30, hasPhoto: false,
  }));
  const baseState = { ...uiState, recipeEditor: null, dishes: items, recipePageSize: 24 };
  const first = renderRecipes(baseState);
  assert.equal((first.match(/data-action="dish-detail"/g) || []).length, 24);
  assert.match(first, /data-action="dish-more"/);
  assert.match(first, /<strong>31 platillos<\/strong>/);
  assert.equal((renderRecipes({ ...baseState, recipePageSize: 48 }).match(/data-action="dish-detail"/g) || []).length, 31);
  const filtered = renderRecipes({ ...baseState, recipeTag: 'postre', recipeFilter: 'healthy' });
  assert.match(filtered, /Receta 31/);
  assert.doesNotMatch(filtered, /data-action="dish-more"/);
});


test('la vista de lista muestra nombre, descripción, tiempo y etiquetas en una fila completa', () => {
  const dish = {
    id: 'crepas-1', name: 'Crepas de cajeta', status: 'active',
    description: 'Postre casero preparado con leche y harina.', prepMinutes: 25,
    createdBy: 'admin-uid', approvedForHealthyMenu: false, tags: ['postre'],
  };
  const html = renderRecipes({ ...uiState, recipeEditor: null, recipeView: 'list', dishes: [dish] });
  assert.match(html, /class="recipe-card compact"/);
  assert.match(html, /class="recipe-list-media"/);
  assert.match(html, /<h3>Crepas de cajeta<\/h3>/);
  assert.match(html, /class="recipe-list-description">Postre casero/);
  assert.match(html, /25 min/);
  assert.match(html, /postre/);
  assert.match(html, /data-action="dish-detail"/);
});

test('la vista de lista mantiene el contenedor de foto aunque no haya imagen', () => {
  const dish = { id: 'fideo-1', name: 'Sopa de fideo', status: 'active', createdBy: 'admin-uid', approvedForHealthyMenu: true, tags: [] };
  const html = renderRecipes({ ...uiState, recipeEditor: null, recipeView: 'list', dishes: [dish] });
  assert.match(html, /class="recipe-list-media"><div class="food-illustration"/);
  assert.match(html, /Sopa de fideo/);
  const css = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
  assert.match(css, /\.recipe-card\.compact \.dish-card-open\{display:grid;grid-template-columns:/);
  assert.match(css, /\.recipe-list-media>\.dish-photo\{[^}]*object-fit:contain/);
});
