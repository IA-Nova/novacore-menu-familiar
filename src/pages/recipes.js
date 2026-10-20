import { pageHeader, emptyIllustration } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { normalizeText, escapeHtml } from '../utils/html.js';
import { asDataUri } from '../utils/dishPhoto.js';
import { renderAdminDishImport } from './adminImport.js';

const h = escapeHtml;
const photoBlock = (photo, name) => {
  const src = asDataUri(photo);
  return src ? `<img class="dish-photo" loading="lazy" src="${src}" alt="Fotografía de ${h(name)}">` : emptyIllustration();
};
const canEdit = (dish, state) => state.profile.role === 'admin' ||
  (dish.createdBy === state.user?.uid && !dish.approvedForHealthyMenu);
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
      ${admin ? `<label class="dish-choice"><input type="checkbox" name="approvedForHealthyMenu" ${healthyChecked ? 'checked' : ''}><span>Saludable</span></label>` : ''}
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
    <div class="dish-actions">${canEdit(dish, state) ? `<button class="btn btn-outline btn-small" data-action="dish-edit" data-value="${h(dish.id)}">Editar</button>` : ''}
    ${state.profile.role === 'admin' ? `<button class="btn btn-outline btn-small" data-action="dish-healthy" data-value="${h(dish.id)}">${dish.approvedForHealthyMenu ? 'Quitar de saludables' : 'Aprobar saludable'}</button><button class="btn btn-outline btn-small" data-action="dish-archive" data-value="${h(dish.id)}">${dish.status === 'active' ? 'Archivar' : 'Reactivar'}</button>` : ''}</div></div></div></section>`;
}
export function renderRecipes(state) {
  const search = normalizeText(state.recipeQuery);
  const dishes = (state.dishes || []).filter(d => (d.status === 'active' || (state.recipeFilter === 'archived' && state.profile.role === 'admin')) && normalizeText(d.name).includes(search))
    .filter(d => state.recipeFilter !== 'healthy' || d.approvedForHealthyMenu && d.status === 'active')
    .filter(d => state.recipeFilter !== 'mine' || d.createdBy === state.user?.uid && d.status === 'active')
    .filter(d => state.recipeFilter !== 'archived' || d.status === 'archived')
    .filter(d => !state.recipeTag || (d.tags || []).some(t => normalizeText(t) === normalizeText(state.recipeTag)));
  const savedEditor = state.recipeEditor && state.recipeEditor !== 'new' ? state.dishes.find(d => d.id === state.recipeEditor) : null;
  const editor = state.recipeDraft ?? savedEditor;
  const detail = state.dishes.find(d => d.id === state.recipeDetailId);
  const cards = dishes.map(dish => `<article class="recipe-card ${state.recipeView === 'list' ? 'compact' : ''}">
    <button class="dish-card-open" type="button" data-action="dish-detail" data-value="${h(dish.id)}" aria-label="Ver ${h(dish.name)}">${photoBlock(state.thumbnails[dish.id], dish.name)}<div class="recipe-content"><div class="recipe-meta"><span class="pill ${dish.approvedForHealthyMenu ? 'healthy' : 'neutral'}">${dish.status === 'archived' ? 'Archivado' : dish.approvedForHealthyMenu ? icon('utensils', 13) + ' Saludable' : 'Sin marca saludable'}</span></div>
    <h3>${h(dish.name)}</h3><p>${h(authorName(dish, state))}</p><div class="recipe-tags">${(dish.tags || []).map(t => `<span>${h(t)}</span>`).join('')}</div></div></button></article>`).join('');
  const tags = [...new Set(state.dishes.filter(d => d.status === 'active').flatMap(d => d.tags || []))]
    .filter(t => !['postre','bebida'].includes(normalizeText(t))).slice(0, 25);
  return `${pageHeader('RECETARIO COMPARTIDO', 'Nuestros platillos', 'Las recetas que compartimos en familia.')}
  ${state.recipeNotice ? `<p class="notice-text" role="status">${h(state.recipeNotice)}</p>` : ''}
  ${state.recipeEditor ? dishForm(editor, state.recipeEditor === 'new', state.recipePhotoFile, state.profile.role === 'admin') : ''}
  ${detail && !state.recipeEditor ? dishDetail(detail, state) : ''}
  ${state.profile.role === 'admin' && state.dishImportOpen ? renderAdminDishImport(state) : ''}
  <section class="surface-card recipes-panel"><div class="recipe-toolbar"><label class="search-box">${icon('search')}<span class="sr-only">Buscar platillos</span><input id="recipe-search" type="search" autocomplete="off" placeholder="Buscar un platillo..." value="${h(state.recipeQuery)}"></label>
    ${!state.recipeEditor ? `<button type="button" class="btn btn-primary" data-action="dish-new">${icon('plus', 17)} Agregar platillo</button>` : ''}
    ${state.profile.role === 'admin' ? `<button type="button" class="btn btn-outline" data-action="dish-import-toggle">${state.dishImportOpen ? 'Cerrar importación' : 'Importar JSON'}</button>` : ''}
    <div class="recipe-controls"><div class="segmented" aria-label="Filtrar platillos">${[['all','Todos'],['healthy','Saludables'],['mine','Míos'],...(state.profile.role === 'admin' ? [['archived','Archivados']] : [])].map(([k,v]) => `<button data-action="recipe-filter" data-value="${k}" class="${state.recipeFilter === k ? 'selected' : ''}" aria-pressed="${state.recipeFilter === k}">${v}</button>`).join('')}</div>
    <div class="segmented compact-tabs" aria-label="Presentación"><button type="button" aria-label="Tarjetas" title="Tarjetas" data-action="recipe-view" data-value="cards" class="${state.recipeView === 'cards' ? 'selected' : ''}">${icon('grid', 18)}</button><button type="button" aria-label="Lista" title="Lista" data-action="recipe-view" data-value="list" class="${state.recipeView === 'list' ? 'selected' : ''}">${icon('list', 18)}</button></div></div></div>
    <div class="dish-tag-filter"><button type="button" class="${!state.recipeTag ? 'active' : ''}" data-action="recipe-tag" data-value="">Todas las etiquetas</button>${[['postre','Postres'],['bebida','Bebidas']].map(([k,v]) => `<button type="button" data-action="recipe-tag" data-value="${k}" class="${normalizeText(state.recipeTag) === k ? 'active' : ''}">${v}</button>`).join('')}${tags.map(t => `<button type="button" data-action="recipe-tag" data-value="${h(t)}" class="${state.recipeTag === t ? 'active' : ''}">${h(t)}</button>`).join('')}</div>
    <div class="recipes-intro"><strong>${dishes.length} platillos</strong></div>
    ${dishes.length ? `<div class="recipe-grid ${state.recipeView}">${cards}</div>` : '<div class="empty-result">No hay platillos que coincidan.</div>'}
    ${state.dishes.length >= state.recipePageSize ? '<div class="dish-more-container"><button class="btn btn-outline" data-action="dish-more">Mostrar más platillos</button></div>' : ''}
  </section>`;
}
