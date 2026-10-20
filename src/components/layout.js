import { icon } from './icons.js';
import { escapeHtml } from '../utils/html.js';

const items = [
  { route: 'calendario', label: 'Calendario', icon: 'calendar' },
  { route: 'antojos', label: 'Antojos', icon: 'heart' },
  { route: 'recetario', label: 'Recetario', icon: 'book' },
];

export function pageLayout(route, content, profile = {}) {
  const navLink = (item) => `<a class="nav-item ${route === item.route ? 'active' : ''}" href="#/${item.route}" ${route === item.route ? 'aria-current="page"' : ''}>
      ${icon(item.icon)}<span>${item.label}</span></a>`;
  return `<div class="app-layout">
    <aside class="sidebar">
      <a href="#/calendario" class="brand" aria-label="NovaCore Menú Familiar, abrir calendario">
        <span class="brand-logo">${icon('utensils', 24)}</span>
        <span><strong>NovaCore</strong><small>Menú Familiar</small></span>
      </a>
      <div class="sidebar-label">TU ESPACIO</div>
      <nav class="sidebar-nav" aria-label="Navegación principal">${items.map(navLink).join('')}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-label">CUENTA</div>
      <nav class="sidebar-nav" aria-label="Opciones de cuenta">
        ${profile.role === 'admin' ? navLink({ route: 'administracion', label: 'Administración', icon: 'settings' }) : ''}
        ${navLink({ route: 'perfil', label: 'Mi perfil', icon: 'user' })}
      </nav>

    </aside>
    <div class="main-area">
      <header class="topbar">
        <a href="#/calendario" class="mobile-brand"><span class="brand-logo">${icon('utensils', 21)}</span><span><strong>NovaCore</strong><small>Menú Familiar</small></span></a>
        <div class="topbar-right"><span class="topbar-family">${escapeHtml(profile.familyName || "Mi familia")}</span>
          ${profile.role === "admin" ? `<a class="topbar-admin" href="#/administracion">Administración</a>` : ""}
          <a class="avatar-link" href="#/perfil" aria-label="Ir a mi perfil">${escapeHtml((profile.displayName || "U").trim().charAt(0).toUpperCase())}</a></div>
      </header>
      <main id="main-content" class="main-content" tabindex="-1">
        ${content}
      </main>
    </div>
    <nav class="bottom-nav" aria-label="Navegación principal móvil">${items.map(navLink).join('')}</nav>
  </div>`;
}

export function pageHeader(eyebrow, title, subtitle = '', action = '') {
  return `<section class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>${action}</section>`;
}

export function emptyIllustration() {
  return `<div class="food-illustration" role="img" aria-label="Sin fotografía: representación ilustrativa de un plato">
    <span class="plate plate-outer"><span class="plate-inner">${icon('utensils', 38)}</span></span>
  </div>`;
}
