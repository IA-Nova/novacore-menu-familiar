import { test } from 'node:test';
import { strict as assert } from 'node:assert';
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
