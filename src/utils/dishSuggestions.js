import { normalizeText } from './html.js';
import { dishVoteSummary } from './dishVotes.js';

// Las etiquetas se combinan igual que en el recetario, siempre sobre platillos activos.
export function suggestionCandidates(dishes = [], tags = [], matchMode = 'all') {
  const filters = [...new Set((Array.isArray(tags) ? tags : []).map(normalizeText).filter(Boolean))];
  return (dishes || []).filter(dish => {
    if (dish.status !== 'active') return false;
    const hasTag = tag => tag === 'saludable'
      ? dish.approvedForHealthyMenu === true
      : (dish.tags || []).some(value => normalizeText(value) === tag);
    if (!filters.length) return true;
    return matchMode === 'any' ? filters.some(hasTag) : filters.every(hasTag);
  });
}

// Una opinión positiva aumenta las oportunidades y una negativa las reduce.
// El mínimo de 1 conserva una posibilidad para cada receta que cumpla los filtros.
export function suggestionWeight({ likes = 0, dislikes = 0 } = {}) {
  return Math.max(1, 4 + 3 * likes - 2 * dislikes);
}

// Selección ponderada sin escrituras en Firebase. Evita repetir inmediatamente
// la misma receta cuando hay al menos dos candidatas disponibles.
export function pickFamilySuggestion({ dishes = [], tags = [], matchMode = 'all',
  votesByDish = {}, familyUsers = [], previousId = null } = {}, random = Math.random) {
  const candidates = suggestionCandidates(dishes, tags, matchMode);
  if (!candidates.length) return null;
  const pool = candidates.length > 1 && previousId
    ? candidates.filter(dish => dish.id !== previousId) : candidates;
  const choices = pool.map(dish => {
    const votes = dishVoteSummary(dish.id, votesByDish, familyUsers);
    return { dish, likes: votes.likes, dislikes: votes.dislikes, weight: suggestionWeight(votes) };
  });
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  const sample = Number(random());
  if (!Number.isFinite(sample)) throw new Error('No se pudo generar una sugerencia.');
  let remaining = Math.min(Math.max(sample, 0), 1 - Number.EPSILON) * totalWeight;
  for (const choice of choices) {
    if (remaining < choice.weight) return choice;
    remaining -= choice.weight;
  }
  return choices[choices.length - 1];
}
