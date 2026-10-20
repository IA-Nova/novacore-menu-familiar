// Ejecutar sólo con Firebase Emulator Suite en 127.0.0.1:8080.
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
let env;
const authUser = (uid, email) => env.authenticatedContext(uid, { email }).firestore();
before(async () => {
  const rules = readFileSync(new URL('../firestore.rules.template', import.meta.url), 'utf8').replaceAll('__ADMIN_UID__', 'admin-uid');
  env = await initializeTestEnvironment({ projectId: 'demo-novacore-menu-familiar', firestore: { rules, host: '127.0.0.1', port: 8080 } });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const seed = [
      ['admin-uid', 'admin', 'Administrador', 'admin', 'active'],
      ['active-uid', 'ana', 'Ana', 'member', 'active'],
      ['other-active-uid', 'maria', 'María', 'member', 'active'],
      ['pending-uid', 'luis', 'Luis', 'member', 'pending'],
      ['approval-uid', 'sofia', 'Sofía', 'member', 'pending'],
      ['disabled-uid', 'pepe', 'Pepe', 'member', 'disabled'],
    ];
    for (const [uid, username, displayName, role, status] of seed) {
      await setDoc(doc(db, 'users', uid), { username, displayName, role, status, approvedAt: null, approvedBy: null, createdAt: new Date(), updatedAt: new Date() });
    }
    await setDoc(doc(db, 'config', 'app'), { familyName: 'Familia' });
    await setDoc(doc(db, 'cycles', '2026-10-19'), { days: [] });
    await setDoc(doc(db, 'cycles', '2030-10-14'), {
      startDate: '2030-10-14', endDate: '2030-10-27', endAt: new Date('2030-10-28T06:00:00Z'),
      wishDeadlines: {}, lockedWishes: [], days: [], revision: 1,
    });
    await setDoc(doc(db, 'cycles', '2030-11-11'), {
      startDate: '2030-11-11', endDate: '2030-11-24', endAt: new Date('2030-11-25T06:00:00Z'),
      wishDeadlines: { 'active-uid': new Date('2025-01-01T06:00:00Z') }, lockedWishes: [], days: [], revision: 1,
    });
    await setDoc(doc(db, 'dishes', 'wish-dish'), {
      name: 'Papas a la francesa', searchName: 'papas a la francesa', description: '', ingredientsText: '',
      instructionsText: '', prepMinutes: null, tags: [], status: 'active', approvedForHealthyMenu: false,
      hasPhoto: false, createdBy: 'admin-uid', createdAt: new Date(), updatedAt: new Date(),
    });
  });
});
after(async () => env?.cleanup());
test('visitante y pendientes no pueden leer calendario', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'cycles', '2026-10-19')));
  await assertFails(getDoc(doc(authUser('pending-uid','luis@users.novacore'), 'cycles', '2026-10-19')));
  await assertFails(getDoc(doc(authUser('disabled-uid','pepe@users.novacore'), 'cycles', '2026-10-19')));
});
test('miembros activos sí pueden leer menú, no editar calendario', async () => {
  const db = authUser('active-uid', 'ana@users.novacore');
  await assertSucceeds(getDoc(doc(db, 'cycles', '2026-10-19')));
  await assertFails(setDoc(doc(db, 'cycles', '2026-11-02'), { days: [] }));
});
test('miembros no pueden aprobarse o convertirse en admin', async () => {
  const db = authUser('pending-uid', 'luis@users.novacore');
  await assertFails(updateDoc(doc(db, 'users', 'pending-uid'), { status: 'active' }));
  await assertFails(updateDoc(doc(db, 'users', 'pending-uid'), { role: 'admin' }));
});
test('usuario nuevo sólo puede crear su propio perfil pending', async () => {
  const db = authUser('new-uid', 'marta@users.novacore');
  const data = { username: 'marta', displayName: 'Marta Gómez', role: 'member', status: 'pending', approvedAt: null, approvedBy: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, 'users', 'new-uid'), data));
  await assertFails(setDoc(doc(db, 'users', 'other-uid'), data));
  await assertFails(setDoc(doc(db, 'users', 'new-uid'), { ...data, role: 'admin' }));
});
test('admin aprueba pero miembro no puede aprobar a otros', async () => {
  const admin = authUser('admin-uid', 'admin@users.novacore');
  const member = authUser('active-uid', 'ana@users.novacore');
  await assertFails(updateDoc(doc(member, 'users', 'approval-uid'), { status: 'active' }));
  await assertSucceeds(updateDoc(doc(admin, 'users', 'approval-uid'), {
    status: 'active', approvedAt: serverTimestamp(), approvedBy: 'admin-uid', updatedAt: serverTimestamp(),
  }));
});
test('activos solo consultan integrantes activos; pendientes ven su perfil', async () => {
  const db = authUser('active-uid', 'ana@users.novacore');
  await assertSucceeds(getDocs(query(collection(db, 'users'), where('status', '==', 'active'))));
  await assertFails(getDocs(collection(db, 'users')));
  await assertSucceeds(getDoc(doc(authUser('pending-uid','luis@users.novacore'), 'users', 'pending-uid')));
});
function dishDocument(createdBy, name = 'Arroz') {
  return { name, searchName: name.toLowerCase(), description: '', ingredientsText: '',
    instructionsText: '', prepMinutes: null, tags: [], approvedForHealthyMenu: false,
    status: 'active', hasPhoto: false, createdBy,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
test('miembro activo crea platillo solo con nombre, sin autoaprobar saludable', async () => {
  const db = authUser('active-uid', 'ana@users.novacore');
  await assertSucceeds(setDoc(doc(db, 'dishes', 'd1'), dishDocument('active-uid')));
  await assertFails(setDoc(doc(db, 'dishes', 'd2'), { ...dishDocument('active-uid'), approvedForHealthyMenu: true }));
  await assertFails(setDoc(doc(db, 'dishes', 'd3'), { ...dishDocument('admin-uid'), name: 'Suplantación' }));
  await assertFails(setDoc(doc(authUser('pending-uid','luis@users.novacore'), 'dishes', 'd4'), dishDocument('pending-uid')));
});
test('administrador puede marcar Saludable al crear un platillo, no un miembro', async () => {
  const admin = authUser('admin-uid', 'admin@users.novacore');
  const owner = authUser('active-uid', 'ana@users.novacore');
  await assertSucceeds(setDoc(doc(admin, 'dishes', 'admin-nopales'), {
    ...dishDocument('admin-uid', 'Nopales'), approvedForHealthyMenu: true,
    tags: ['postre','bebida'],
  }));
  await assertFails(setDoc(doc(owner, 'dishes', 'member-mortadela'), {
    ...dishDocument('active-uid', 'Mortadela'), approvedForHealthyMenu: true,
  }));
});
test('miembros activos editan recetas compartidas sin controlar clasificación ni archivo', async () => {
  const owner = authUser('active-uid','ana@users.novacore');
  const other = authUser('other-active-uid','maria@users.novacore');
  const pending = authUser('pending-uid','luis@users.novacore');
  const disabled = authUser('disabled-uid','pepe@users.novacore');
  await assertSucceeds(updateDoc(doc(owner, 'dishes', 'd1'), { name: 'Arroz integral', searchName: 'arroz integral', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(other, 'dishes', 'd1'), { name: 'Arroz casero', searchName: 'arroz casero', tags: ['postre'], updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(pending, 'dishes', 'd1'), { name: 'Modificado', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(disabled, 'dishes', 'd1'), { name: 'Modificado', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(other, 'dishes', 'd1'), { createdBy: 'other-active-uid', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(other, 'dishes', 'd1'), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner, 'dishes', 'd1'), { status: 'archived', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner, 'dishes', 'd1'), { approvedForHealthyMenu: true, updatedAt: serverTimestamp() }));
});
test('admin aprueba como saludable y archiva; autor pierde edición', async () => {
  const admin = authUser('admin-uid','admin@users.novacore');
  const owner = authUser('active-uid','ana@users.novacore');
  await assertSucceeds(updateDoc(doc(admin, 'dishes', 'd1'), { approvedForHealthyMenu: true, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(owner, 'dishes', 'd1'), { name: 'Otro nombre', searchName: 'otro nombre', updatedAt: serverTimestamp() }));
  const other = authUser('other-active-uid','maria@users.novacore');
  await assertSucceeds(updateDoc(doc(other, 'dishes', 'd1'), { description: 'Versión familiar', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(other, 'dishes', 'd1'), { approvedForHealthyMenu: false, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin, 'dishes', 'd1'), { status: 'archived', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(other, 'dishes', 'd1'), { description: 'No autorizada', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin, 'dishes', 'd1'), { status: 'active', updatedAt: serverTimestamp() }));
});
test('imagen y miniatura requieren lote atómico, límites, autor y platillo activo', async () => {
  const owner = authUser('active-uid','ana@users.novacore');
  await assertSucceeds(setDoc(doc(owner, 'dishes', 'dphoto'), dishDocument('active-uid')));
  const makeImage = (thumb = false) => ({ dishId: 'dphoto', mimeType: 'image/jpeg',
    base64: 'AAAA', width: thumb ? 120 : 480, height: thumb ? 120 : 480,
    sizeBytes: 3, updatedAt: serverTimestamp() });
  await assertFails(setDoc(doc(owner, 'dishPhotos', 'dphoto'), makeImage()));
  const batch = writeBatch(owner);
  batch.update(doc(owner,'dishes','dphoto'), { hasPhoto: true, updatedAt: serverTimestamp() });
  batch.set(doc(owner,'dishPhotos','dphoto'), makeImage());
  batch.set(doc(owner,'dishThumbnails','dphoto'), makeImage(true));
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(owner, 'dishPhotos','dphoto'), { mimeType: 'text/html', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner, 'dishPhotos','dphoto'), { base64: 'a'.repeat(164000), updatedAt: serverTimestamp() }));
  const stranger = authUser('pending-uid','luis@users.novacore');
  await assertFails(updateDoc(doc(stranger, 'dishPhotos','dphoto'), { base64: 'AAAA', updatedAt: serverTimestamp() }));
});
test('integrante activo reemplaza foto de receta ajena aprobada sin cambiar Saludable', async () => {
  const admin = authUser('admin-uid', 'admin@users.novacore');
  const member = authUser('other-active-uid', 'maria@users.novacore');
  await assertSucceeds(setDoc(doc(admin, 'dishes', 'foto-compartida'), {
    ...dishDocument('admin-uid', 'Nopales'), approvedForHealthyMenu: true,
  }));
  const image = (thumb = false) => ({ dishId: 'foto-compartida', mimeType: 'image/jpeg',
    base64: 'AAAA', width: thumb ? 100 : 400, height: thumb ? 100 : 400,
    sizeBytes: 3, updatedAt: serverTimestamp() });
  const batch = writeBatch(member);
  batch.update(doc(member, 'dishes', 'foto-compartida'), { hasPhoto: true, updatedAt: serverTimestamp() });
  batch.set(doc(member, 'dishPhotos', 'foto-compartida'), image());
  batch.set(doc(member, 'dishThumbnails', 'foto-compartida'), image(true));
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(member, 'dishes', 'foto-compartida'), {
    approvedForHealthyMenu: false, updatedAt: serverTimestamp(),
  }));
  const pending = authUser('disabled-uid', 'pepe@users.novacore');
  await assertFails(updateDoc(doc(pending, 'dishPhotos', 'foto-compartida'), {
    base64: 'AAAA', updatedAt: serverTimestamp(),
  }));
});
function wishData(uid, dishId = 'wish-dish', name = 'Papas a la francesa') {
  return { userId: uid, status: 'selected',
    dishes: [{ dishId, nameSnapshot: name }], note: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
test('miembro activo guarda su antojo, otros pueden consultarlo', async () => {
  const owner = authUser('active-uid','ana@users.novacore');
  const admin = authUser('admin-uid','admin@users.novacore');
  const path = 'cycles/2030-10-14/wishes/active-uid';
  await assertSucceeds(setDoc(doc(owner, path), wishData('active-uid')));
  await assertSucceeds(getDoc(doc(admin, path)));
  await assertFails(setDoc(doc(admin, path), wishData('admin-uid')));
});
test('miembro no puede editar antojo ajeno ni falsear usuario', async () => {
  const stranger = authUser('pending-uid','luis@users.novacore');
  const owner = authUser('active-uid','ana@users.novacore');
  await assertFails(setDoc(doc(stranger,'cycles/2030-10-14/wishes/active-uid'), wishData('active-uid')));
  await assertFails(setDoc(doc(owner,'cycles/2030-10-14/wishes/admin-uid'), wishData('admin-uid')));
  await assertFails(setDoc(doc(owner,'cycles/2030-10-14/wishes/active-uid'), wishData('admin-uid')));
});
test('no se aceptan platillos inexistentes, archivados, notas excesivas o duplicados', async () => {
  const owner = authUser('active-uid','ana@users.novacore');
  const path = doc(owner,'cycles/2030-10-14/wishes/active-uid');
  await assertFails(setDoc(path, wishData('active-uid','inventado','Inventado')));
  await assertFails(setDoc(path, { ...wishData('active-uid'), note: 'a'.repeat(251) }));
  const base = wishData('active-uid');
  await assertFails(setDoc(path, { ...base, dishes: [base.dishes[0],base.dishes[0]] }));
});
test('vence plazo según timestamp administrado, no según cliente', async () => {
  const owner = authUser('active-uid','ana@users.novacore');
  await assertFails(setDoc(doc(owner,'cycles/2030-11-11/wishes/active-uid'), wishData('active-uid')));
});
test('renuncia propia permitida mientras el plazo sigue abierto', async () => {
  const owner = authUser('active-uid','ana@users.novacore');
  await assertSucceeds(updateDoc(doc(owner,'cycles/2030-10-14/wishes/active-uid'), {
    status: 'declined', dishes: [], note: '', updatedAt: serverTimestamp(),
  }));
});


// Evitar tomar como válido el viejo sufijo de pruebas y cualquier intento
// de registrar al UID reservado del administrador como miembro nuevo.
test('el alta rechaza un identificador sintético de otro dominio', async () => {
  const db = authUser('stranger-uid', 'marta@users.novacore.invalid');
  const data = { username: 'marta', displayName: 'Marta Gómez', role: 'member', status: 'pending',
    approvedAt: null, approvedBy: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertFails(setDoc(doc(db, 'users', 'stranger-uid'), data));
});
test('el UID reservado del administrador no admite alta de perfil provisional', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), 'users', 'admin-uid'));
  });
  try {
    const admin = authUser('admin-uid', 'admin@users.novacore');
    await assertFails(setDoc(doc(admin, 'users', 'admin-uid'), {
      username: 'admin', displayName: 'Administrador', role: 'member', status: 'pending',
      approvedAt: null, approvedBy: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  } finally {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'admin-uid'), {
        username: 'admin', displayName: 'Administrador', role: 'admin', status: 'active',
        approvedAt: new Date(), approvedBy: 'admin-uid', createdAt: new Date(), updatedAt: new Date(),
      });
    });
  }
});

// Fase 5: only the anchored admin may change planning, never delete cycles.
test('calendario: solo el administrador puede reorganizar días', async () => {
  const admin = authUser('admin-uid', 'admin@users.novacore');
  const member = authUser('active-uid', 'ana@users.novacore');
  await assertFails(updateDoc(doc(member, 'cycles', '2030-10-14'), { revision: 2, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin, 'cycles', '2030-10-14'), { revision: 2, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(admin, 'cycles', '2030-10-14')));
});

test('plantilla: miembro no puede editarla y admin no puede cambiar ancla', async () => {
  const admin = authUser('admin-uid', 'admin@users.novacore');
  const member = authUser('active-uid', 'ana@users.novacore');
  await assertFails(updateDoc(doc(member, 'config', 'app'), { familyName: 'Invasor' }));
  await assertFails(updateDoc(doc(admin, 'config', 'app'), { anchorMonday: '2026-11-02' }));
});

// Fase 6: la restauración es una excepción administrativa con validaciones de identidad.
test('restauración: el administrador edita campos funcionales, nunca identidad ni rol', async () => {
  const adminDb = authUser('admin-uid','admin@users.novacore');
  const memberDb = authUser('active-uid','ana@users.novacore');
  await assertSucceeds(updateDoc(doc(adminDb,'users','active-uid'), {
    displayName: 'Ana restaurada', status: 'active', approvedAt: serverTimestamp(),
    approvedBy: 'admin-uid', updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(adminDb,'users','active-uid'), { role: 'admin', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(adminDb,'users','active-uid'), { username: 'suplantada', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(memberDb,'users','pending-uid'), {
    displayName: 'Atacante', status: 'active', approvedAt: serverTimestamp(),
    approvedBy: 'admin-uid', updatedAt: serverTimestamp(),
  }));
});
test('restauración: solo administrador importa platillo con autor histórico y clasificación saludable', async () => {
  const adminDb = authUser('admin-uid','admin@users.novacore');
  const memberDb = authUser('active-uid','ana@users.novacore');
  const data = { ...dishDocument('active-uid', 'Receta histórica'),
    status: 'archived', approvedForHealthyMenu: true,
    createdAt: new Date('2025-01-01T00:00:00.000Z'), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(adminDb,'dishes','hist-restore'), data));
  await assertFails(setDoc(doc(memberDb,'dishes','evil-restore'), data));
});
test('restauración: el administrador recupera selección histórica, usuario ordinario no edita ajena', async () => {
  const adminDb = authUser('admin-uid','admin@users.novacore');
  const memberDb = authUser('active-uid','ana@users.novacore');
  const snapshot = { userId: 'active-uid', status: 'selected',
    dishes: [{ dishId: 'hist-restore', nameSnapshot: 'Nombre histórico' }], note: 'Sin sal',
    createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(adminDb,'cycles/2030-11-11/wishes/active-uid'), snapshot));
  await assertFails(setDoc(doc(memberDb,'cycles/2030-11-11/wishes/admin-uid'), { ...snapshot, userId: 'admin-uid' }));
});
