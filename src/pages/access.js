import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils/html.js';

function accessFrame(body) {
  return `<main class="access-shell"><div class="access-brand"><span class="brand-logo">${icon('utensils', 25)}</span><div><strong>NovaCore</strong><span>Menú Familiar</span></div></div><section class="access-card">${body}</section></main>`;
}
function formError(message) { return message ? `<div class="form-feedback" role="alert">${escapeHtml(message)}</div>` : ''; }
export function renderLogin(error = '') {
  return accessFrame(`<p class="eyebrow">BIENVENIDO</p><h1>Iniciar sesión</h1><p class="subtitle">Entra para consultar el menú de la familia.</p>
    ${formError(error)}<form data-form="login" class="access-form"><label>Usuario<input required name="username" autocomplete="username" minlength="3" maxlength="24" autocapitalize="none" spellcheck="false" /></label>
    <label>Contraseña<input required name="password" type="password" autocomplete="current-password" /></label><button class="btn btn-primary" type="submit">Entrar</button></form>
    <p class="access-toggle">¿Aún no tienes cuenta? <a href="#/registro">Crear cuenta</a></p>`);
}
export function renderRegister(error = '') {
  return accessFrame(`<p class="eyebrow">ÚNETE A LA FAMILIA</p><h1>Crear cuenta</h1><p class="subtitle">Tu acceso estará disponible una vez que sea aprobado.</p>
    ${formError(error)}<form data-form="register" class="access-form"><label>Nombre para mostrar<input required name="displayName" maxlength="60" autocomplete="name" /></label>
    <label>Usuario<input required name="username" minlength="3" maxlength="24" autocapitalize="none" spellcheck="false" autocomplete="username" /></label>
    <label>Contraseña<input required name="password" minlength="8" maxlength="128" type="password" autocomplete="new-password" /></label>
    <label>Confirmar contraseña<input required name="confirmPassword" minlength="8" type="password" autocomplete="new-password" /></label>
    <button type="submit" class="btn btn-primary">Crear cuenta</button></form>
    <p class="access-toggle">¿Ya tienes cuenta? <a href="#/ingresar">Iniciar sesión</a></p>`);
}
export function renderGate(status, error = '') {
  const texts = {
    loading: ['Cargando menú', 'Estamos preparando tu espacio.'],
    pending: ['Solicitud recibida', 'Tu cuenta está pendiente de aprobación.'],
    disabled: ['Acceso no disponible', 'Esta cuenta no tiene acceso al menú familiar.'],
    incomplete: ['Completar mi cuenta', 'No fue posible terminar la creación de tu perfil.'],
    unavailable: ['No se pudo abrir el menú', 'Vuelve a intentarlo más tarde.'],
  };
  const [heading, subtitle] = texts[status] || texts.unavailable;
  return accessFrame(`<p class="eyebrow">NOVACORE</p><h1>${heading}</h1><p class="subtitle">${subtitle}</p>${formError(error)}
    <div class="gate-actions">${status === 'incomplete' ? '<button class="btn btn-primary" data-action="repair-profile">Reintentar</button>' : ''}
    ${['pending', 'disabled', 'incomplete'].includes(status) ? '<button class="btn btn-outline" data-action="signout">Cerrar sesión</button>' : ''}
    ${status === 'unavailable' ? '<button class="btn btn-outline" data-action="reload">Reintentar</button>' : ''}</div>`);
}
