import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/auth.css';
import { pageLayout } from './components/layout.js';
import { renderHome } from './pages/home.js';
import { renderCalendar } from './pages/calendar.js';
import { renderWishes } from './pages/wishes.js';
import { renderRecipes } from './pages/recipes.js';
import { renderAdmin } from './pages/admin.js';
import { renderProfile } from './pages/profile.js';
import { renderLogin, renderRegister, renderGate } from './pages/access.js';
import { firebaseConfigured, firebaseConfig } from './services/firebase.js';
import { listenAuth, signIn, signUp, signOut, createPendingProfile, changePassword } from './services/authService.js';
import { watchProfile, watchFamily, watchAdminUsers, updateApproval, updateDisplayName } from './services/userService.js';
import { watchConfig, watchCycle, watchWishes, watchDishes } from './services/menuService.js';
import { saveDish, setDishHealthy, setDishArchived, getFullPhoto, getThumbnail } from './services/dishService.js';
import { duplicateDishNames } from './utils/dishValidation.js';
import { currentMexicoDate, cycleStartForDate, addDays, DEFAULT_DAY_TYPES } from './utils/dates.js';
import { saveCycleEdit, saveTemplate, finalizeWishDecline } from './services/cycleService.js';
import { MAX_HEALTHY_DISHES } from './utils/cyclePlanning.js';
import { dateToEpochDay } from './utils/dates.js';
import { listRecentCycles } from './services/historyService.js';
import { exportFamilyBackup, saveBackupFile, preflightRestore, restoreFamilyBackup } from './services/backupService.js';
import { parseBackup, MAX_BACKUP_BYTES } from './utils/backupValidation.js';
import { calendarTodayState } from './utils/calendarNavigation.js';
import { translateAuthError } from './utils/account.js';
import { prepareWishCycle, saveMyWish } from './services/wishService.js';
import { wishCanEdit } from './utils/wishValidation.js';
import { validateDish } from './utils/dishValidation.js';

const app = document.getElementById('app');
const state = {
  phase: firebaseConfigured ? 'loading' : 'unavailable', user: null, profile: null, config: null,
  familyUsers: [], adminUsers: [], dishes: [], wishes: [], cycle: null,
  calendarView: 'week', weekIndex: 0, cycleOffset: 0,
  recipeQuery: '', recipeFilter: 'all', recipeView: 'cards', recipeTag: '', recipePageSize: 24,
  recipeEditor: null, recipeDetailId: null, recipePhotoFile: null, recipeDraft: null, recipeNotice: '',
  wishDraft: null, wishSearch: '', wishNotice: '',
  calendarMode: 'meal', calendarOrganizeSource: null, calendarOrganizeRevision: null, calendarEditor: null, calendarNotice: '', templateDraft: null,
  recentCycles: [], historyLoading: false, historyError: '', backupPreview: null, backupBusy: false,
  backupProgress: '', backupError: '', backupFileName: '',
  thumbnails: {}, fullDishPhoto: null, notice: '', gateError: '', formError: '',
};
let unsubscribeProfile = null;
let subscriptions = [];
let unsubscribeCycle = null;
let unsubscribeWishes = null;
let unsubscribeDishes = null;
let currentCycleId = '';
const thumbnailRequests = new Set();
const addSubscription = (unsub) => subscriptions.push(unsub);
const safeError = (error) => { state.notice = translateAuthError(error); if (state.phase === 'active') render(); };
function disconnectFamily() {
  subscriptions.forEach((fn) => fn()); subscriptions = [];
  unsubscribeCycle?.(); unsubscribeCycle = null;
  unsubscribeWishes?.(); unsubscribeWishes = null;
  unsubscribeDishes?.(); unsubscribeDishes = null;
  currentCycleId = '';
  state.familyUsers = []; state.adminUsers = []; state.dishes = []; state.wishes = []; state.config = null; state.cycle = null;
  state.thumbnails = {}; state.fullDishPhoto = null; state.recipeEditor = null; state.recipeDetailId = null; state.recipeDraft = null;
  state.wishDraft = null; state.wishSearch = ''; state.wishNotice = '';
  state.calendarEditor = null; state.calendarOrganizeSource = null; state.calendarOrganizeRevision = null; state.calendarNotice = ''; state.templateDraft = null;
  state.backupPreview = null; state.backupBusy = false; state.backupProgress = ''; state.backupError = ''; state.backupFileName = '';
  state.recentCycles = []; state.historyLoading = false; state.historyError = '';
}
function routeName() { return (location.hash.slice(2).split('?')[0] || 'inicio'); }
function selectedCycleId() {
  const now = currentMexicoDate();
  const base = cycleStartForDate(now, state.config?.anchorMonday);
  const offset = routeName() === 'calendario' ? state.cycleOffset : 0;
  return addDays(base, offset * 14);
}
function connectSelectedCycle() {
  if (state.phase !== 'active') return;
  const id = selectedCycleId();
  if (id === currentCycleId) return;
  unsubscribeCycle?.(); unsubscribeWishes?.();
  currentCycleId = id; state.cycle = null; state.wishes = []; state.wishDraft = null;
  state.calendarEditor = null; state.calendarOrganizeSource = null; state.calendarOrganizeRevision = null; state.calendarNotice = ''; 
  unsubscribeCycle = watchCycle(id, (data) => { if (selectedCycleId() === id) { state.cycle = data; render(); void loadCalendarThumbnails(); } }, safeError);
  unsubscribeWishes = watchWishes(id, (data) => { if (selectedCycleId() === id) { state.wishes = data; render(); void loadCalendarThumbnails(); } }, safeError);
}
// Load only thumbnail documents: full photos remain restricted to recipe detail view.
async function loadThumbnailIds(ids) {
  const missing = [...new Set(ids)].filter(id => id && !(id in state.thumbnails) && !thumbnailRequests.has(id));
  if (!missing.length) return;
  await Promise.all(missing.map(async id => {
    thumbnailRequests.add(id);
    try {
      const photo = await getThumbnail(id);
      if (state.phase === 'active') state.thumbnails[id] = photo;
    } catch {
      if (state.phase === 'active') state.thumbnails[id] = null;
    } finally { thumbnailRequests.delete(id); }
  }));
  if (state.phase === 'active') render();
}
async function loadThumbnails(dishes) {
  await loadThumbnailIds(dishes.filter(d => d.hasPhoto).map(d => d.id));
}
async function loadCalendarThumbnails() {
  if (state.phase !== 'active' || routeName() !== 'calendario' || !state.cycle) return;
  const wishesByUid = new Map(state.wishes.filter(w => w.status === 'selected').map(w => [w.userId, w]));
  const ids = state.cycle.days.flatMap(day => (day.type === 'wish'
    ? wishesByUid.get(day.wishUserId)?.dishes || []
    : day.healthyDishes || []).map(dish => dish.dishId));
  await loadThumbnailIds(ids);
}
function connectDishes() {
  unsubscribeDishes?.();
  unsubscribeDishes = watchDishes((dishes) => {
    state.dishes = dishes; render();
    void loadThumbnails(dishes);
  }, safeError, state.recipePageSize);
}
async function refreshAdminHistory() {
  if (state.phase !== 'active' || state.profile?.role !== 'admin' || state.historyLoading) return;
  state.historyLoading = true; state.historyError = ''; render();
  try { state.recentCycles = await listRecentCycles(); }
  catch (error) { state.historyError = translateAuthError(error); }
  finally { state.historyLoading = false; if (state.phase === 'active') render(); }
}
function connectFamily() {
  disconnectFamily();
  addSubscription(watchConfig((config) => { state.config = config; connectSelectedCycle(); render(); }, safeError));
  addSubscription(watchFamily((users) => { state.familyUsers = users; render(); }, safeError));
  connectDishes();
  if (state.profile.role === 'admin') {
    addSubscription(watchAdminUsers((users) => { state.adminUsers = users; render(); }, safeError));
    void refreshAdminHistory();
  }
  connectSelectedCycle();
}
const titles = { inicio: 'Inicio', calendario: 'Calendario', antojos: 'Antojos', recetario: 'Recetario', administracion: 'Administración', perfil: 'Mi perfil' };
const renderers = {
  inicio: () => renderHome(state), calendario: () => renderCalendar(state),
  antojos: () => renderWishes(state), recetario: () => renderRecipes(state),
  administracion: () => renderAdmin(state), perfil: () => renderProfile(state),
};
function render({ scroll = false, focusSearch = false } = {}) {
  if (state.phase !== 'active') {
    if (state.phase === 'signed-out') app.innerHTML = routeName() === 'registro' ? renderRegister(state.formError) : renderLogin(state.formError);
    else app.innerHTML = renderGate(state.phase, state.gateError);
    document.title = 'Acceso | NovaCore Menú Familiar';
    return;
  }
  const requested = routeName();
  const route = renderers[requested] && (requested !== 'administracion' || state.profile.role === 'admin') ? requested : 'inicio';
  app.innerHTML = pageLayout(route, renderers[route](), { ...state.profile, familyName: state.config?.familyName });
  document.title = `${titles[route]} | NovaCore Menú Familiar`;
  if (focusSearch && route === 'recetario') {
    const input = document.getElementById('recipe-search');
    input?.focus(); input?.setSelectionRange(input.value.length, input.value.length);
  }
  if (scroll) { window.scrollTo(0, 0); document.getElementById('main-content')?.focus({ preventScroll: true }); }
}
function showFormFeedback(form, error, success = false) {
  form.querySelector('.form-feedback')?.remove();
  const node = document.createElement('p'); node.className = `form-feedback ${success ? 'is-success' : ''}`;
  node.setAttribute('role', 'status'); node.textContent = error;
  form.prepend(node);
}
function onProfile(profile) {
  if (!profile) {
    if (state.phase === 'active') disconnectFamily();
    state.profile = null; state.phase = 'incomplete'; render(); return;
  }
  const wasActive = state.phase === 'active';
  const prevRole = state.profile?.role;
  state.profile = profile;
  if (profile.status === 'active') {
    state.phase = 'active';
    if (!wasActive || prevRole !== profile.role) connectFamily();
  } else {
    if (wasActive) disconnectFamily();
    state.phase = profile.status === 'pending' ? 'pending' : 'disabled';
  }
  render();
}
if (firebaseConfigured) listenAuth((user) => {
  unsubscribeProfile?.(); unsubscribeProfile = null; disconnectFamily();
  state.user = user; state.profile = null; state.formError = ''; state.gateError = '';
  if (!user) { state.phase = 'signed-out'; render(); return; }
  state.phase = 'loading'; render();
  unsubscribeProfile = watchProfile(user.uid, onProfile, (error) => { state.phase = 'unavailable'; state.gateError = translateAuthError(error); render(); });
}, (error) => { state.phase = 'unavailable'; state.gateError = translateAuthError(error); render(); });

// A single delegated handler is used for the application controls.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action; const value = button.dataset.value;
  if (action === 'signout') { try { await signOut(); } catch (error) { state.gateError = translateAuthError(error); render(); } return; }
  if (action === 'reload') { window.location.reload(); return; }
  if (action === 'repair-profile' && state.user) {
    try { await createPendingProfile(state.user); } catch (error) { state.gateError = translateAuthError(error); render(); }
    return;
  }
  if (state.phase !== 'active') return;
  if (state.backupBusy) return;
  if (action === 'admin-finalize-decline' && state.profile.role === 'admin' && state.cycle) {
    if (!window.confirm('¿Cerrar esta renuncia? Si tiene fecha asignada, quedará como día libre para elegir comida.')) return;
    const assigned = state.cycle.days.find(day => day.type === 'wish' && day.wishUserId === value);
    if (assigned?.date < currentMexicoDate() &&
      !window.confirm('Esto corregirá una fecha del historial. ¿Confirmas el cambio?')) return;
    button.disabled = true;
    try {
      await finalizeWishDecline(state.cycle.startDate, value);
      state.notice = 'Renuncia cerrada. El calendario fue actualizado.';
    } catch (error) { state.notice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'admin-history-refresh' && state.profile.role === 'admin') {
    void refreshAdminHistory(); return;
  }
  if (action === 'admin-cycle-open' && state.profile.role === 'admin') {
    const todayStart = cycleStartForDate(currentMexicoDate(), state.config?.anchorMonday);
    const diff = dateToEpochDay(value) - dateToEpochDay(todayStart);
    if (diff % 14 !== 0) return;
    state.cycleOffset = diff / 14;
    state.weekIndex = 0;
    state.calendarView = 'cycle';
    state.calendarEditor = null;
    location.hash = '#/calendario';
    connectSelectedCycle(); render({ scroll: true }); return;
  }
  if (action === 'admin-prepare-next' && state.profile.role === 'admin') {
    const start = addDays(cycleStartForDate(currentMexicoDate(), state.config?.anchorMonday), 14);
    button.disabled = true;
    try {
      const created = await prepareWishCycle(start, state.config?.defaultDayTypes);
      state.notice = created ? 'Se preparó el siguiente ciclo.' : 'El siguiente ciclo ya está preparado.';
      await refreshAdminHistory();
    } catch (error) { state.notice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'admin-backup-export' && state.profile.role === 'admin') {
    state.backupBusy = true; state.backupError = ''; state.backupProgress = 'Preparando respaldo...'; render();
    try {
      const backup = await exportFamilyBackup(state.user.uid, progress => { state.backupProgress = progress; render(); });
      saveBackupFile(backup); state.backupProgress = 'Respaldo descargado correctamente.';
    } catch (error) { state.backupError = translateAuthError(error); state.backupProgress = ''; }
    finally { state.backupBusy = false; render(); }
    return;
  }
  if (action === 'admin-backup-restore' && state.profile.role === 'admin' && state.backupPreview) {
    const backup = state.backupPreview;
    if (!window.confirm('Se reemplazarán los datos incluidos en el respaldo. La operación puede modificar menús y antojos actuales. ¿Deseas continuar?')) return;
    if (window.prompt('Para confirmar, escribe RESTAURAR:') !== 'RESTAURAR') return;
    state.backupBusy = true; state.backupError = ''; state.backupProgress = 'Verificando cuentas y datos...'; render();
    try {
      await restoreFamilyBackup(backup, state.user.uid, progress => { state.backupProgress = progress; render(); });
      state.backupProgress = 'Restauración terminada. Los datos se actualizaron.';
      state.backupPreview = null;
      await refreshAdminHistory();
    } catch (error) {
      state.backupError = `Restauración detenida: ${translateAuthError(error)}. Si ya se escribieron registros, conserva el respaldo y revisa los datos antes de repetir.`;
    } finally { state.backupBusy = false; render(); }
    return;
  }
  if (action === 'calendar-view') state.calendarView = value;
  if (action === 'calendar-today') {
    Object.assign(state, calendarTodayState(currentMexicoDate(), state.config?.anchorMonday));
  }
  if (action === 'calendar-prev') {
    if (state.calendarView === 'cycle') state.cycleOffset--;
    else if (state.weekIndex === 0) { state.cycleOffset--; state.weekIndex = 1; }
    else state.weekIndex = 0;
  }
  if (action === 'calendar-next') {
    if (state.calendarView === 'cycle') state.cycleOffset++;
    else if (state.weekIndex === 1) { state.cycleOffset++; state.weekIndex = 0; }
    else state.weekIndex = 1;
  }
  if (action === 'calendar-open-cycle') {
    if (state.profile.role !== 'admin' || state.cycle) return;
    button.disabled = true;
    try {
      await prepareWishCycle(selectedCycleId(), state.config?.defaultDayTypes);
      state.calendarNotice = 'El ciclo está listo para organizarse.';
    } catch (error) { state.calendarNotice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'calendar-organize') {
    if (state.profile.role !== 'admin' || !state.cycle) return;
    state.calendarMode = state.calendarMode === 'organize' ? 'meal' : 'organize';
    state.calendarOrganizeSource = null; state.calendarOrganizeRevision = null; state.calendarEditor = null;
    state.calendarNotice = ''; state.calendarView = 'cycle'; render(); return;
  }
  if (action === 'calendar-day-select') {
    if (state.profile.role !== 'admin' || !state.cycle || state.calendarMode !== 'organize') return;
    if (!state.calendarOrganizeSource || state.calendarOrganizeSource === value) {
      state.calendarOrganizeSource = state.calendarOrganizeSource === value ? null : value;
      state.calendarOrganizeRevision = state.calendarOrganizeSource ? state.cycle.revision : null;
      render(); return;
    }
    const first = state.calendarOrganizeSource;
    if (!window.confirm(`¿Intercambiar las comidas del ${first} y el ${value}?`)) return;
    const history = [first, value].some(d => d < currentMexicoDate());
    if (history && !window.confirm('Se corregirá el historial de fechas anteriores. ¿Continuar?')) return;
    button.disabled = true;
    try {
      await saveCycleEdit({ cycleId: selectedCycleId(), expectedRevision: state.calendarOrganizeRevision,
        operation: 'swap', firstDate: first, secondDate: value,
        confirmedHistory: history, today: currentMexicoDate() });
      state.calendarOrganizeSource = null; state.calendarOrganizeRevision = null; state.calendarNotice = 'Días intercambiados correctamente.';
    } catch (error) { state.calendarNotice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'calendar-day-edit') {
    if (state.profile.role !== 'admin' || !state.cycle) return;
    const day = state.cycle.days.find(d => d.date === value);
    if (!day || (state.calendarMode === 'meal' && day.type === 'wish')) return;
    state.calendarEditor = { date: day.date, baseRevision: state.cycle.revision, type: day.type === 'healthy' ? 'free' : day.type, wishUserId: day.wishUserId,
      healthyDishes: structuredClone(day.healthyDishes) };
    state.calendarNotice = ''; render(); document.getElementById('calendar-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
  }
  if (action === 'calendar-edit-cancel') { state.calendarEditor = null; render(); return; }
  if (['calendar-dish-remove', 'calendar-dish-up', 'calendar-dish-down'].includes(action)) {
    const draft = state.calendarEditor;
    if (state.profile.role !== 'admin' || !draft || draft.type === 'wish') return;
    const index = draft.healthyDishes.findIndex(d => d.dishId === value); if (index < 0) return;
    if (action === 'calendar-dish-remove') draft.healthyDishes.splice(index, 1);
    else {
      const newIndex = index + (action === 'calendar-dish-up' ? -1 : 1);
      if (newIndex < 0 || newIndex >= draft.healthyDishes.length) return;
      [draft.healthyDishes[index], draft.healthyDishes[newIndex]] =
        [draft.healthyDishes[newIndex], draft.healthyDishes[index]];
    }
    render(); return;
  }
  if (action === 'calendar-edit-save') {
    if (state.profile.role !== 'admin' || !state.cycle || !state.calendarEditor) return;
    const draft = state.calendarEditor;
    const history = draft.date < currentMexicoDate();
    if (!window.confirm(`¿Guardar la comida del ${draft.date}?`)) return;
    if (history && !window.confirm('Se corregirá el historial de una fecha anterior. ¿Continuar?')) return;
    button.disabled = true;
    try {
      await saveCycleEdit({ cycleId: selectedCycleId(), expectedRevision: draft.baseRevision,
        operation: 'edit', firstDate: draft.date, draft,
        familyUsers: state.familyUsers, dishes: state.dishes,
        confirmedHistory: history, today: currentMexicoDate() });
      state.calendarEditor = null; state.calendarNotice = 'Comida guardada correctamente.';
    } catch (error) { state.calendarNotice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'admin-template-edit') {
    if (state.profile.role !== 'admin') return;
    state.templateDraft = { familyName: state.config?.familyName || 'Mi familia',
      dayTypes: [...(state.config?.defaultDayTypes || DEFAULT_DAY_TYPES)].map(t => t === 'healthy' ? 'free' : t) };
    render(); return;
  }
  if (action === 'admin-template-cancel') { state.templateDraft = null; render(); return; }
  if (action === 'wish-open-cycle') {
    if (state.profile.role !== 'admin') return;
    button.disabled = true;
    try {
      await prepareWishCycle(selectedCycleId(), state.config?.defaultDayTypes);
      state.wishNotice = 'La selección de este ciclo está abierta.';
    } catch (error) { state.wishNotice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'wish-edit') {
    if (!wishCanEdit(state.cycle, state.user.uid)) return;
    const wish = state.wishes.find(w => w.userId === state.user.uid);
    state.wishDraft = { selection: wish?.status === 'selected' ? wish.dishes.map(d => d.dishId) : [],
      note: wish?.status === 'selected' ? wish.note || '' : '', newNames: {} };
    state.wishNotice = ''; state.wishSearch = '';
    render(); document.getElementById('wish-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
  }
  if (action === 'wish-cancel') { state.wishDraft = null; state.wishSearch = ''; render(); return; }
  if (action === 'wish-toggle-dish' || action === 'wish-remove-dish') {
    if (!state.wishDraft || !wishCanEdit(state.cycle, state.user.uid)) return;
    const selected = state.wishDraft.selection;
    if (selected.includes(value)) state.wishDraft.selection = selected.filter(id => id !== value);
    else {
      if (selected.length >= 6) { state.wishNotice = 'Puedes elegir hasta seis platillos.'; render(); return; }
      const d = state.dishes.find(d => d.id === value);
      if (!d || d.status !== 'active') return;
      selected.push(value);
    }
    state.wishNotice = ''; render(); return;
  }
  if (action === 'wish-decline') {
    if (!state.wishDraft || !wishCanEdit(state.cycle, state.user.uid)) return;
    if (!window.confirm('¿Confirmas que no quieres antojo en este ciclo?')) return;
    button.disabled = true;
    try {
      await saveMyWish({ cycleId: state.cycle.startDate, uid: state.user.uid, selection: [], dishes: [], declined: true });
      state.wishDraft = null; state.wishNotice = 'Registramos tu decisión para este ciclo.';
    } catch (error) { state.wishNotice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'recipe-filter') { state.recipeFilter = value; state.recipeTag = ''; }
  if (action === 'recipe-view') state.recipeView = value;
  if (action === 'dish-new') {
    state.recipeEditor = 'new'; state.recipeDetailId = null; state.recipePhotoFile = null; state.recipeDraft = null; state.recipeNotice = '';
    render(); document.getElementById('dish-name')?.focus(); return;
  }
  if (action === 'dish-cancel') {
    state.recipeEditor = null; state.recipePhotoFile = null; state.recipeDraft = null; state.recipeNotice = ''; render(); return;
  }
  if (action === 'dish-close') { state.recipeDetailId = null; state.fullDishPhoto = null; render(); return; }
  if (action === 'dish-edit') {
    const dish = state.dishes.find(d => d.id === value);
    if (!dish || !(state.profile.role === 'admin' ||
      (dish.createdBy === state.user.uid && !dish.approvedForHealthyMenu))) return;
    state.recipeEditor = dish.id; state.recipeDetailId = null; state.recipePhotoFile = null; state.recipeDraft = null;
    render(); document.getElementById('dish-name')?.focus(); return;
  }
  if (action === 'dish-detail') {
    const dish = state.dishes.find(d => d.id === value); if (!dish) return;
    state.recipeEditor = null; state.recipeDetailId = dish.id; state.fullDishPhoto = null;
    render(); document.getElementById('dish-detail')?.scrollIntoView({ block: 'nearest' });
    if (dish.hasPhoto) {
      try { const photo = await getFullPhoto(dish.id);
        if (state.recipeDetailId === dish.id) { state.fullDishPhoto = { id: dish.id, photo }; render(); }
      } catch { /* A thumbnail or placeholder remains visible. */ }
    }
    return;
  }
  if (action === 'dish-healthy' || action === 'dish-archive') {
    if (state.profile.role !== 'admin') return;
    const dish = state.dishes.find(d => d.id === value); if (!dish) return;
    const archive = action === 'dish-archive';
    const nextStatus = dish.status === 'active' ? 'archived' : 'active';
    if (archive && !window.confirm(nextStatus === 'archived' ?
      `¿Archivar ${dish.name}? No podrá utilizarse en selecciones nuevas.` : `¿Reactivar ${dish.name}?`)) return;
    button.disabled = true;
    try {
      if (archive) await setDishArchived(dish.id, nextStatus);
      else await setDishHealthy(dish.id, !dish.approvedForHealthyMenu);
      state.recipeNotice = archive ? (nextStatus === 'archived' ? 'Platillo archivado.' : 'Platillo reactivado.') : 'Clasificación actualizada.';
    } catch (error) { state.recipeNotice = translateAuthError(error); }
    render(); return;
  }
  if (action === 'recipe-tag') { state.recipeTag = value; render(); return; }
  if (action === 'dish-more') { state.recipePageSize += 24; connectDishes(); return; }
  if (action === 'approve-user' || action === 'disable-user') {
    const user = state.adminUsers.find((u) => u.uid === value);
    if (!user || state.profile.role !== 'admin' || user.uid === state.user?.uid) return;
    const target = action === 'approve-user' ? 'active' : 'disabled';
    if (target === 'active' && state.adminUsers.filter((u) => u.status === 'active').length >= 5) { state.notice = 'Ya hay cinco integrantes activos.'; render(); return; }
    if (!window.confirm(`${target === 'active' ? '¿Aprobar' : '¿Desactivar'} la cuenta de ${user.displayName}?`)) return;
    button.disabled = true;
    try { await updateApproval(value, target, state.user.uid); state.notice = target === 'active' ? 'Cuenta aprobada.' : 'Cuenta desactivada.'; }
    catch (error) { state.notice = translateAuthError(error); }
    render(); return;
  }
  connectSelectedCycle(); render();
  if (action === 'calendar-today') document.querySelector('.day-card.today')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
});
document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-form]'); if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());
  const submit = form.querySelector('button[type=submit]');
  if (submit) submit.disabled = true;
  try {
    if (type === 'login') await signIn(data.username, data.password);
    else if (type === 'register') {
      if (data.password !== data.confirmPassword) throw new Error('Las contraseñas no coinciden.');
      await signUp(data.username, data.password, data.displayName);
    }
    else if (type === 'admin-template') {
      if (state.profile.role !== 'admin') throw new Error('No tienes permiso para editar esta configuración.');
      const types = Array.from({ length: 14 }, (_, i) => data[`day-${i}`]);
      await saveTemplate({ currentConfig: state.config, familyName: data.familyName, dayTypes: types });
      state.templateDraft = null; state.notice = 'Distribución predeterminada actualizada.'; render();
    }
    else if (type === 'wish-quick-dish') {
      if (!state.wishDraft || !wishCanEdit(state.cycle, state.user.uid)) throw new Error('Tu antojo ya no se puede editar.');
      const clean = validateDish({ name: data.name });
      const duplicated = duplicateDishNames(state.dishes, clean.name);
      if (duplicated.length && !window.confirm(`Ya existe «${clean.name}». ¿Quieres agregar un nuevo platillo?`)) return;
      if (state.wishDraft.selection.length >= 6) throw new Error('Puedes elegir hasta seis platillos.');
      const id = await saveDish({ form: { name: clean.name }, uid: state.user.uid });
      state.wishDraft.newNames[id] = clean.name;
      state.wishDraft.selection.push(id);
      state.wishSearch = '';
      state.wishNotice = 'Platillo agregado a tu selección.';
      render();
    }
    else if (type === 'wish') {
      if (!state.wishDraft || !wishCanEdit(state.cycle, state.user.uid)) throw new Error('Tu antojo ya no se puede editar.');
      await saveMyWish({ cycleId: state.cycle.startDate, uid: state.user.uid,
        selection: state.wishDraft.selection, dishes: state.dishes, newNames: state.wishDraft.newNames,
        note: state.wishDraft.note });
      state.wishDraft = null; state.wishNotice = 'Antojo guardado correctamente.';
      render();
    }
    else if (type === 'dish') {
      if (state.phase !== 'active' || !state.user) throw new Error('Debes iniciar sesión.');
      const id = state.recipeEditor !== 'new' ? state.recipeEditor : null;
      const duplicates = duplicateDishNames(state.dishes, data.name, id);
      if (duplicates.length && !window.confirm(`Ya existe un platillo llamado «${data.name}». ¿Quieres guardarlo de todas formas?`)) return;
      const savedId = await saveDish({ id, form: data, file: state.recipePhotoFile, uid: state.user.uid,
        isAdmin: state.profile.role === 'admin' });
      delete state.thumbnails[savedId];
      state.recipeEditor = null; state.recipePhotoFile = null; state.recipeDraft = null;
      void getThumbnail(savedId).then(photo => { state.thumbnails[savedId] = photo; render(); }).catch(() => {});
      state.recipeNotice = id ? 'Platillo actualizado.' : 'Platillo agregado al recetario.';
      render();
    }
    else if (type === 'profile-name') { await updateDisplayName(state.user.uid, data.displayName); showFormFeedback(form, 'Nombre actualizado.', true); }
    else if (type === 'password') { await changePassword(data.currentPassword, data.newPassword); form.reset(); showFormFeedback(form, 'Contraseña actualizada.', true); }
  } catch (error) { showFormFeedback(form, translateAuthError(error)); }
  finally { if (submit?.isConnected) submit.disabled = false; }
});
document.addEventListener('input', (event) => {
  if (event.target.closest('[data-form="dish"]')) {
    state.recipeDraft = Object.fromEntries(new FormData(event.target.form).entries());
  }
  if (event.target.id === 'wish-note' && state.wishDraft) state.wishDraft.note = event.target.value;
  if (event.target.id === 'wish-search') {
    state.wishSearch = event.target.value; render();
    const input = document.getElementById('wish-search');
    input?.focus(); input?.setSelectionRange(input.value.length, input.value.length);
  }
  if (event.target.id === 'recipe-search') { state.recipeQuery = event.target.value; render({ focusSearch: true }); }
});
document.addEventListener('change', async (event) => {
  if (event.target.id === 'admin-backup-file' && state.profile?.role === 'admin') {
    const file = event.target.files?.[0];
    state.backupPreview = null; state.backupFileName = file?.name || '';
    state.backupError = ''; state.backupProgress = ''; state.backupBusy = Boolean(file); render();
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('El respaldo no puede superar 32 MB.');
      const backup = parseBackup(await file.text(), state.user.uid, firebaseConfig.projectId);
      await preflightRestore(backup, state.user.uid);
      state.backupPreview = backup;
      state.backupProgress = 'Respaldo validado. Revisa el contenido antes de restaurar.';
    } catch (error) { state.backupError = translateAuthError(error); }
    finally { state.backupBusy = false; render(); }
    return;
  }
  if (event.target.id === 'calendar-day-type' && state.calendarEditor && state.calendarMode === 'organize') {
    state.calendarEditor.type = event.target.value;
    if (state.calendarEditor.type === 'wish') state.calendarEditor.healthyDishes = [];
    render(); return;
  }
  if (event.target.id === 'calendar-day-owner' && state.calendarEditor && state.calendarMode === 'organize') {
    state.calendarEditor.wishUserId = event.target.value || null; return;
  }
  if (event.target.id === 'calendar-dish-picker' && state.calendarEditor && state.calendarMode === 'meal') {
    const id = event.target.value; const d = state.dishes.find(d => d.id === id);
    if (d && d.status === 'active' && !state.calendarEditor.healthyDishes.some(p => p.dishId === id)) {
      if (state.calendarEditor.healthyDishes.length >= MAX_HEALTHY_DISHES) { state.calendarNotice = `Máximo ${MAX_HEALTHY_DISHES} platillos.`; render(); return; }
      state.calendarEditor.healthyDishes.push({ dishId: d.id, nameSnapshot: d.name });
      render();
    } return;
  }
  if (event.target.id === 'dish-photo') {
    state.recipePhotoFile = event.target.files?.[0] ?? null;
    const status = document.getElementById('dish-photo-status');
    if (status) status.textContent = state.recipePhotoFile ? state.recipePhotoFile.name : 'Sin fotografía seleccionada.';
  }
});
window.addEventListener('hashchange', () => { if (state.phase === 'active') connectSelectedCycle(); render({ scroll: true }); void loadCalendarThumbnails(); });
if (!location.hash || location.hash === '#') location.replace(`${location.pathname}${location.search}#/inicio`);
render();
