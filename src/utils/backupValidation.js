import { assertPlanningCycle, templateForFuture } from './cyclePlanning.js';

export const BACKUP_FORMAT = 'novacore-menu-familiar';
export const BACKUP_COLLECTIONS = ['config', 'users', 'dishes', 'dishPhotos', 'dishThumbnails', 'cycles', 'wishes'];
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DATE_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const requireCheck = (ok, error) => { if (!ok) throw new Error(error); };
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const timestamp = v => plain(v) && Object.keys(v).length === 1 && typeof v.__timestamp === 'string' && DATE_STAMP.test(v.__timestamp) && Number.isFinite(Date.parse(v.__timestamp));

export function backupCounts(backup) {
  return Object.fromEntries(BACKUP_COLLECTIONS.map(key => [key, backup.collections[key].length]));
}

export function validateBackup(input, adminUid, expectedProjectId = '') {
  requireCheck(plain(input) && input.format === BACKUP_FORMAT && input.schemaVersion === 1,
    'El archivo no es un respaldo compatible de NovaCore Menú Familiar.');
  requireCheck(typeof input.exportedAt === 'string' && Number.isFinite(Date.parse(input.exportedAt)),
    'El respaldo no tiene una fecha de exportación válida.');
  requireCheck(plain(input.collections), 'El respaldo no contiene colecciones válidas.');
  requireCheck(plain(input.source) && typeof input.source.projectId === 'string', 'Faltan los datos de origen del respaldo.');
  requireCheck(!expectedProjectId || input.source.projectId === expectedProjectId,
    'Este archivo proviene de otro proyecto Firebase.');
  const seen = new Set();
  for (const key of BACKUP_COLLECTIONS) {
    const entries = input.collections[key];
    requireCheck(Array.isArray(entries) && entries.length <= 20000, `Colección ${key} inválida.`);
    for (const row of entries) {
      requireCheck(plain(row) && typeof row.id === 'string' && SAFE_ID.test(row.id) && plain(row.data), `Registro de ${key} inválido.`);
      requireCheck(!seen.has(`${key}/${row.cycleId || ''}/${row.id}`), `Hay registros duplicados en ${key}.`);
      seen.add(`${key}/${row.cycleId || ''}/${row.id}`);
      if (key === 'wishes') requireCheck(typeof row.cycleId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.cycleId), 'Antojo sin ciclo válido.');
    }
  }
  const configs = input.collections.config;
  requireCheck(configs.length <= 1 && (!configs.length || configs[0].id === 'app'), 'Configuración duplicada o inválida.');
  if (configs.length) {
    const cfg = configs[0].data;
    templateForFuture(cfg.defaultDayTypes);
    requireCheck(cfg.schemaVersion === 1 && cfg.timeZone === 'America/Mexico_City' &&
      typeof cfg.anchorMonday === 'string' && cfg.maxActiveUsers === 5 &&
      typeof cfg.familyName === 'string' && cfg.familyName.trim().length >= 1 && cfg.familyName.length <= 60,
    'La configuración del respaldo es incompatible.');
  }
  const users = input.collections.users;
  const byUid = new Map(users.map(row => [row.id, row.data]));
  requireCheck(byUid.has(adminUid), 'El respaldo no contiene la identidad de este administrador.');
  requireCheck(byUid.get(adminUid).role === 'admin' && byUid.get(adminUid).status === 'active',
    'El respaldo contiene un administrador inválido.');
  requireCheck(users.filter(row => row.data.role === 'admin').length === 1, 'El respaldo contiene más de un administrador.');
  requireCheck(users.filter(row => row.data.status === 'active').length <= 5, 'Hay más de cinco integrantes activos en el respaldo.');
  for (const row of users) {
    const u = row.data;
    requireCheck(typeof u.username === 'string' && /^[a-z0-9._-]{3,24}$/.test(u.username) &&
      typeof u.displayName === 'string' && u.displayName.length >= 2 && u.displayName.length <= 60 &&
      ['pending','active','disabled'].includes(u.status) && ['admin','member'].includes(u.role) &&
      (row.id === adminUid || u.role === 'member'), 'Perfil de integrante inválido.');
  }
  const dishes = new Map(input.collections.dishes.map(row => [row.id, row.data]));
  for (const [id, d] of dishes) {
    requireCheck(typeof d.name === 'string' && d.name.trim().length >= 1 && d.name.length <= 100 &&
      typeof d.createdBy === 'string' && byUid.has(d.createdBy) &&
      ['active','archived'].includes(d.status) && typeof d.approvedForHealthyMenu === 'boolean' &&
      typeof d.hasPhoto === 'boolean' && timestamp(d.createdAt), `Platillo ${id} incompatible.`);
  }
  for (const kind of ['dishPhotos','dishThumbnails']) {
    for (const row of input.collections[kind]) {
      const d = row.data;
      requireCheck(dishes.has(row.id) && d.dishId === row.id && d.mimeType === 'image/jpeg' &&
        typeof d.base64 === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(d.base64) &&
        d.base64.length <= (kind === 'dishPhotos' ? 163840 : 20480) &&
        Number.isInteger(d.sizeBytes) && d.sizeBytes > 0 && d.sizeBytes <= (kind === 'dishPhotos' ? 122880 : 15360) &&
        Number.isInteger(d.width) && Number.isInteger(d.height) && d.width > 0 && d.height > 0 &&
        d.width <= (kind === 'dishPhotos' ? 960 : 320) && d.height <= (kind === 'dishPhotos' ? 960 : 320),
        `Fotografía ${row.id} incompatible.`);
    }
  }
  const photos = new Set(input.collections.dishPhotos.map(row => row.id));
  const thumbs = new Set(input.collections.dishThumbnails.map(row => row.id));
  for (const [id, d] of dishes) if (d.hasPhoto) requireCheck(photos.has(id) && thumbs.has(id), `La foto del platillo ${id} está incompleta.`);
  const cycles = new Set();
  for (const row of input.collections.cycles) {
    requireCheck(row.id === row.data.startDate, 'La fecha del ciclo no coincide con su identificador.');
    assertPlanningCycle(row.data);
    requireCheck(timestamp(row.data.endAt) && timestamp(row.data.createdAt), `El ciclo ${row.id} está incompleto.`);
    requireCheck(plain(row.data.wishDeadlines) && Array.isArray(row.data.lockedWishes), 'Plazos de antojos incompletos.');
    cycles.add(row.id);
  }
  for (const row of input.collections.wishes) {
    const w = row.data;
    requireCheck(cycles.has(row.cycleId) && byUid.has(row.id) && w.userId === row.id &&
      ['selected','declined'].includes(w.status) && Array.isArray(w.dishes) && w.dishes.length <= 6 &&
      (w.status === 'declined' ? w.dishes.length === 0 : w.dishes.length >= 1) &&
      w.dishes.every(d => d && dishes.has(d.dishId) && typeof d.nameSnapshot === 'string' && d.nameSnapshot.length <= 100 && d.nameSnapshot.length > 0) &&
      typeof w.note === 'string' && w.note.length <= 250 && timestamp(w.createdAt), 'Hay un antojo inválido en el respaldo.');
  }
  return input;
}

export function parseBackup(text, adminUid, projectId) {
  requireCheck(typeof text === 'string' && new TextEncoder().encode(text).byteLength <= MAX_BACKUP_BYTES,
    'El archivo excede el tamaño máximo permitido (32 MB).');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('El archivo no contiene un JSON válido.'); }
  return validateBackup(parsed, adminUid, projectId);
}
