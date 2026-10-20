import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, getMonday, currentMexicoDate, cycleStartForDate, createCycle, DEFAULT_DAY_TYPES, dateToEpochDay } from '../src/utils/dates.js';
import { normalizeText, escapeHtml } from '../src/utils/html.js';

test('lunes de referencia y ciclos consecutivos de catorce días', () => {
  assert.equal(getMonday('2026-10-22'), '2026-10-19');
  assert.equal(cycleStartForDate('2026-10-19'), '2026-10-19');
  assert.equal(cycleStartForDate('2026-11-01'), '2026-10-19');
  assert.equal(cycleStartForDate('2026-11-02'), '2026-11-02');
  assert.equal(cycleStartForDate('2026-10-18'), '2026-10-05');
});

test('ciclos representan 14 días, con cinco antojos y nueve días libres', () => {
  const cycle = createCycle('2026-10-19');
  assert.equal(cycle.endDate, '2026-11-01');
  assert.equal(cycle.days.length, 14);
  assert.equal(cycle.days.filter((d) => d.type === 'wish').length, 5);
  assert.equal(cycle.days.filter((d) => d.type === 'healthy').length, 0);
  assert.equal(cycle.days.filter((d) => d.type === 'free').length, 9);
  assert.equal(new Set(cycle.days.map((d) => d.date)).size, 14);
  assert.equal(cycle.days[0].date, '2026-10-19');
});

test('cambio de mes, año y año bisiesto sin desplazar un día', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.throws(() => dateToEpochDay('2026-02-29'));
  assert.throws(() => dateToEpochDay('2026-13-01'));
});

test('México CDMX usa la fecha correcta al cruzar la medianoche UTC', () => {
  assert.equal(currentMexicoDate(new Date('2026-10-19T04:30:00Z')), '2026-10-18');
  assert.equal(currentMexicoDate(new Date('2026-10-19T06:30:00Z')), '2026-10-19');
});

test('plantilla del calendario rechaza tamaños y tipos inválidos', () => {
  assert.throws(() => createCycle('2026-10-20'));
  assert.throws(() => createCycle('2026-10-19', ['wish']));
  assert.throws(() => createCycle('2026-10-19', [...DEFAULT_DAY_TYPES.slice(0, -1), 'other']));
});

test('la búsqueda ignora acentos y mayúsculas y las etiquetas se escapan', () => {
  assert.equal(normalizeText('  ÓRÉGANO '), 'oregano');
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});
