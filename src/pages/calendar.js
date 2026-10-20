import { pageHeader } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { mealForDay, visibleCycle } from '../models/menu.js';
import { currentMexicoDate, cycleStartForDate, addDays, formatDate, weekdayShort } from '../utils/dates.js';
import { escapeHtml as h } from '../utils/html.js';
import { asDataUri } from '../utils/dishPhoto.js';
import { MAX_HEALTHY_DISHES } from '../utils/cyclePlanning.js';

const dayNames = { wish: 'Antojo', free: 'Libre', healthy: 'Libre' };
const dayTypeOptions = { wish: 'Antojo', free: 'Libre' };
const isFreeDay = type => type !== 'wish';

function dayEditor(state, cycle) {
  const draft = state.calendarEditor;
  if (!draft) return '';
  const options = (state.familyUsers || []).filter(u => u.status === 'active');
  const dishes = (state.dishes || []).filter(d => d.status === 'active');
  const alreadySelected = new Set(draft.healthyDishes.map(d => d.dishId));
  const eligible = dishes.filter(d => !alreadySelected.has(d.id));
  const chosen = draft.healthyDishes.map((d, idx) => `<div class="calendar-picked-row">
    <strong>${h(d.nameSnapshot)}</strong>
    <div class="calendar-picked-actions">
      <button type="button" class="icon-button" aria-label="Subir platillo" data-action="calendar-dish-up" data-value="${h(d.dishId)}" ${idx === 0 ? 'disabled' : ''}>${icon('chevronUp')}</button>
      <button type="button" class="icon-button" aria-label="Bajar platillo" data-action="calendar-dish-down" data-value="${h(d.dishId)}" ${idx === draft.healthyDishes.length - 1 ? 'disabled' : ''}>${icon('chevronDown')}</button>
      <button type="button" class="btn btn-outline btn-small" data-action="calendar-dish-remove" data-value="${h(d.dishId)}">Quitar</button>
    </div></div>`).join('');
  return `<section class="surface-card calendar-edit-panel" id="calendar-editor">
    <div class="section-top"><div><p class="eyebrow">EDITAR DÍA</p><h2>${h(formatDate(draft.date, true))}</h2></div>
      <button type="button" class="btn btn-outline btn-small" data-action="calendar-edit-cancel">Cancelar</button></div>
    ${state.calendarMode === 'organize' ? `<div class="calendar-editor-row"><label class="dish-field"><span>Tipo de día</span><select id="calendar-day-type" aria-label="Tipo de día">
      ${Object.entries(dayTypeOptions).map(([type, label]) => `<option value="${type}" ${draft.type === type ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    ${draft.type === 'wish' ? `<label class="dish-field"><span>Integrante</span><select id="calendar-day-owner"><option value="">Por asignar</option>${options.filter(u => !state.wishes?.some(w => w.userId === u.uid && w.status === 'declined') || draft.wishUserId === u.uid).map(u => `<option value="${h(u.uid)}" ${draft.wishUserId === u.uid ? 'selected' : ''}>${h(u.displayName || u.username)}</option>`).join('')}</select></label>` : ''}</div>` : ''}
    ${isFreeDay(draft.type) && state.calendarMode === 'meal' ? `<div class="calendar-editor-food"><h3>Platillos de esta comida</h3>
      ${chosen || '<p class="muted-label">Aún no hay platillos elegidos.</p>'}
      <label class="dish-field"><span>Agregar platillo del recetario</span>
        <select id="calendar-dish-picker"><option value="">Elige un platillo...</option>${eligible.map(d => `<option value="${h(d.id)}">${h(d.name)}</option>`).join('')}</select></label>
      ${state.dishes.length >= state.recipePageSize ? '<button type="button" class="btn btn-outline btn-small" data-action="dish-more">Mostrar más platillos</button>' : ''}
      <p class="muted-label">${draft.healthyDishes.length} de ${MAX_HEALTHY_DISHES} platillos</p></div>` : ''}
    <div class="calendar-edit-actions"><button type="button" class="btn btn-primary" data-action="calendar-edit-save">Guardar día</button>
      <button type="button" class="btn btn-outline" data-action="calendar-edit-cancel">Cancelar</button></div>
  </section>`;
}

export function renderCalendar(state) {
  const anchor = cycleStartForDate(currentMexicoDate(), state.config?.anchorMonday);
  const cycleStart = addDays(anchor, state.cycleOffset * 14);
  const cycle = visibleCycle(state, cycleStart);
  const hasStoredCycle = state.cycle?.startDate === cycleStart;
  const admin = state.profile?.role === 'admin';
  const visible = state.calendarView === 'cycle' ? cycle.days : cycle.days.slice(state.weekIndex * 7, state.weekIndex * 7 + 7);
  const header = pageHeader('PLANIFICACIÓN', 'Calendario de comidas', 'Consulta y organiza las comidas de la familia.');
  const days = visible.map((day) => {
    const meal = mealForDay(day, state);
    const daySelected = state.calendarOrganizeSource === day.date;
    const wish = day.type === 'wish' ? state.wishes?.find(w => w.userId === day.wishUserId) : null;
    const dishItems = day.type === 'wish' ? (wish?.status === 'selected' ? wish.dishes || [] : []) : day.healthyDishes || [];
    const photos = dishItems.map(item => ({ name: item.nameSnapshot, src: asDataUri(state.thumbnails?.[item.dishId]) }))
      .filter(item => item.src).slice(0, 4);
    const photoMosaic = photos.length ? `<div class="calendar-photo-mosaic photos-${photos.length}" role="group" aria-label="Fotos de ${h(meal.title)}">
      ${photos.map(photo => `<img loading="lazy" src="${photo.src}" alt="${h(photo.name)}">`).join('')}</div>` : '';
    return `<article class="day-card ${day.type === 'wish' ? 'wish' : 'free'} ${dishItems.length ? 'has-menu' : ''} ${day.date === currentMexicoDate() ? 'today' : ''} ${daySelected ? 'calendar-source-selected' : ''}">
      <div class="day-head"><div><span class="day-weekday">${weekdayShort(day.date)}</span><strong>${day.date.slice(-2)}</strong><small>${formatDate(day.date).split(' ')[2]}</small></div>
      <span class="pill ${day.type === 'wish' ? 'wish' : 'free'}">${icon(day.type === 'wish' ? 'heart' : 'utensils', 15)} ${dayNames[day.type]}</span></div>
      ${photoMosaic}
      <h3>${h(meal.title)}</h3><p>${h(meal.description)}</p>
      ${wish?.status === 'selected' && wish.note ? `<div class="wish-preparation-note" role="note"><strong>Indicaciones de preparación</strong><p>${h(wish.note)}</p></div>` : ''}
      ${day.date === currentMexicoDate() ? '<span class="today-tag">Hoy</span>' : ''}
      ${admin && hasStoredCycle ? (state.calendarMode === 'organize' ? `<button type="button" class="btn btn-outline btn-small calendar-day-button" data-action="calendar-day-select" data-value="${day.date}">${daySelected ? 'Origen seleccionado' : state.calendarOrganizeSource ? 'Intercambiar con este día' : 'Seleccionar día'}</button><button type="button" class="btn btn-outline btn-small calendar-day-button" data-action="calendar-day-edit" data-value="${day.date}">Tipo y asignación</button>` : (isFreeDay(day.type) ? `<button type="button" class="btn btn-outline btn-small calendar-day-button" data-action="calendar-day-edit" data-value="${day.date}">Editar comida</button>` : '')) : ''}
    </article>`;
  }).join('');
  const periodText = state.calendarView === 'cycle'
    ? `${formatDate(cycleStart)} – ${formatDate(cycle.endDate)}`
    : `${formatDate(visible[0].date)} – ${formatDate(visible[visible.length - 1].date)}`;
  return `${header}${state.calendarNotice ? `<p class="notice-text" role="status">${h(state.calendarNotice)}</p>` : ''}
    <section class="surface-card calendar-panel">
      <div class="calendar-toolbar"><div><span class="eyebrow">PERIODO SELECCIONADO</span><h2>${periodText}</h2></div>
        <div class="calendar-actions"><div class="segmented" aria-label="Vista de calendario">
          <button type="button" data-action="calendar-view" data-value="week" class="${state.calendarView === 'week' ? 'selected' : ''}" aria-pressed="${state.calendarView === 'week'}">Semana</button>
          <button type="button" data-action="calendar-view" data-value="cycle" class="${state.calendarView === 'cycle' ? 'selected' : ''}" aria-pressed="${state.calendarView === 'cycle'}">2 semanas</button>
        </div><button type="button" class="today-button" data-action="calendar-today">${icon('calendar', 15)} Hoy</button>
        <div class="switchers"><button aria-label="Periodo anterior" class="icon-button" data-action="calendar-prev">${icon('chevronLeft')}</button>
          <button aria-label="Periodo siguiente" class="icon-button" data-action="calendar-next">${icon('chevronRight')}</button></div></div></div>
      ${admin ? (!hasStoredCycle ? `<div class="calendar-admin-tools"><button class="btn btn-primary" data-action="calendar-open-cycle">Preparar este ciclo</button></div>` :
        `<div class="calendar-admin-tools"><button type="button" class="btn ${state.calendarMode === 'organize' ? 'btn-primary' : 'btn-outline'}" data-action="calendar-organize">${state.calendarMode === 'organize' ? 'Editar comida' : 'Organizar días'}</button>
        <span class="muted-label">${state.calendarMode === 'organize' ? (state.calendarOrganizeSource ? 'Selecciona el destino, o configura el tipo y el integrante de un día.' : 'Selecciona dos días para intercambiar, o configura un día.') : 'Selecciona un día libre para elegir sus platillos.'}</span></div>`) : ''}
      <div class="calendar-legend"><span>${icon('utensils', 15)} Libre</span><span>${icon('heart', 15)} Antojo</span></div>
      <div class="calendar-grid">${days}</div>
    </section>
    ${admin && hasStoredCycle && state.calendarEditor?.date && cycle.days.some(d => d.date === state.calendarEditor.date) ? dayEditor(state, cycle) : ''}`;
}
