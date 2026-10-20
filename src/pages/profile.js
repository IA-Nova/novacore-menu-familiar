import { pageHeader } from '../components/layout.js';
import { escapeHtml } from '../utils/html.js';

export function renderProfile(state) {
  const p = state.profile;
  return `${pageHeader('TU CUENTA', 'Mi perfil', 'Consulta y actualiza los datos de tu cuenta.')}
    <section class="surface-card profile-placeholder"><span class="profile-avatar">${escapeHtml(p.displayName?.[0]?.toUpperCase() || 'U')}</span><div><h2>${escapeHtml(p.displayName)}</h2><p>Usuario: <strong>@${escapeHtml(p.username)}</strong></p><span class="pill neutral">${p.role === 'admin' ? 'Administrador' : 'Integrante'}</span></div></section>
    <div class="profile-forms"><section class="surface-card"><h2>Nombre para mostrar</h2><form class="access-form" data-form="profile-name"><label>Nombre<input required minlength="2" maxlength="60" name="displayName" value="${escapeHtml(p.displayName)}" autocomplete="name" /></label><button class="btn btn-primary" type="submit">Guardar nombre</button></form></section>
    <section class="surface-card"><h2>Cambiar contraseña</h2><form class="access-form" data-form="password"><label>Contraseña actual<input required type="password" name="currentPassword" autocomplete="current-password" /></label><label>Contraseña nueva<input required type="password" minlength="8" maxlength="128" name="newPassword" autocomplete="new-password" /></label><button class="btn btn-primary" type="submit">Cambiar contraseña</button></form></section></div>
    ${p.role === "admin" ? `<a href="#/administracion" class="btn btn-outline profile-exit">Administración</a>` : ""}
    <button class="btn btn-outline profile-exit" type="button" data-action="signout">Cerrar sesión</button>`;
}
