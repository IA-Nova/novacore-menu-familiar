import { pageHeader, emptyIllustration } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { normalizeText, escapeHtml } from '../utils/html.js';
import { asDataUri } from '../utils/dishPhoto.js';
import { dishVoteSummary } from '../utils/dishVotes.js';
import { matchesDishTags, cleanTagSelection } from '../utils/dishTags.js';
import { renderAdminDishImport } from './adminImport.js';

const h = escapeHtml;
const photoBlock = (photo, name) => {
  const src = asDataUri(photo);
  return src ? `<img class="dish-photo" loading="lazy" src="${src}" alt="Fotografía de ${h(name)}">` : emptyIllustration();
};
// Las recetas activas son colaborativas; solo el admin gestiona la clasificación saludable y el archivo.
const canEdit = (dish, state) => state.profile?.role === 'admin' ||
  (state.profile?.status === 'active' && dish.status === 'active');
const authorName = (dish, state) => state.familyUsers.find(u => u.uid === dish.createdBy)?.displayName || 'Integrante de la familia';
function dishForm(dish, isNew = false, selectedFile = null, admin = false) {
  const value = key => h(dish?.[key] ?? '');
  const isDraft = dish && !Array.isArray(dish.tags);
  const hasTag = tag => isDraft ? dish?.[`tag${tag[0].toUpperCase() + tag.slice(1)}`] === 'on'
    : (dish?.tags || []).some(t => normalizeText(t) === tag);
  const extraTags = Array.isArray(dish?.tags)
    ? dish.tags.filter(t => !['postre','bebida'].includes(normalizeText(t))).join(', ')
    : (dish?.tags || '');
  const healthyChecked = dish?.approvedForHealthyMenu === true || dish?.approvedForHealthyMenu === 'on';
  return `<section class="surface-card dish-editor" id="dish-editor"><div class="section-top"><h2>${isNew ? 'Agregar platillo' : 'Editar platillo'}</h2><button type="button" class="btn btn-outline btn-small" data-action="dish-cancel">Cancelar</button></div>
    <form data-form="dish" class="dish-form"><div class="dish-field"><label for="dish-name">Nombre del platillo *</label><input required maxlength="100" id="dish-name" name="name" placeholder="Ej. Arroz rojo" value="${value('name')}"></div>
    <div class="dish-field"><label for="dish-photo">Foto (opcional)</label><input id="dish-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" ><small id="dish-photo-status">${selectedFile ? h(selectedFile.name) : dish?.hasPhoto ? 'Puedes elegir una foto nueva para reemplazar la actual.' : 'Desde tu teléfono puedes elegir una foto o abrir la cámara.'}</small></div>
    <fieldset class="dish-categories"><legend>Clasificación</legend>
      ${admin ? `<label class="dish-choice"><input type="checkbox" name="approvedForHealthyMenu" ${healthyChecked ? 'checked' : ''}><span>Saludable</span></label>` : healthyChecked ? '<span class="pill healthy">Saludable</span>' : ''}
      <label class="dish-choice"><input type="checkbox" name="tagPostre" ${hasTag('postre') ? 'checked' : ''}><span>Postre</span></label>
      <label class="dish-choice"><input type="checkbox" name="tagBebida" ${hasTag('bebida') ? 'checked' : ''}><span>Bebida</span></label>
    </fieldset>
    <details class="dish-extra" ${!isNew ? 'open' : ''}><summary>Agregar más detalles</summary><div class="dish-form-grid">
    <div class="dish-field"><label for="dish-description">Descripción</label><textarea id="dish-description" maxlength="1000" name="description" rows="2">${value('description')}</textarea></div>
    <div class="dish-field"><label for="dish-ingredients">Ingredientes</label><textarea id="dish-ingredients" maxlength="5000" name="ingredientsText" rows="4">${value('ingredientsText')}</textarea></div>
    <div class="dish-field"><label for="dish-instructions">Instrucciones</label><textarea id="dish-instructions" maxlength="8000" name="instructionsText" rows="5">${value('instructionsText')}</textarea></div>
    <div class="dish-field"><label for="dish-prep">Tiempo aproximado (minutos)</label><input id="dish-prep" name="prepMinutes" type="number" min="1" max="1440" value="${value('prepMinutes')}"></div>
    <div class="dish-field"><label for="dish-tags">Otras etiquetas (separadas por coma)</label><input id="dish-tags" name="tags" value="${h(extraTags)}" placeholder="Ej. casero, mexicano"></div></div></details>
    <button class="btn btn-primary" type="submit">${isNew ? 'Guardar platillo' : 'Guardar cambios'}</button></form></section>`;
}
// Las acciones de voto quedan fuera del botón que abre una receta, para evitar botones anidados.
function dishVoteControls(dish, state, compact = false) {
  const { likes, dislikes, userVote } = dishVoteSummary(dish.id, state.dishVotes, state.familyUsers, state.user?.uid);
  const busy = state.voteBusyDishId === dish.id;
  const archived = dish.status !== 'active';
  const loaded = state.dishVotesLoaded !== false && (state.familyUsers || []).some(u => u.uid === state.user?.uid && u.status === 'active');
  const action = (kind, count, label) => `<button type="button" class="dish-vote-button ${userVote === kind ? 'is-voted' : ''}"
    data-action="dish-vote" data-value="${h(dish.id)}" data-vote="${kind}"
    aria-pressed="${userVote === kind}" aria-label="${label}: ${count}${userVote === kind ? '. Tu voto actual. Pulsa para retirarlo' : ''}"
    ${busy || archived || !loaded ? 'disabled' : ''}>${icon(kind === 'like' ? 'thumbsUp' : 'thumbsDown', 16)}<span>${count}</span></button>`;
  return `<div class="dish-votes ${compact ? 'dish-votes-compact' : ''}" role="group" aria-label="Opiniones de la familia sobre ${h(dish.name)}">
    ${action('like', likes, 'Me gusta')}${action('dislike', dislikes, 'No me gusta')}${busy ? '<span class="dish-votes-pending" role="status">Guardando…</span>' : ''}
  </div>`;
}
function dishDetail(dish, state) {
  return `<section class="surface-card dish-detail" id="dish-detail"><div class="section-top"><h2>${h(dish.name)}</h2><button type="button" class="btn btn-outline btn-small" data-action="dish-close">Cerrar</button></div>
    <div class="dish-detail-grid">${photoBlock(state.fullDishPhoto?.id === dish.id ? state.fullDishPhoto.photo : state.thumbnails[dish.id], dish.name)}
    <div class="dish-detail-content"><p class="muted-label">Agregado por ${h(authorName(dish, state))}</p>
    <span class="pill ${dish.approvedForHealthyMenu ? 'healthy' : 'neutral'}">${dish.approvedForHealthyMenu ? 'Saludable' : 'Sin marca saludable'}</span>
    ${dish.description ? `<p>${h(dish.description)}</p>` : ''}
    ${dish.prepMinutes ? `<p>${icon('clock', 16)} ${dish.prepMinutes} minutos</p>` : ''}
    ${dish.ingredientsText ? `<h3>Ingredientes</h3><p class="preformatted">${h(dish.ingredientsText)}</p>` : ''}
    ${dish.instructionsText ? `<h3>Preparación</h3><p class="preformatted">${h(dish.instructionsText)}</p>` : ''}
    ${(dish.tags || []).length ? `<div class="recipe-tags">${dish.tags.map(t => `<span>${h(t)}</span>`).join('')}</div>` : ''}
    ${dishVoteControls(dish, state)}
    <div class="dish-actions">${canEdit(dish, state) ? `<button class="btn btn-outline btn-small" data-action="dish-edit" data-value="${h(dish.id)}">Editar</button>` : ''}
    ${state.profile.role === 'admin' ? `<button class="btn btn-outline btn-small" data-action="dish-healthy" data-value="${h(dish.id)}">${dish.approvedForHealthyMenu ? 'Quitar de saludables' : 'Aprobar saludable'}</button><button class="btn btn-outline btn-small" data-action="dish-archive" data-value="${h(dish.id)}">${dish.status === 'active' ? 'Archivar' : 'Reactivar'}</button>` : ''}</div></div></div></section>`;
}
// Filtrar el catálogo completo antes de limitar la cantidad de tarjetas mostradas.
// Las categorías y las etiquetas personalizadas usan la misma selección combinable.
const recipeCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const selectedRecipeTags = (state) => Array.isArray(state.recipeTags) ? state.recipeTags :
  (state.recipeTag ? [state.recipeTag] : []); // Compatibilidad con vistas antiguas.

export function availableRecipeTags(dishes) {
  const distinct = new Map();
  for (const dish of dishes || []) {
    if (dish.status !== 'active') continue;
    for (const tag of dish.tags || []) {
      const key = normalizeText(tag);
      if (key && !['postre', 'bebida', 'saludable'].includes(key) && !distinct.has(key)) {
        distinct.set(key, String(tag).trim());
      }
    }
  }
  return [...distinct.values()].sort(recipeCollator.compare);
}

export function matchingRecipeDishes(state) {
  const search = normalizeText(state.recipeQuery || '');
  const filters = cleanTagSelection(selectedRecipeTags(state));
  const excluded = cleanTagSelection(state.recipeExcludeTags);
  const matchAny = state.recipeMatchMode === 'any';
  const scope = state.recipeFilter || 'all';
  const admin = state.profile?.role === 'admin';
  const filtered = (state.dishes || []).filter(d => {
    if (scope === 'archived') {
      if (!admin || d.status !== 'archived') return false;
    } else if (d.status !== 'active') return false;
    if (scope === 'mine' && d.createdBy !== state.user?.uid) return false;
    if (scope === 'healthy' && !d.approvedForHealthyMenu) return false; // Compatibilidad.
    if (!normalizeText(d.name).includes(search)) return false;
    return matchesDishTags(d, filters, matchAny ? 'any' : 'all', excluded);
  });
  // Firestore devuelve el catálogo por fecha descendente; solo se ordena cuando se solicita.
  if (state.recipeSort === 'recent') return filtered;
  const direction = state.recipeSort === 'za' ? -1 : 1;
  return filtered.sort((a, b) => direction * (recipeCollator.compare(a.name || '', b.name || '') ||
    String(a.id || '').localeCompare(String(b.id || ''))));
}
export function visibleRecipeDishes(state) {
  return matchingRecipeDishes(state).slice(0, state.recipePageSize);
}
export function renderRecipes(state) {
  const matches = matchingRecipeDishes(state);
  const dishes = matches.slice(0, state.recipePageSize);
  const savedEditor = state.recipeEditor && state.recipeEditor !== 'new' ? state.dishes.find(d => d.id === state.recipeEditor) : null;
  const editor = state.recipeDraft ?? savedEditor;
  const detail = state.dishes.find(d => d.id === state.recipeDetailId);
  const listView = state.recipeView === 'list';
  const cards = dishes.map(dish => {
    const name = h(dish.name);
    const photo = photoBlock(state.thumbnails[dish.id], dish.name);
    const badge = `<span class="pill ${dish.approvedForHealthyMenu ? 'healthy' : 'neutral'}">${dish.status === 'archived' ? 'Archivado' : dish.approvedForHealthyMenu ? icon('utensils', 13) + ' Saludable' : 'Sin marca saludable'}</span>`;
    const labels = `<div class="recipe-tags">${(dish.tags || []).map(t => `<span>${h(t)}</span>`).join('')}</div>`;
    const opening = `<button class="dish-card-open" type="button" data-action="dish-detail" data-value="${h(dish.id)}" aria-label="Ver ${name}">`;
    if (listView) {
      return `<article class="recipe-card compact">${opening}
        <div class="recipe-list-media">${photo}</div>
        <div class="recipe-content">
          <h3>${name}</h3>
          ${dish.description ? `<p class="recipe-list-description">${h(dish.description)}</p>` : ''}
          <div class="recipe-list-badges">${badge}${dish.prepMinutes ? `<span class="recipe-list-time">${icon('clock', 14)} ${Number(dish.prepMinutes)} min</span>` : ''}${labels}</div>
        </div></button>${dishVoteControls(dish, state, true)}</article>`;
    }
    return `<article class="recipe-card">${opening}${photo}<div class="recipe-content"><div class="recipe-meta">${badge}</div>
      <h3>${name}</h3>${labels}</div></button>${dishVoteControls(dish, state, true)}</article>`;
  }).join('');
  const tags = availableRecipeTags(state.dishes);
  const selectedTags = cleanTagSelection(selectedRecipeTags(state));
  const excludedTags = cleanTagSelection(state.recipeExcludeTags);
  const tagButton = (tag, label) => {
    const active = selectedTags.includes(normalizeText(tag));
    return `<button type="button" data-action="recipe-tag" data-value="${h(tag)}" class="${active ? 'active' : ''}" aria-pressed="${active}">${active ? icon('check', 13) : ''}${h(label)}</button>`;
  };
  const excludedButton = (tag, label) => {
    const active = excludedTags.includes(normalizeText(tag));
    return `<button type="button" data-action="recipe-exclude-tag" data-value="${h(tag)}" class="${active ? 'active is-excluded' : ''}" aria-pressed="${active}">${active ? icon('check', 13) : ''}${h(label)}</button>`;
  };
  const hasTags = selectedTags.length > 0 || excludedTags.length > 0;
  const hasMultipleTags = selectedTags.length > 1;
  return `${pageHeader('RECETARIO COMPARTIDO', 'Nuestros platillos', 'Las recetas que compartimos en familia.')}
  ${state.recipeNotice ? `<p class="notice-text" role="status">${h(state.recipeNotice)}</p>` : ''}
  ${state.recipeEditor ? dishForm(editor, state.recipeEditor === 'new', state.recipePhotoFile, state.profile.role === 'admin') : ''}
  ${detail && !state.recipeEditor ? dishDetail(detail, state) : ''}
  ${state.profile.role === 'admin' && state.dishImportOpen ? renderAdminDishImport(state) : ''}
  <section class="surface-card recipes-panel"><div class="recipe-toolbar"><label class="search-box">${icon('search')}<span class="sr-only">Buscar platillos</span><input id="recipe-search" type="search" autocomplete="off" placeholder="Buscar un platillo..." value="${h(state.recipeQuery)}"></label>
    ${!state.recipeEditor ? `<button type="button" class="btn btn-primary" data-action="dish-new">${icon('plus', 17)} Agregar platillo</button>` : ''}
    ${state.profile.role === 'admin' ? `<button type="button" class="btn btn-outline" data-action="dish-import-toggle">${state.dishImportOpen ? 'Cerrar importación' : 'Importar JSON'}</button>` : ''}
    <div class="recipe-controls"><div class="segmented" aria-label="Ver platillos">${[['all','Todos'],['mine','Míos'],...(state.profile.role === 'admin' ? [['archived','Archivados']] : [])].map(([k,v]) => `<button type="button" data-action="recipe-filter" data-value="${k}" class="${state.recipeFilter === k ? 'selected' : ''}" aria-pressed="${state.recipeFilter === k}">${v}</button>`).join('')}</div>
    <label class="recipe-sort-control">Ordenar <select id="recipe-sort" aria-label="Ordenar recetas"><option value="az" ${!state.recipeSort || state.recipeSort === 'az' ? 'selected' : ''}>Nombre (A–Z)</option><option value="za" ${state.recipeSort === 'za' ? 'selected' : ''}>Nombre (Z–A)</option><option value="recent" ${state.recipeSort === 'recent' ? 'selected' : ''}>Más recientes</option></select></label>
    <div class="segmented compact-tabs" aria-label="Presentación"><button type="button" aria-label="Tarjetas" title="Tarjetas" data-action="recipe-view" data-value="cards" class="${state.recipeView === 'cards' ? 'selected' : ''}">${icon('grid', 18)}</button><button type="button" aria-label="Lista" title="Lista" data-action="recipe-view" data-value="list" class="${state.recipeView === 'list' ? 'selected' : ''}">${icon('list', 18)}</button></div></div></div>
    <div class="recipe-filter-area"><div class="recipe-filter-heading"><strong>Filtrar platillos</strong>${hasTags ? `<button type="button" class="recipe-clear-filters" data-action="recipe-clear-tags">Quitar filtros (${selectedTags.length + excludedTags.length})</button>` : ''}</div>
    <p class="tag-filter-label">Incluir etiquetas</p><div class="dish-tag-filter" role="group" aria-label="Incluir etiquetas">${tagButton('saludable','Saludable')}${tagButton('postre','Postres')}${tagButton('bebida','Bebidas')}${tags.map(t => tagButton(t,t)).join('')}</div>
    <p class="tag-filter-label">Excluir etiquetas</p><div class="dish-tag-filter exclude-tag-filter" role="group" aria-label="Excluir etiquetas">${excludedButton('saludable','Saludable')}${excludedButton('postre','Postres')}${excludedButton('bebida','Bebidas')}${tags.map(t => excludedButton(t,t)).join('')}</div>
    ${hasMultipleTags ? `<div class="recipe-match-controls"><span>Mostrar recetas que tengan:</span><div class="segmented" aria-label="Modo de combinación de etiquetas"><button type="button" data-action="recipe-match-mode" data-value="all" class="${state.recipeMatchMode !== 'any' ? 'selected' : ''}" aria-pressed="${state.recipeMatchMode !== 'any'}">Todas</button><button type="button" data-action="recipe-match-mode" data-value="any" class="${state.recipeMatchMode === 'any' ? 'selected' : ''}" aria-pressed="${state.recipeMatchMode === 'any'}">Cualquiera</button></div></div>` : ''}</div>
    <div class="recipes-intro"><strong>${matches.length} ${matches.length === 1 ? 'platillo' : 'platillos'}</strong></div>
    ${dishes.length ? `<div class="recipe-grid ${state.recipeView}">${cards}</div>` : '<div class="empty-result">No hay platillos que coincidan.</div>'}
    ${matches.length > dishes.length ? '<div class="dish-more-container"><button class="btn btn-outline" data-action="dish-more">Mostrar más platillos</button></div>' : ''}
  </section>`;
}
