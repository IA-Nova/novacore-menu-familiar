import { pageHeader, emptyIllustration } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { asDataUri } from '../utils/dishPhoto.js';
import { escapeHtml, normalizeText } from '../utils/html.js';
import { availableRecipeTags } from './recipes.js';
import { suggestionCandidates } from '../utils/dishSuggestions.js';
import { dishVoteSummary } from '../utils/dishVotes.js';

const h = escapeHtml;

export function renderSuggestions(state) {
  const tags = Array.isArray(state.suggestionTags) ? state.suggestionTags : [];
  const excludedTags = Array.isArray(state.suggestionExcludeTags) ? state.suggestionExcludeTags : [];
  const matchMode = state.suggestionMatchMode === 'any' ? 'any' : 'all';
  const candidates = suggestionCandidates(state.dishes || [], tags, matchMode, excludedTags);
  const selected = candidates.find(dish => dish.id === state.suggestionDishId);
  const preferencesReady = state.dishVotesLoaded === true &&
    (state.familyUsers || []).some(u => u.uid === state.user?.uid && u.status === 'active');
  const tagButton = (tag, label) => {
    const active = tags.some(value => normalizeText(value) === normalizeText(tag));
    return `<button type="button" data-action="suggestion-tag" data-value="${h(tag)}" aria-pressed="${active}" class="${active ? 'active' : ''}">${active ? icon('check', 14) : ''}${h(label)}</button>`;
  };
  const excludeButton = (tag, label) => {
    const active = excludedTags.some(value => normalizeText(value) === normalizeText(tag));
    return `<button type="button" data-action="suggestion-exclude-tag" data-value="${h(tag)}" aria-pressed="${active}" class="${active ? 'active is-excluded' : ''}">${active ? icon('check', 14) : ''}${h(label)}</button>`;
  };
  const customTags = availableRecipeTags(state.dishes);
  const summary = selected ? dishVoteSummary(selected.id, state.dishVotes, state.familyUsers, state.user?.uid) : null;
  const photo = selected ? asDataUri(state.thumbnails?.[selected.id]) : '';

  return `${pageHeader('PREFERENCIAS DE LA FAMILIA', '¿Qué comemos hoy?',
    'Descubre un platillo al azar. Los favoritos de la familia tienen más oportunidades de salir.')}
  <section class="surface-card suggestion-filters" aria-label="Filtros del generador">
    <div class="section-top"><h2>Elige qué se te antoja</h2>${tags.length || excludedTags.length ? '<button class="recipe-clear-filters" data-action="suggestion-clear" type="button">Quitar filtros</button>' : ''}</div>
    <p class="tag-filter-label">Incluir etiquetas</p><div class="dish-tag-filter" role="group" aria-label="Incluir etiquetas en sugerencias">
      ${tagButton('saludable', 'Saludable')}${tagButton('postre', 'Postre')}${tagButton('bebida', 'Bebida')}${customTags.map(tag => tagButton(tag, tag)).join('')}
    </div>
    <p class="tag-filter-label">Excluir etiquetas</p><div class="dish-tag-filter exclude-tag-filter" role="group" aria-label="Excluir etiquetas de sugerencias">${excludeButton('saludable', 'Saludable')}${excludeButton('postre', 'Postre')}${excludeButton('bebida', 'Bebida')}${customTags.map(tag => excludeButton(tag, tag)).join('')}</div>
    ${tags.length > 1 ? `<div class="recipe-match-controls"><span>Buscar recetas que tengan:</span>
      <div class="segmented" aria-label="Cómo combinar los filtros">
        <button type="button" data-action="suggestion-match" data-value="all" class="${matchMode === 'all' ? 'selected' : ''}" aria-pressed="${matchMode === 'all'}">Todas</button>
        <button type="button" data-action="suggestion-match" data-value="any" class="${matchMode === 'any' ? 'selected' : ''}" aria-pressed="${matchMode === 'any'}">Cualquiera</button>
      </div></div>` : ''}
    <div class="suggestion-filter-footer"><span>${candidates.length} ${candidates.length === 1 ? 'receta disponible' : 'recetas disponibles'}</span>
      <button type="button" class="btn btn-primary" data-action="suggestion-generate" ${!candidates.length || !preferencesReady ? 'disabled' : ''}>${icon('shuffle', 18)} ${selected ? 'Otra sugerencia' : 'Sorpréndeme'}</button></div>
    ${!preferencesReady ? '<p class="muted-label suggestion-info" role="status">Cargando las preferencias de la familia…</p>' : ''}
  </section>
  ${selected ? `<section class="surface-card suggestion-result" aria-live="polite">
    <div class="suggestion-result-photo">${photo ? `<img class="dish-photo" src="${photo}" alt="Fotografía de ${h(selected.name)}">` : emptyIllustration()}</div>
    <div class="suggestion-result-body"><p class="eyebrow">LA SUGERENCIA DE HOY</p><h2>${h(selected.name)}</h2>
      <div class="suggestion-pills">${selected.approvedForHealthyMenu ? '<span class="pill healthy">Saludable</span>' : ''}${(selected.tags || []).map(t => `<span class="pill neutral">${h(t)}</span>`).join('')}</div>
      ${selected.description ? `<p class="suggestion-description">${h(selected.description)}</p>` : ''}
      ${selected.prepMinutes ? `<p class="suggestion-meta">${icon('clock', 17)} ${Number(selected.prepMinutes)} minutos aproximadamente</p>` : ''}
      <div class="suggestion-votes" aria-label="Preferencias familiares">
        <span>${icon('thumbsUp', 18)} ${summary.likes} Me gusta</span>
        <span>${icon('thumbsDown', 18)} ${summary.dislikes} No me gusta</span>
      </div>
      <button type="button" class="btn btn-outline" data-action="suggestion-view-dish" data-value="${h(selected.id)}">Ver receta completa ${icon('arrow', 17)}</button>
    </div>
  </section>` : candidates.length ? `<section class="surface-card suggestion-placeholder" aria-live="polite">
    <div class="suggestion-placeholder-icon">${icon('shuffle', 33)}</div>
    <h2>¿Qué se nos antoja preparar?</h2>
    <p>Pulsa «Sorpréndeme» y elegiremos un platillo para ti.</p>
  </section>` : `<section class="surface-card suggestion-placeholder" role="status"><h2>No encontramos recetas con esos filtros</h2>
    <p>Prueba cambiando los filtros incluidos o excluidos.</p></section>`}
  <p class="suggestion-explanation">Las sugerencias tienen en cuenta los votos de los integrantes activos. Los Me gusta aumentan las posibilidades y los No me gusta las reducen, pero ningún platillo se descarta por sus votos.</p>`;
}
