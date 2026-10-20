import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCycle, addDays } from '../src/utils/dates.js';
import { assertPlanningCycle, moveDayContent, editPlannedDay, withPlanningDeadlines, templateForFuture, changeRequiresHistoryConfirmation } from '../src/utils/cyclePlanning.js';
import { wishCanEdit } from '../src/utils/wishValidation.js';

const monday = '2026-10-19';
const initial = () => createCycle(monday);
const ana = { uid: 'ana', status: 'active', displayName: 'Ana' };
const juan = { uid: 'juan', status: 'active', displayName: 'Juan' };
const early = new Date('2026-10-19T15:00:00Z');

test('el calendario admite intercambio completo entre semanas sin mover la fecha en sí', () => {
  const cycle = initial();
  cycle.days[1].wishUserId = 'ana';
  cycle.days[0].healthyDishes = [{ dishId: 'arroz', nameSnapshot: 'Arroz' }];
  const swapped = moveDayContent(cycle, '2026-10-19', '2026-10-27');
  assert.equal(swapped.days[8].type, 'free');
  assert.equal(swapped.days[8].healthyDishes[0].nameSnapshot, 'Arroz');
  assert.equal(swapped.days[0].date, '2026-10-19');
  assert.equal(swapped.days[0].type, 'free'); // ambas fechas eran libres
  assert.equal(cycle.days[0].healthyDishes[0].nameSnapshot, 'Arroz'); // original intacto
});

test('intercambio mueve fecha de antojo, integrante y selección, sin duplicarla', () => {
  const cycle = initial();
  cycle.days[1].wishUserId = 'ana';
  const next = moveDayContent(cycle, '2026-10-20', '2026-10-26');
  assert.equal(next.days[7].wishUserId, 'ana');
  assert.equal(next.days[7].type, 'wish');
  assert.equal(next.days[1].type, 'wish'); // el día destino era antojo
  assert.equal(next.days[1].wishUserId, null);
  assert.equal(next.days.filter(d => d.wishUserId === 'ana').length, 1);
});

test('solo asigna un espacio por persona; rechazo de duplicados y no activos', () => {
  const cycle = initial();
  const next = editPlannedDay(cycle, '2026-10-20', { type: 'wish', wishUserId: 'ana' }, [ana, juan]);
  assert.throws(() => editPlannedDay(next, '2026-10-22', { type: 'wish', wishUserId: 'ana' }, [ana, juan]), /dos antojos/);
  assert.throws(() => editPlannedDay(next, '2026-10-22', { type: 'wish', wishUserId: 'inactive' }, [ana, juan]), /integrante activo/);
});

test('una comida libre puede contener varios platillos de distintas categorías', () => {
  const dishes = ['Pechuga', 'Arroz', 'Calabacitas'].map((nameSnapshot, index) => ({ dishId: 'id' + index, nameSnapshot }));
  const edited = editPlannedDay(initial(), '2026-10-19', { type: 'free', healthyDishes: dishes }, [ana]);
  assert.deepEqual(edited.days[0].healthyDishes, dishes);
  assert.throws(() => editPlannedDay(edited, '2026-10-19', { type: 'healthy', healthyDishes: [dishes[0], dishes[0]] }, [ana]), /repitas/);
  assert.equal(edited.days[0].healthyDishes.length, 3);
});

test('cambiar día a libre limpia platillos y propietario pero no cambia los demás', () => {
  const cycle = initial(); cycle.days[1].wishUserId = 'ana';
  const next = editPlannedDay(cycle, '2026-10-20', { type: 'free' }, [ana]);
  assert.equal(next.days[1].wishUserId, null);
  assert.deepEqual(next.days[1].healthyDishes, []);
  assert.equal(next.days[1].type, 'free');
  assert.equal(cycle.days[1].type, 'wish');
});

test('fecha asignada: corte exacto al inicio del día local de preparación', () => {
  const cycle = initial(); cycle.days[1].wishUserId = 'ana';
  const updated = withPlanningDeadlines(cycle, cycle, early);
  assert.equal(updated.wishDeadlines.ana.toISOString(), '2026-10-20T06:00:00.000Z');
  assert.equal(wishCanEdit(updated, 'ana', new Date('2026-10-20T05:59:59Z')), true);
  assert.equal(wishCanEdit(updated, 'ana', new Date('2026-10-20T06:00:00Z')), false);
});

test('mover a una fecha futura no vuelve a abrir un antojo ya vencido', () => {
  const cycle = initial(); cycle.days[1].wishUserId = 'ana';
  const first = withPlanningDeadlines(cycle, cycle, early);
  const moved = moveDayContent(first, '2026-10-20', '2026-10-26');
  const next = withPlanningDeadlines(first, moved, new Date('2026-10-20T17:00:00Z'));
  assert.equal(next.lockedWishes.includes('ana'), true);
  assert.equal(wishCanEdit(next, 'ana', new Date('2026-10-20T18:00:00Z')), false);
});

test('cambio a fecha más próxima reduce el plazo inmediatamente', () => {
  const cycle = initial(); cycle.days[9].wishUserId = 'ana';
  const first = withPlanningDeadlines(cycle, cycle, early);
  const swapped = moveDayContent(first, '2026-10-28', '2026-10-20');
  const next = withPlanningDeadlines(first, swapped, early);
  assert.equal(next.wishDeadlines.ana.toISOString(), '2026-10-20T06:00:00.000Z');
});

test('plantilla futura admite días libres y fin de semana, máximo cinco antojos', () => {
  assert.equal(templateForFuture(['free', ...Array(13).fill('healthy')]).length, 14);
  assert.throws(() => templateForFuture(Array(14).fill('wish')), /cinco/);
  assert.throws(() => templateForFuture(['healthy']), /14/);
});

test('ediciones de histórico exigen confirmación adicional', () => {
  assert.equal(changeRequiresHistoryConfirmation(initial(), ['2026-10-19'], '2026-10-20'), true);
  assert.equal(changeRequiresHistoryConfirmation(initial(), ['2026-10-20'], '2026-10-20'), false);
});

test('un ciclo antiguo con días healthy conserva platillos y pasa a Libre al editar', () => {
  const cycle = initial();
  cycle.days[0].type = 'healthy';
  cycle.days[0].healthyDishes = [{ dishId: 'nopales', nameSnapshot: 'Nopales' }];
  const edited = editPlannedDay(cycle, '2026-10-19', { type: 'free', healthyDishes: [
    { dishId: 'nopales', nameSnapshot: 'Nopales' }, { dishId: 'mortadela', nameSnapshot: 'Mortadela' },
  ] }, [ana]);
  assert.equal(edited.days[0].type, 'free');
  assert.equal(edited.days[0].healthyDishes.length, 2);
  assert.equal(cycle.days[0].type, 'healthy');
  assert.equal(cycle.days[0].healthyDishes.length, 1);
});

test('plantillas heredadas se normalizan a Libre sin cambiar los antojos', () => {
  const template = templateForFuture(['healthy', 'wish', ...Array(12).fill('free')]);
  assert.equal(template[0], 'free');
  assert.equal(template[1], 'wish');
});
