import { pageHeader } from '../components/layout.js';
import { escapeHtml, normalizeText } from '../utils/html.js';
import { currentMexicoDate, cycleStartForDate, formatDate, addDays } from '../utils/dates.js';
import { wishCanEdit, wishEditDeadline, MAX_WISH_DISHES, MAX_WISH_NOTE } from '../utils/wishValidation.js';

const h = escapeHtml;
const statusLabels = { pending: 'Pendiente', selected: 'Registrado', scheduled: 'Programado', declined: 'Renunció' };

function findScheduledDay(cycle, uid) {
  return cycle?.days?.find(d => d.type === 'wish' && d.wishUserId === uid)?.date;
}
function statusFor(wish, date) {
  if (wish?.status === 'declined') return 'declined';
  if (wish?.status === 'selected') return date ? 'scheduled' : 'selected';
  return 'pending';
}
function picker(state) {
  const draft = state.wishDraft;
  const q = normalizeText(state.wishSearch || '');
  const available = state.dishes.filter(d => d.status === 'active' && normalizeText(d.name).includes(q));
  const selected = draft.selection.map(id => {
    const dish = state.dishes.find(d => d.id === id);
    return { id, name: dish?.name || draft.newNames[id] || 'Platillo no disponible' };
  });
  return `<section class="surface-card wish-editor" id="wish-editor">
    <div class="section-top"><h2>Mi antojo</h2><button type="button" class="btn btn-outline btn-small" data-action="wish-cancel">Cancelar</button></div>
    <p class="muted-label">Elige los platillos que te gustaría comer juntos.</p>
    <div class="wish-picked"><strong>Mi selección (${selected.length}/${MAX_WISH_DISHES})</strong>
    ${selected.length ? `<div class="wish-picked-list">${selected.map(d => `<button type="button" data-action="wish-remove-dish" data-value="${h(d.id)}" class="wish-picked-tag">${h(d.name)} <span aria-label="Quitar">×</span></button>`).join('')}</div>` : '<p class="muted-label">Todavía no has elegido platillos.</p>'}</div>
    <label class="dish-field"><span>Buscar platillos</span><input id="wish-search" type="search" autocomplete="off" placeholder="Buscar en el recetario..." value="${h(state.wishSearch || '')}"></label>
    <div class="wish-options">${available.length ? available.map(d => `<button type="button" data-action="wish-toggle-dish" data-value="${h(d.id)}" class="wish-option ${draft.selection.includes(d.id) ? 'is-selected' : ''}" aria-pressed="${draft.selection.includes(d.id)}"><span>${h(d.name)}</span><span>${draft.selection.includes(d.id) ? 'Seleccionado ✓' : 'Agregar +'}</span></button>`).join('') : '<p class="muted-label">No hay platillos que coincidan.</p>'}</div>
    ${state.dishes.length >= state.recipePageSize ? '<button type="button" class="btn btn-outline btn-small" data-action="dish-more">Mostrar más platillos</button>' : ''}
    <form data-form="wish-quick-dish" class="wish-quick-add"><label for="wish-new-name">¿Falta algún platillo?</label><div class="wish-quick-row"><input required maxlength="100" name="name" id="wish-new-name" placeholder="Nombre del nuevo platillo"><button type="submit" class="btn btn-outline">Agregar al recetario</button></div><p class="muted-label">Se añadirá también a tu selección.</p></form>
    <form data-form="wish" class="wish-save-form"><div class="dish-field"><label for="wish-note">Nota (opcional)</label><textarea id="wish-note" name="note" rows="3" maxlength="${MAX_WISH_NOTE}" placeholder="Ej. Sin cebolla">${h(draft.note)}</textarea></div><div class="wish-editor-buttons"><button type="submit" class="btn btn-primary" ${!draft.selection.length ? 'disabled' : ''}>Guardar mi antojo</button><button type="button" class="btn btn-outline" data-action="wish-decline">No quiero antojo este ciclo</button></div></form>
  </section>`;
}
export function renderWishes(state) {
  const cycleId = cycleStartForDate(currentMexicoDate(), state.config?.anchorMonday);
  const cycle = state.cycle;
  const isAdmin = state.profile?.role === 'admin';
  const ready = Boolean(cycle?.endAt);
  const editable = wishCanEdit(cycle, state.user.uid);
  const mine = (state.wishes || []).find(w => w.userId === state.user.uid);
  const deadline = wishEditDeadline(cycle, state.user.uid);
  const cards = (state.familyUsers || []).map(u => {
    const wish = state.wishes?.find(w => w.userId === u.uid);
    const scheduled = findScheduledDay(cycle, u.uid);
    const status = statusFor(wish, scheduled);
    const own = state.user.uid === u.uid;
    const meals = wish?.status === 'selected' ? (wish.dishes || []).map(d => d.nameSnapshot) : [];
    return `<article class="wish-card ${own ? 'wish-card-mine' : ''}"><div class="wish-user"><span class="wish-avatar">${h(u.displayName?.[0]?.toUpperCase() || 'U')}</span><div><h3>${h(u.displayName || u.username)}</h3><span>${own ? 'Mi antojo' : '@' + h(u.username)}</span></div><span class="pill ${status === 'selected' || status === 'scheduled' ? 'wish' : 'neutral'}">${statusLabels[status]}</span></div>
      <div class="wish-selection">${meals.length ? `<strong>${meals.map(h).join(' + ')}</strong>${wish.note ? `<small>Nota: ${h(wish.note)}</small>` : ''}` : `<span>${status === 'declined' ? 'No desea antojo este ciclo.' : 'Aún no hay platillos seleccionados.'}</span>`}
      ${scheduled ? `<small>Fecha: ${h(formatDate(scheduled, true))}</small>` : ''}</div>
      ${own && ready && editable && !state.wishDraft ? `<button type="button" class="btn btn-outline btn-small wish-edit-button" data-action="wish-edit">${status === 'pending' ? 'Elegir mi antojo' : 'Cambiar mi elección'}</button>` : ''}</article>`;
  }).join('');
  return `${pageHeader('ANTOJOS DE FAMILIA', 'Un antojo por persona', 'Una elección por integrante en cada ciclo de dos semanas.')}
    ${state.wishNotice ? `<p class="notice-text" role="status">${h(state.wishNotice)}</p>` : ''}
    <div class="section-top spaced"><div><h2>${h(formatDate(cycleId))} – ${h(formatDate(cycle?.endDate || addDays(cycleId, 13)))}</h2><p class="muted-label">Selecciones del ciclo actual</p></div><span class="pill neutral">${(state.familyUsers || []).length} integrantes</span></div>
    ${!ready ? `<section class="surface-card wish-opening"><p>La selección de este ciclo todavía no está abierta.</p>${isAdmin ? `<button type="button" class="btn btn-primary" data-action="wish-open-cycle">Abrir selección de antojos</button>` : ''}</section>` : `
      ${editable && deadline ? `<p class="muted-label wish-deadline">Puedes cambiar tu elección hasta ${h(new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(deadline.getTime() - 60000)))}.</p>` : (mine ? '<p class="muted-label wish-deadline">La elección de este ciclo ya está cerrada.</p>' : '')}
      ${state.wishDraft && editable ? picker(state) : ''}
      ${cards ? `<div class="wish-grid">${cards}</div>` : '<section class="surface-card"><p>Aún no hay integrantes activos.</p></section>'}
    `}`;
}
