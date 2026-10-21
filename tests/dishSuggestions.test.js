import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggestionCandidates, suggestionWeight, pickFamilySuggestion } from '../src/utils/dishSuggestions.js';
import { renderSuggestions } from '../src/pages/suggestions.js';

const dishes = [
  { id: 'tinga', name: 'Tinga', tags: ['casero', 'mexicano'], approvedForHealthyMenu: true, status: 'active' },
  { id: 'verduras', name: 'Verduras al vapor', tags: ['vegano'], approvedForHealthyMenu: true, status: 'active' },
  { id: 'agua', name: 'Agua de Jamaica', tags: ['bebida'], approvedForHealthyMenu: true, status: 'active' },
  { id: 'crepas', name: 'Crepas', tags: ['postre'], approvedForHealthyMenu: false, status: 'active' },
  { id: 'archivada', name: 'Archivada', tags: ['bebida'], approvedForHealthyMenu: true, status: 'archived' },
];
const familyUsers = [
  { uid: 'a', status: 'active' }, { uid: 'b', status: 'active' }, { uid: 'c', status: 'active' },
  { uid: 'd', status: 'active' }, { uid: 'e', status: 'disabled' },
];
const votesByDish = {
  tinga: { votes: { a: 'like', b: 'like', c: 'like', d: 'like' } },
  verduras: { votes: { a: 'like', b: 'dislike', c: 'dislike', d: 'dislike', e: 'like' } },
};
const state = { dishes, familyUsers, dishVotes: votesByDish, dishVotesLoaded: true, user: { uid: 'a' },
  suggestionTags: [], suggestionMatchMode: 'all', suggestionDishId: null, thumbnails: {} };

test('solo participa el catálogo activo y los filtros distinguen Saludable de etiquetas', () => {
  assert.deepEqual(suggestionCandidates(dishes).map(d => d.id), ['tinga','verduras','agua','crepas']);
  assert.deepEqual(suggestionCandidates(dishes, ['bebida']).map(d => d.id), ['agua']);
  assert.deepEqual(suggestionCandidates(dishes, ['SALUDABLE', 'Bebida'], 'all').map(d => d.id), ['agua']);
  assert.deepEqual(suggestionCandidates(dishes, ['postre', 'bebida'], 'any').map(d => d.id), ['agua','crepas']);
  assert.deepEqual(suggestionCandidates(dishes, ['saludable', 'postre'], 'all'), []);
  assert.deepEqual(suggestionCandidates(dishes, ['mexicano', 'casero']).map(d => d.id), ['tinga']);
  assert.deepEqual(suggestionCandidates(dishes, ['BEBIDA', 'bebida']).map(d => d.id), ['agua']);
});

test('favorece la tinga con más votos positivos y conserva oportunidad para otros platillos', () => {
  assert.equal(suggestionWeight({ likes: 4, dislikes: 0 }), 16);
  assert.equal(suggestionWeight({ likes: 1, dislikes: 3 }), 1);
  assert.equal(suggestionWeight({ likes: 0, dislikes: 5 }), 1);
  const args = { dishes: dishes.slice(0,2), votesByDish, familyUsers };
  assert.equal(pickFamilySuggestion(args, () => 0).dish.id, 'tinga');
  assert.equal(pickFamilySuggestion(args, () => 0.5).dish.id, 'tinga');
  assert.equal(pickFamilySuggestion(args, () => 0.999).dish.id, 'verduras');
});

test('ignora votos de cuentas desactivadas y permite igualdad si nadie ha votado', () => {
  const vote = pickFamilySuggestion({ dishes: [dishes[1]], votesByDish, familyUsers }, () => 0);
  assert.equal(vote.likes, 1);
  assert.equal(vote.dislikes, 3);
  assert.equal(vote.weight, 1);
  assert.equal(pickFamilySuggestion({ dishes: [dishes[2]] }, () => 0).weight, 4);
});

test('no repite inmediatamente si hay alternativas; un único resultado puede repetirse', () => {
  const args = { dishes: dishes.slice(0,2), votesByDish, familyUsers, previousId: 'tinga' };
  assert.equal(pickFamilySuggestion(args, () => 0).dish.id, 'verduras');
  assert.equal(pickFamilySuggestion({ ...args, dishes: [dishes[0]] }, () => 0).dish.id, 'tinga');
  assert.equal(pickFamilySuggestion({ ...args, tags: ['postre'] }, () => 0), null);
});

test('la interfaz lista combinaciones, resultados, votos y botón de receta completa', () => {
  const html = renderSuggestions({ ...state, suggestionDishId: 'tinga', suggestionTags: ['saludable'] });
  assert.match(html, /¿Qué comemos hoy\?/);
  assert.match(html, /data-action="suggestion-tag" data-value="saludable"/);
  assert.match(html, /data-action="suggestion-generate"/);
  assert.match(html, /data-action="suggestion-view-dish" data-value="tinga"/);
  assert.match(html, /4 Me gusta/);
  assert.match(html, /3 recetas disponibles/);
});

test('el generador no permite generar hasta recibir preferencias y oculta recetas archivadas', () => {
  const html = renderSuggestions({ ...state, dishVotesLoaded: false, suggestionTags: ['bebida'] });
  assert.match(html, /Cargando las preferencias/);
  assert.match(html, /data-action="suggestion-generate" disabled/);
  assert.match(html, /1 receta disponible/);
  const none = renderSuggestions({ ...state, suggestionTags: ['postre', 'saludable'] });
  assert.match(none, /No encontramos recetas/);
  assert.doesNotMatch(none, /data-action="suggestion-view-dish"/);
});

test('el generador escapa el contenido de recetas y etiquetas al mostrarlo', () => {
  const dangerous = { ...dishes[0], id: 'html', name: '<img src=x onerror=alert(1)>', description: '<script>bad</script>', tags: ['<b>'] };
  const html = renderSuggestions({ ...state, dishes: [dangerous], suggestionDishId: 'html' });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test('la sección se incluye en navegación móvil y se enlaza con votos y fotos bajo demanda', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/components/layout.js', import.meta.url), 'utf8');
  assert.match(layout, /route: 'sugerencias'/);
  assert.match(main, /renderSuggestions\(state\)/);
  assert.match(main, /pickFamilySuggestion\(/);
  assert.match(main, /loadThumbnailIds\(\[state.suggestionDishId\]\)/);
});


test('exclusión de Postre y Bebida conserva platos principales y se combina con Saludable', () => {
  assert.deepEqual(suggestionCandidates(dishes, [], 'all', ['postre','bebida']).map(d => d.id), ['tinga','verduras']);
  assert.deepEqual(suggestionCandidates(dishes, ['saludable'], 'all', ['postre','bebida']).map(d => d.id), ['tinga','verduras']);
  assert.deepEqual(suggestionCandidates(dishes, ['saludable','bebida'], 'any', ['bebida']).map(d => d.id), ['tinga','verduras']);
  assert.deepEqual(suggestionCandidates(dishes, [], 'all', ['saludable']).map(d => d.id), ['crepas']);
  assert.equal(pickFamilySuggestion({ dishes, excludedTags: ['postre', 'bebida'], votesByDish, familyUsers }, () => .99).dish.id, 'verduras');
});

test('la pantalla de sugerencias ofrece exclusiones y descarta un resultado al cambiar filtros', () => {
  const html = renderSuggestions({ ...state, suggestionExcludeTags: ['bebida','postre'] });
  assert.match(html, /Excluir etiquetas/);
  assert.match(html, /data-action="suggestion-exclude-tag" data-value="bebida" aria-pressed="true"/);
  assert.match(html, /2 recetas disponibles/);
  assert.match(html, /data-action="suggestion-clear"/);
});
