import { normalizeText } from './html.js';

export function dishHasTag(dish, tag) {
  const key = normalizeText(tag);
  if (key === 'saludable') return dish.approvedForHealthyMenu === true;
  return (dish.tags || []).some(value => normalizeText(value) === key);
}

export function cleanTagSelection(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean))];
}

// Exclusions always take priority. Inclusion matching uses all/any only on included tags.
export function matchesDishTags(dish, included = [], mode = 'all', excluded = []) {
  const notAllowed = cleanTagSelection(excluded);
  if (notAllowed.some(tag => dishHasTag(dish, tag))) return false;
  const wanted = cleanTagSelection(included);
  if (!wanted.length) return true;
  return mode === 'any' ? wanted.some(tag => dishHasTag(dish, tag)) : wanted.every(tag => dishHasTag(dish, tag));
}
