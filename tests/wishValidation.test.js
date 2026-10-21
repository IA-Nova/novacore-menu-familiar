import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endOfCycleExclusive, mexicoMidnightUtc, normalizeWishSelection, wishCanEdit, wishEditDeadline, validateWishNote, MAX_WISH_DISHES } from '../src/utils/wishValidation.js';

test('el ciclo termina exactamente a la medianoche mexicana del lunes siguiente', () => {
  assert.equal(endOfCycleExclusive('2026-10-19').toISOString(), '2026-11-02T06:00:00.000Z');
  assert.equal(mexicoMidnightUtc('2026-10-19').toISOString(), '2026-10-19T06:00:00.000Z');
});
test('el cálculo horario también contempla cambios históricos de huso horario', () => {
  assert.equal(mexicoMidnightUtc('2021-07-01').toISOString(), '2021-07-01T05:00:00.000Z');
  assert.equal(mexicoMidnightUtc('2021-12-01').toISOString(), '2021-12-01T06:00:00.000Z');
});
test('las fechas administradas determinan límite editable y no el reloj del navegador', () => {
  const endAt = endOfCycleExclusive('2026-10-19');
  const cycle = { endAt, wishDeadlines: { 'u1': new Date('2026-10-23T06:00:00Z') }, lockedWishes: [] };
  assert.equal(wishEditDeadline(cycle,'u1').toISOString(), '2026-10-22T06:00:00.000Z');
  assert.equal(wishCanEdit(cycle, 'u1', new Date('2026-10-22T05:59:59Z')), true);
  assert.equal(wishCanEdit(cycle, 'u1', new Date('2026-10-22T06:00:00Z')), false);
  assert.equal(wishCanEdit(cycle, 'u2', new Date('2026-11-02T06:00:00Z')), false);
  assert.equal(wishCanEdit({ ...cycle, lockedWishes: ['u2'] },'u2', new Date('2026-10-20T00:00:00Z')), true);
  assert.equal(wishCanEdit(cycle, 'u1', new Date('2026-10-23T18:00:00Z'), 'pending'), true);
  const rescheduled = { ...cycle, days: [{ type: 'wish', date: '2026-10-30', wishUserId: 'u1' }], lockedWishes: ['u1'] };
  assert.equal(wishCanEdit(rescheduled, 'u1', new Date('2026-10-25T00:00:00Z')), true);
});
test('un antojo acepta varios platillos activos, sin repetirlos', () => {
  const dishes = [{id:'a',name:'Arroz',status:'active'},{id:'b',name:'Papas',status:'active'}];
  assert.deepEqual(normalizeWishSelection(['a','b','a'],dishes), [
    {dishId:'a',nameSnapshot:'Arroz'},{dishId:'b',nameSnapshot:'Papas'},
  ]);
  assert.equal(MAX_WISH_DISHES,6);
  assert.throws(() => normalizeWishSelection([],dishes));
  assert.throws(() => normalizeWishSelection(['x'],dishes));
  assert.throws(() => normalizeWishSelection(['a'],[{...dishes[0], status:'archived'}]));
});
test('nota se valida con longitud máxima y se elimina espacio final', () => {
  assert.equal(validateWishNote('  Sin cebolla  '),'Sin cebolla');
  assert.throws(() => validateWishNote('a'.repeat(251)));
});
