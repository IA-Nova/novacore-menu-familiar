import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTodayState } from '../src/utils/calendarNavigation.js';

test('Hoy vuelve al ciclo actual, modo semana, y selecciona primera semana', () => {
  assert.deepEqual(calendarTodayState('2026-10-19', '2026-10-19'), {
    cycleOffset: 0, calendarView: 'week', weekIndex: 0,
  });
});
test('Hoy vuelve a la segunda semana desde cualquier otro ciclo', () => {
  assert.deepEqual(calendarTodayState('2026-10-28', '2026-10-19'), {
    cycleOffset: 0, calendarView: 'week', weekIndex: 1,
  });
});
