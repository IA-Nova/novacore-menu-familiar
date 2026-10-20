import { normalizeText } from './html.js';

export function validateDish(form = {}) {
  const name = String(form.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 100) throw new Error('Escribe un nombre de hasta 100 caracteres.');
  const description = String(form.description ?? '').trim();
  const ingredientsText = String(form.ingredientsText ?? '').trim();
  const instructionsText = String(form.instructionsText ?? '').trim();
  if (description.length > 1000 || ingredientsText.length > 5000 || instructionsText.length > 8000)
    throw new Error('Uno de los campos de texto es demasiado largo.');
  const value = String(form.prepMinutes ?? '').trim();
  const prepMinutes = value ? Number(value) : null;
  if (prepMinutes !== null && (!Number.isInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 1440))
    throw new Error('El tiempo debe estar entre 1 y 1440 minutos.');
  const tags = [...new Set([...String(form.tags ?? '').split(','),
    ...(form.tagPostre ? ['postre'] : []), ...(form.tagBebida ? ['bebida'] : [])]
    .map(t => t.trim()).filter(Boolean).map(t => {
      const normalized = normalizeText(t);
      return normalized === 'postre' || normalized === 'bebida' ? normalized : t;
    }))];
  if (tags.length > 10) throw new Error('Agrega como máximo 10 etiquetas.');
  if (tags.some(t => t.length > 30)) throw new Error('Cada etiqueta admite hasta 30 caracteres.');
  return { name, searchName: normalizeText(name), description, ingredientsText,
    instructionsText, prepMinutes, tags };
}
export function duplicateDishNames(dishes, name, exceptId = null) {
  const normalized = normalizeText(name);
  return dishes.filter(d => d.status === 'active' && d.id !== exceptId && normalizeText(d.name) === normalized);
}
