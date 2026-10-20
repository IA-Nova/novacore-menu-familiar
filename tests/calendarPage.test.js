import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCalendar } from '../src/pages/calendar.js';
import { renderAdmin } from '../src/pages/admin.js';
import { createCycle } from '../src/utils/dates.js';

const cycle = createCycle('2026-10-19');
const base = { cycle, config: { anchorMonday: '2026-10-19', defaultDayTypes: cycle.days.map(d => d.type) },
  cycleOffset: 0, calendarView: 'cycle', weekIndex: 0, calendarMode: 'meal', calendarEditor: null,
  calendarOrganizeSource: null, calendarNotice: '', profile: { role: 'admin', uid: 'admin' },
  familyUsers: [{ uid: 'ana', displayName: 'Ana', status: 'active' }], dishes: [], wishes: [], recipePageSize: 24 };

test('calendario administrador tiene botón Hoy, edición de fechas y organización', () => {
  const text = renderCalendar(base);
  assert.match(text, /data-action="calendar-today"/);
  assert.match(text, /data-action="calendar-organize"/);
  assert.match(text, /data-action="calendar-day-edit"/);
  assert.doesNotMatch(text, /Firestore|pendiente de implementación|fase 5/i);
});

test('los integrantes consultan el calendario sin acciones administrativas', () => {
  const text = renderCalendar({ ...base, profile: { uid: 'ana', role: 'member' } });
  assert.doesNotMatch(text, /data-action="calendar-organize"/);
  assert.doesNotMatch(text, /data-action="calendar-day-edit"/);
});

test('la planificación sin documento presenta preparación solo al admin', () => {
  assert.match(renderCalendar({ ...base, cycle: null }), /Preparar este ciclo/);
  assert.doesNotMatch(renderCalendar({ ...base, cycle: null, profile: { role: 'member' } }), /Preparar este ciclo/);
});

test('editor de día saludable permite añadir y ordenar varios platillos', () => {
  const text = renderCalendar({ ...base, calendarEditor: { date: '2026-10-19', type: 'healthy', wishUserId: null,
    healthyDishes: [{ dishId: 'one', nameSnapshot: 'Arroz' }] },
    dishes: [{ id: 'two', name: 'Pechuga', approvedForHealthyMenu: true, status: 'active' }] });
  assert.match(text, /calendar-dish-picker/);
  assert.match(text, /Pechuga/);
  assert.match(text, /calendar-edit-save/);
});

test('administración permite editar la plantilla sin mensajes técnicos', () => {
  const text = renderAdmin({ adminUsers: [], profile: { uid: 'admin' }, config: null,
    templateDraft: { familyName: 'Mi familia', dayTypes: cycle.days.map(d => d.type) } });
  assert.match(text, /Guardar distribución/);
  assert.match(text, /Semana 2/);
  assert.doesNotMatch(text, /sin conectar|Firebase|Firestore|TODO|fase de desarrollo/i);
});

test('cualquier platillo activo se puede elegir en un día libre, sin aprobar saludable', () => {
  const text = renderCalendar({ ...base, calendarEditor: { date: '2026-10-19', type: 'free', wishUserId: null,
    healthyDishes: [{ dishId: 'nopales', nameSnapshot: 'Nopales' }] },
    dishes: [
      { id: 'nopales', name: 'Nopales', approvedForHealthyMenu: true, status: 'active' },
      { id: 'mortadela', name: 'Mortadela', approvedForHealthyMenu: false, status: 'active' },
    ] });
  assert.match(text, /Agregar platillo del recetario/);
  assert.match(text, /value="mortadela"/);
  assert.doesNotMatch(text, /Agregar platillo saludable/);
});

test('muestra hasta cuatro fotos de platillos de un día, y no sólo la primera', () => {
  const day = cycle.days[0];
  const galleryCycle = { ...cycle, days: cycle.days.map(d => d.date === day.date ? {
    ...d, type: 'free', healthyDishes: ['a','b','c','d','e'].map(id => ({ dishId: id, nameSnapshot: id.toUpperCase() }))
  } : d) };
  const text = renderCalendar({ ...base, cycle: galleryCycle,
    thumbnails: Object.fromEntries(['a','b','c','d','e'].map(id => [id, { mimeType: 'image/jpeg', base64: 'AAAA' }])) });
  const card = text.split('</article>')[0];
  assert.match(card, /calendar-photo-mosaic photos-4/);
  assert.equal((card.match(/<img loading="lazy"/g) || []).length, 4);
  assert.match(card, /alt="A"/);
  assert.match(card, /alt="D"/);
  assert.doesNotMatch(card, /alt="E"/);
  assert.match(card, /Libre/);
});

test('visualiza un día saludable heredado como Libre, sin perder su comida', () => {
  const oldCycle = { ...cycle, days: cycle.days.map((d, i) => i === 0 ? { ...d, type: 'healthy',
    healthyDishes: [{ dishId: 'nopales', nameSnapshot: 'Nopales' }] } : d) };
  const text = renderCalendar({ ...base, cycle: oldCycle });
  assert.match(text, /Nopales/);
  assert.match(text, /Libre/);
  assert.match(text, /Editar comida/);
});

test('el calendario muestra las indicaciones del antojo para quien cocina', () => {
  const day = cycle.days.find(d => d.type === 'wish');
  assert.ok(day);
  const wishCycle = { ...cycle, days: cycle.days.map(d => d.date === day.date ?
    { ...d, type: 'wish', wishUserId: 'ana', healthyDishes: [] } : d) };
  const view = renderCalendar({ ...base, cycle: wishCycle,
    wishes: [{ userId: 'ana', status: 'selected',
      dishes: [{ dishId: 'pambazo', nameSnapshot: 'Pambazos' }],
      note: 'Preparar con tinga <pollo>' }] });
  assert.match(view, /Indicaciones de preparación/);
  assert.match(view, /Preparar con tinga &lt;pollo&gt;/);
  assert.doesNotMatch(view, /<pollo>/);
});
