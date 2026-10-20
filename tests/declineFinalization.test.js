import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCycle } from '../src/utils/dates.js';
import { finalizeDeclinedWish } from '../src/utils/cyclePlanning.js';
const makeCycle = () => ({ ...createCycle('2026-10-19'), lockedWishes: [], wishDeadlines: {}, endAt: new Date('2026-11-02T06:00:00Z') });
test('una renuncia asignada libera su día como libre y bloquea la elección', () => {
  const cycle = makeCycle(); cycle.days[1].wishUserId = 'ana';
  const next = finalizeDeclinedWish(cycle, 'ana', new Date('2026-10-19T12:00:00Z'));
  assert.equal(next.days[1].type, 'free');
  assert.equal(next.days[1].wishUserId, null);
  assert.deepEqual(next.days[1].healthyDishes, []);
  assert.deepEqual(next.lockedWishes, ['ana']);
  assert.equal(cycle.days[1].type, 'wish');
});
test('renuncia sin fecha asignada bloquea solo la elección', () => {
  const cycle = makeCycle();
  const next = finalizeDeclinedWish(cycle, 'ana');
  assert.equal(next.days[1].type, 'wish');
  assert.equal(next.days[1].wishUserId, null);
  assert.deepEqual(next.lockedWishes, ['ana']);
});
test('finalizar dos veces conserva un solo bloqueo', () => {
  const cycle = makeCycle();
  assert.deepEqual(finalizeDeclinedWish(finalizeDeclinedWish(cycle, 'ana'), 'ana').lockedWishes, ['ana']);
});
