import { renderAdminHistory, renderAdminBackups } from './adminData.js';
import { renderAdminDishImport } from './adminImport.js';
import { pageHeader } from '../components/layout.js';
import { escapeHtml } from '../utils/html.js';

export function renderAdmin(state) {
  const users = state.adminUsers || [];
  const pending = users.filter((u) => u.status === 'pending');
  const active = users.filter((u) => u.status === 'active');
  const disabled = users.filter((u) => u.status === 'disabled');
  const row = (u) => `<div class="admin-user-row"><span class="wish-avatar">${escapeHtml(u.displayName?.[0]?.toUpperCase() || 'U')}</span><div class="admin-user-meta"><strong>${escapeHtml(u.displayName || u.username)}</strong><small>@${escapeHtml(u.username)}</small></div><span class="pill ${u.status === 'active' ? 'healthy' : 'neutral'}">${{ pending: 'Pendiente', active: 'Activo', disabled: 'Desactivado' }[u.status] || 'Desconocido'}</span>
    ${u.uid !== state.profile?.uid ? `<div class="admin-user-actions">${u.status !== 'active' ? `<button type="button" class="btn btn-primary btn-small" data-action="approve-user" data-value="${escapeHtml(u.uid)}">Aprobar</button>` : ''}${u.status !== 'disabled' ? `<button type="button" class="btn btn-outline btn-small" data-action="disable-user" data-value="${escapeHtml(u.uid)}">Desactivar</button>` : ''}</div>` : ''}</div>`;
  const planDraft = state.templateDraft;
  const names = { wish: 'Antojo', free: 'Libre' };
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const templateForm = planDraft ? `<form class="admin-template-form" data-form="admin-template">
    <label class="dish-field"><span>Nombre de la familia</span><input required maxlength="60" name="familyName" value="${escapeHtml(planDraft.familyName)}"></label>
    <div class="admin-template-days">${planDraft.dayTypes.map((type, i) => `<label class="admin-template-day"><span>Semana ${i < 7 ? 1 : 2} · ${weekDays[i % 7]}</span><select name="day-${i}">${Object.entries(names).map(([value, label]) => `<option value="${value}" ${type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="calendar-edit-actions"><button type="submit" class="btn btn-primary">Guardar distribución</button><button type="button" class="btn btn-outline" data-action="admin-template-cancel">Cancelar</button></div>
    </form>` : `<button type="button" class="btn btn-outline" data-action="admin-template-edit">Modificar distribución futura</button>`;
  return `${pageHeader('SOLO ADMINISTRADOR', 'Administración', 'Gestiona el acceso de los integrantes de la familia.')}
    ${state.notice ? `<p class="notice-text" role="status">${escapeHtml(state.notice)}</p>` : ''}
    <div class="admin-summary"><div class="surface-card"><strong>${pending.length}</strong><span>Solicitudes pendientes</span></div><div class="surface-card"><strong>${active.length}</strong><span>Integrantes activos</span></div></div>
    <section class="surface-card admin-people"><h2>Solicitudes pendientes</h2>${pending.length ? pending.map(row).join('') : '<p class="muted-label">No hay solicitudes pendientes.</p>'}</section>
    <section class="surface-card admin-people"><h2>Integrantes activos</h2>${active.length ? active.map(row).join('') : '<p class="muted-label">Todavía no hay integrantes.</p>'}</section>
    ${disabled.length ? `<section class="surface-card admin-people"><h2>Cuentas desactivadas</h2>${disabled.map(row).join('')}</section>` : ''}
    <section class="surface-card admin-people"><div class="section-top"><div><p class="eyebrow">PLANIFICACIÓN</p><h2>Distribución de nuevos ciclos</h2></div></div>${templateForm}</section>
    ${state.cycle && state.wishes?.some(w => w.status === 'declined' && !state.cycle.lockedWishes?.includes(w.userId))
      ? `<section class="surface-card admin-people"><h2>Renuncias del ciclo actual</h2><p>Al cerrar una renuncia, su fecha asignada quedará disponible para elegir cualquier comida.</p>
        ${state.wishes.filter(w => w.status === 'declined' && !state.cycle.lockedWishes?.includes(w.userId)).map(w => {
          const u = state.adminUsers.find(p => p.uid === w.userId) || state.familyUsers.find(p => p.uid === w.userId);
          return `<div class="admin-user-row"><div class="admin-user-meta"><strong>${escapeHtml(u?.displayName || 'Integrante')}</strong></div><button type="button" class="btn btn-outline btn-small" data-action="admin-finalize-decline" data-value="${escapeHtml(w.userId)}">Cerrar renuncia</button></div>`;
        }).join('')}</section>` : ''}
    ${renderAdminHistory(state)}
    ${renderAdminDishImport(state)}
    ${renderAdminBackups(state)}`;
}
