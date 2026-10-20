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
