import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dishVoteSummary, nextDishVote } from '../src/utils/dishVotes.js';
import { renderRecipes } from '../src/pages/recipes.js';

const users = [
  { uid: 'admin-uid', status: 'active' },
  { uid: 'ana', status: 'active' },
  { uid: 'maria', status: 'active' },
  { uid: 'pepe', status: 'disabled' },
];
const votes = {
  arroz: { votes: { 'admin-uid': 'like', ana: 'dislike', maria: 'like', pepe: 'dislike' } },
};
const dish = { id: 'arroz', name: 'Arroz rojo', status: 'active', tags: [], createdBy: 'admin-uid',
  approvedForHealthyMenu: true, hasPhoto: false, description: 'Tradicional' };
const viewState = {
  dishes: [dish], dishVotes: votes, familyUsers: users, user: { uid: 'admin-uid' },
  profile: { role: 'admin', status: 'active' }, recipeQuery: '', recipeFilter: 'all',
  recipeTags: [], recipeMatchMode: 'all', recipeSort: 'az', recipeView: 'cards', recipePageSize: 24,
  recipeNotice: '', recipeEditor: null, recipeDetailId: null, recipeDraft: null,
  dishImportOpen: false, thumbnails: {}, fullDishPhoto: null, voteBusyDishId: null, dishVotesLoaded: true,
};

test('resume votos de integrantes activos sin contar cuentas desactivadas', () => {
  assert.deepEqual(dishVoteSummary('arroz', votes, users, 'admin-uid'), { likes: 2, dislikes: 1, userVote: 'like' });
  assert.deepEqual(dishVoteSummary('arroz', votes, users, 'pepe'), { likes: 2, dislikes: 1, userVote: null });
  assert.deepEqual(dishVoteSummary('desconocida', votes, users, 'ana'), { likes: 0, dislikes: 0, userVote: null });
});
test('votar de nuevo retira preferencia y votar contrario la cambia', () => {
  assert.equal(nextDishVote(null, 'like'), 'like');
  assert.equal(nextDishVote('like', 'like'), null);
  assert.equal(nextDishVote('like', 'dislike'), 'dislike');
  assert.equal(nextDishVote('dislike', 'dislike'), null);
  assert.throws(() => nextDishVote(null, 'love'), /Voto no válido/);
});
test('recetario muestra conteos y selección sin botones anidados en tarjetas ni lista', () => {
  for (const recipeView of ['cards', 'list']) {
    const html = renderRecipes({ ...viewState, recipeView });
    assert.match(html, /data-action="dish-vote" data-value="arroz" data-vote="like"/);
    assert.match(html, /aria-pressed="true" aria-label="Me gusta: 2/);
    assert.match(html, /aria-pressed="false" aria-label="No me gusta: 1/);
    assert.match(html, /<\/button><div class="dish-votes dish-votes-compact"/);
    assert.doesNotMatch(html, /<button class="dish-card-open"[^>]*>[\s\S]*?<div class="dish-votes[^>]*>[\s\S]*?<\/button><\/article>/);
  }
});
test('detalle permite votar, las recetas archivadas solo muestran los resultados', () => {
  const html = renderRecipes({ ...viewState, recipeDetailId: 'arroz' });
  assert.match(html, /class="surface-card dish-detail"/);
  assert.match(html, /Opiniones de la familia sobre Arroz rojo/);
  assert.equal((html.match(/data-vote="like"/g) || []).length, 2); // tarjeta y detalle
  const archived = renderRecipes({ ...viewState, dishes: [{ ...dish, status: 'archived' }],
    recipeFilter: 'archived', recipeDetailId: 'arroz' });
  assert.match(archived, /data-vote="like"[\s\S]*?disabled>/);
});
test('durante guardado se desactivan ambos botones de cada vista', () => {
  const html = renderRecipes({ ...viewState, voteBusyDishId: 'arroz' });
  assert.equal((html.match(/disabled>/g) || []).length, 2);
  assert.match(html, /Guardando…/);
});
test('control de votos enlaza vista, escucha Firebase y guarda preferencia', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /watchDishVotes\(/);
  assert.match(source, /action === 'dish-vote'/);
  assert.match(source, /await saveDishVote\(/);
});

test('no permite votar antes de cargar la lista de integrantes y preferencias', () => {
  for (const props of [{ dishVotesLoaded: false }, { familyUsers: [] }]) {
    const html = renderRecipes({ ...viewState, ...props });
    assert.equal((html.match(/disabled>/g) || []).length, 2);
  }
});
