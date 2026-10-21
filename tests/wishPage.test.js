import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWishes } from '../src/pages/wishes.js';
import { createCycle, currentMexicoDate, cycleStartForDate } from '../src/utils/dates.js';
import { endOfCycleExclusive } from '../src/utils/wishValidation.js';
function model() {
  const start = cycleStartForDate(currentMexicoDate());
  const cycle = { ...createCycle(start), endAt: endOfCycleExclusive(start), wishDeadlines: {}, lockedWishes: [] };
  return { user: { uid: 'admin-uid' }, profile: { role: 'admin' },
    familyUsers: [{ uid: 'admin-uid', username: 'ianova', displayName: 'IANova' }],
    wishes: [], dishes: [], wishDraft: null, wishNotice: '', cycle, config: { anchorMonday: '2026-10-19' }, recipePageSize: 24 };
}
test('Antojos es una pantalla familiar, sin notas de desarrollo', () => {
  const page = renderWishes(model());
  assert.match(page, /Elegir mi antojo/);
  assert.doesNotMatch(page, /Firestore|Firebase|Fase 4|pendiente de desarrollo|conecte el servicio/i);
});
test('el editor usa varios platillos y botón de renuncia', () => {
  const state = model();
  state.wishDraft = { selection: ['a'], note: 'Poco picante', newNames: {} };
  state.dishes = [{ id: 'a', name: 'Enchiladas', status: 'active' }];
  const page = renderWishes(state);
  assert.match(page, /Enchiladas/);
  assert.match(page, /No quiero antojo este ciclo/);
  assert.match(page, /Poco picante/);
  assert.match(page, /Guardar mi antojo/);
});
test('miembro no puede abrir ciclo, pero administrador sí', () => {
  const state = model();
  state.cycle = null;
  assert.match(renderWishes(state), /Abrir selección de antojos/);
  state.profile.role = 'member';
  assert.doesNotMatch(renderWishes(state), /Abrir selección de antojos/);
});

test('una nota de preparación es visible para toda la familia y se escapa HTML', () => {
  const state = model();
  state.wishes = [{ userId: 'admin-uid', status: 'selected',
    dishes: [{ dishId: 'pambazo', nameSnapshot: 'Pambazos' }],
    note: 'Preparar versión de tinga <sin picante>' }];
  const page = renderWishes(state);
  assert.match(page, /Indicaciones de preparación/);
  assert.match(page, /Preparar versión de tinga &lt;sin picante&gt;/);
  assert.doesNotMatch(page, /<sin picante>/);
});
test('el formulario explica que las notas son para quien prepara el antojo', () => {
  const state = model();
  state.wishDraft = { selection: ['pambazo'], note: 'Preparar la versión de tinga', newNames: {} };
  state.dishes = [{ id: 'pambazo', name: 'Pambazos', status: 'active' }];
  const page = renderWishes(state);
  assert.match(page, /Indicaciones para preparar el antojo/);
  assert.match(page, /Preparar la versión de tinga/);
});


test('el selector de antojo excluye Postre y Bebida sin quitar lo ya elegido', () => {
  const state = model();
  state.wishDraft = { selection:['crepas'], note:'', newNames:{} };
  state.dishes = [
    {id:'crepas',name:'Crepas',status:'active',tags:['postre']},
    {id:'jamaica',name:'Agua de jamaica',status:'active',tags:['bebida']},
    {id:'tinga',name:'Tinga',status:'active',tags:[]},
  ];
  state.wishExcludeTags = ['postre','bebida'];
  const html = renderWishes(state);
  assert.match(html, /data-action="wish-exclude-tag" data-value="postre" aria-pressed="true"/);
  assert.match(html, /Mi selección \(1\/6\)/);
  assert.match(html, /data-action="wish-remove-dish" data-value="crepas"/);
  assert.doesNotMatch(html, /data-action="wish-toggle-dish" data-value="crepas"/);
  assert.doesNotMatch(html, /data-action="wish-toggle-dish" data-value="jamaica"/);
  assert.match(html, /data-action="wish-toggle-dish" data-value="tinga"/);
});

test('muestra el botón de edición cuando la elección no está programada aunque hubiera bloqueo anterior', () => {
  const state = model();
  state.cycle.lockedWishes = ['admin-uid'];
  const html = renderWishes(state);
  assert.match(html, /Elegir mi antojo/);
  assert.doesNotMatch(html, /La elección de este ciclo ya está cerrada/);
});

test('permitir el primer antojo aun si el calendario reservó su fecha para mañana', () => {
  const state = model();
  const today = currentMexicoDate();
  state.cycle.days[1].wishUserId = 'admin-uid';
  state.cycle.days[1].date = today; // La UI no debe deducir un bloqueo para un antojo todavía pendiente.
  state.cycle.wishDeadlines['admin-uid'] = new Date('2025-01-01T00:00:00Z');
  assert.match(renderWishes(state), /Elegir mi antojo/);
});
