import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCycle } from '../src/utils/dates.js';
import { BACKUP_FORMAT, parseBackup, validateBackup, backupCounts } from '../src/utils/backupValidation.js';
const admin = 'admin-uid';
const stamp = { __timestamp: '2026-10-19T19:00:00.000Z' };
const makeBackup = () => {
  const cycle = createCycle('2026-10-19');
  return {
    format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: '2026-10-19T19:00:00.000Z',
    source: { projectId: 'novacore-menu-familiar' },
    collections: {
      config: [{ id: 'app', data: { schemaVersion: 1, timeZone: 'America/Mexico_City', anchorMonday: '2026-10-19', maxActiveUsers: 5, familyName: 'Mi familia', defaultDayTypes: cycle.days.map(d => d.type), createdAt: stamp, updatedAt: stamp } }],
      users: [{ id: admin, data: { username: 'ianova', displayName: 'IANova', role: 'admin', status: 'active', createdAt: stamp } },
        { id: 'member-uid', data: { username: 'ana', displayName: 'Ana Flores', role: 'member', status: 'active', createdAt: stamp } }],
      dishes: [{ id: 'dish-1', data: { name: 'Arroz', status: 'active', createdBy: admin, approvedForHealthyMenu: true, hasPhoto: false, createdAt: stamp } }],
      dishPhotos: [], dishThumbnails: [],
      cycles: [{ id: cycle.startDate, data: { ...cycle, endAt: stamp, wishDeadlines: {}, lockedWishes: [], createdAt: stamp, updatedAt: stamp } }],
      wishes: [{ id: 'member-uid', cycleId: cycle.startDate, data: { userId: 'member-uid', status: 'selected', note: '', dishes: [{ dishId: 'dish-1', nameSnapshot: 'Arroz' }], createdAt: stamp, updatedAt: stamp } }],
    },
  };
};
test('un respaldo íntegro pasa validación y tiene todas las colecciones', () => {
  const backup = makeBackup();
  assert.equal(validateBackup(backup, admin, 'novacore-menu-familiar'), backup);
  assert.deepEqual(backupCounts(backup), { config: 1, users: 2, dishes: 1, dishPhotos: 0, dishThumbnails: 0, cycles: 1, wishes: 1 });
});
test('el respaldo no puede cambiar la identidad del administrador', () => {
  const backup = makeBackup();
  backup.collections.users[0].id = 'impostor';
  assert.throws(() => validateBackup(backup, admin), /administrador/);
});
test('rechaza múltiples administradores', () => {
  const backup = makeBackup(); backup.collections.users[1].data.role = 'admin';
  assert.throws(() => validateBackup(backup, admin), /administrador/);
});
test('rechaza identidades adicionales activas', () => {
  const backup = makeBackup();
  for (let i = 0; i < 4; i++) backup.collections.users.push({ id: `extra-${i}`, data: { username: `extra${i}`, displayName: 'Usuario extra', role: 'member', status: 'active' } });
  assert.throws(() => validateBackup(backup, admin), /cinco integrantes/);
});
test('rechaza fotos incompletas y no elimina el registro', () => {
  const backup = makeBackup(); backup.collections.dishes[0].data.hasPhoto = true;
  assert.throws(() => validateBackup(backup, admin), /foto/);
});
test('rechaza antojos que no pertenecen a un ciclo del respaldo', () => {
  const backup = makeBackup(); backup.collections.wishes[0].cycleId = '2027-01-01';
  assert.throws(() => validateBackup(backup, admin), /antojo inválido/);
});
test('rechaza ciclos mal formados', () => {
  const backup = makeBackup(); backup.collections.cycles[0].data.days.pop();
  assert.throws(() => validateBackup(backup, admin), /formato válido/);
});
test('rechaza restauración desde otro proyecto Firebase', () => {
  const backup = makeBackup(); backup.source.projectId = 'otro-proyecto';
  assert.throws(() => validateBackup(backup, admin, 'novacore-menu-familiar'), /otro proyecto/);
});
test('rechaza JSON inválido', () => assert.throws(() => parseBackup('{', admin), /JSON válido/));
test('rechaza registros duplicados', () => {
  const backup = makeBackup(); backup.collections.dishes.push(structuredClone(backup.collections.dishes[0]));
  assert.throws(() => validateBackup(backup, admin), /duplicados/);
});
test('rechaza archivo de formato equivocado', () => {
  const backup = makeBackup(); backup.format = 'otra-app';
  assert.throws(() => validateBackup(backup, admin), /compatible/);
});
test('rechaza importación con fotos de platillo inexistente', () => {
  const backup = makeBackup();
  backup.collections.dishPhotos = [{ id: 'orphan', data: { dishId: 'orphan', mimeType: 'image/jpeg', base64: 'AAAA', width: 5, height: 5, sizeBytes: 3 } }];
  assert.throws(() => validateBackup(backup, admin), /Fotografía/);
});
