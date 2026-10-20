import { validateDish } from './dishValidation.js';

export const MAX_IMPORT_BYTES = 512 * 1024;
export const MAX_IMPORT_DISHES = 50;
const ALLOWED_KEYS = new Set([
  'name', 'description', 'ingredientsText', 'instructionsText', 'prepMinutes',
  'approvedForHealthyMenu', 'tags',
]);

export function parseDishImport(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Selecciona un archivo JSON o pega las recetas.');
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES)
    throw new Error('El archivo JSON debe pesar menos de 512 KB.');
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('El texto no es un JSON válido. Revisa las comillas y las comas.'); }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_IMPORT_DISHES)
    throw new Error('El JSON debe ser una lista de entre 1 y 50 recetas.');
  return data.map((raw, i) => {
    const where = `Receta ${i + 1}`;
    if (!raw || Array.isArray(raw) || typeof raw !== 'object')
      throw new Error(`${where}: cada receta debe ser un objeto.`);
    const unknown = Object.keys(raw).filter(key => !ALLOWED_KEYS.has(key));
    if (unknown.length) throw new Error(`${where}: campos no reconocidos: ${unknown.join(', ')}.`);
    for (const field of ['name','description','ingredientsText','instructionsText']) {
      if (field === 'name' && typeof raw[field] !== 'string')
        throw new Error(`${where}: el nombre debe ser texto.`);
      if (raw[field] != null && typeof raw[field] !== 'string')
        throw new Error(`${where}: ${field} debe ser texto.`);
    }
    if (raw.prepMinutes !== undefined && raw.prepMinutes !== null &&
        (!Number.isInteger(raw.prepMinutes) || raw.prepMinutes < 1 || raw.prepMinutes > 1440))
      throw new Error(`${where}: el tiempo debe ser un número entero de 1 a 1440 minutos.`);
    if (raw.approvedForHealthyMenu !== undefined && typeof raw.approvedForHealthyMenu !== 'boolean')
      throw new Error(`${where}: Saludable debe ser verdadero o falso.`);
    if (raw.tags !== undefined && (!Array.isArray(raw.tags) || raw.tags.some(tag =>
      typeof tag !== 'string' || !tag.trim() || tag.includes(','))))
      throw new Error(`${where}: las etiquetas deben ser una lista de textos sin comas.`);
    let content;
    try {
      content = validateDish({
        name: raw.name, description: raw.description ?? '', ingredientsText: raw.ingredientsText ?? '',
        instructionsText: raw.instructionsText ?? '', prepMinutes: raw.prepMinutes ?? '',
        tags: (raw.tags ?? []).join(','),
      });
    } catch (error) { throw new Error(`${where} (${String(raw.name ?? '').slice(0, 60)}): ${error.message}`); }
    return { ...content, approvedForHealthyMenu: raw.approvedForHealthyMenu ?? false };
  });
}

// No usamos la página de recetario como fuente: sólo carga 24 recetas inicialmente.
// El estado se obtiene consultando Firestore por searchName de cada receta.
export function markImportDuplicates(dishes, existingNames = new Set()) {
  const inFile = new Set();
  return dishes.map(dish => {
    const repeated = inFile.has(dish.searchName);
    inFile.add(dish.searchName);
    return { dish, status: repeated ? 'repetida' : existingNames.has(dish.searchName) ? 'existente' : 'nueva' };
  });
}
