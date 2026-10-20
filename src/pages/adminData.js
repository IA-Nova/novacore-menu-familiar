import { escapeHtml as h } from '../utils/html.js';
import { backupCounts } from '../utils/backupValidation.js';
import { currentMexicoDate, cycleStartForDate, addDays, formatDate } from '../utils/dates.js';

const labels = { config: 'Configuración', users: 'Integrantes', dishes: 'Platillos',
  dishPhotos: 'Fotografías', dishThumbnails: 'Miniaturas', cycles: 'Ciclos', wishes: 'Antojos' };

export function renderAdminHistory(state) {
  const current = cycleStartForDate(currentMexicoDate(), state.config?.anchorMonday);
  const next = addDays(current, 14);
  const rows = state.recentCycles || [];
  return `<section class="surface-card admin-people" id="admin-history">
    <div class="section-top"><div><p class="eyebrow">PLANIFICACIÓN</p><h2>Ciclos e historial</h2></div>
    <button class="btn btn-outline btn-small" type="button" data-action="admin-history-refresh">Actualizar</button></div>
    <div class="calendar-edit-actions"><button class="btn btn-primary" type="button" data-action="admin-prepare-next">Preparar siguiente ciclo</button>
    <button class="btn btn-outline" type="button" data-action="admin-cycle-open" data-value="${h(next)}">Ver siguiente ciclo</button></div>
    ${state.historyError ? `<p class="notice-text" role="alert">${h(state.historyError)}</p>` : ''}
    ${state.historyLoading ? '<p class="muted-label">Consultando ciclos...</p>' : rows.length
      ? `<div class="admin-cycle-list">${rows.map(c => `<div class="admin-cycle-row">
        <div><strong>${h(formatDate(c.startDate))} – ${h(formatDate(c.endDate))}</strong>
        <small>${c.startDate < current ? 'Anterior' : c.startDate === current ? 'Actual' : 'Próximo'} · ${c.days?.filter(d => d.type === 'wish').length ?? 0} espacios de antojo</small></div>
        <button class="btn btn-outline btn-small" type="button" data-action="admin-cycle-open" data-value="${h(c.startDate)}">Ver ciclo</button>
        </div>`).join('')}</div>`
      : '<p class="muted-label">Aún no hay ciclos preparados.</p>'}
    ${rows.length === 40 ? '<p class="muted-label">Puedes consultar ciclos anteriores desde las flechas del calendario.</p>' : ''}
  </section>`;
}

export function renderAdminBackups(state) {
  const preview = state.backupPreview;
  const counts = preview ? backupCounts(preview) : null;
  return `<section class="surface-card admin-people" id="admin-backups">
    <div class="section-top"><div><p class="eyebrow">DATOS</p><h2>Respaldos y restauración</h2></div></div>
    <p>Descarga una copia privada de los platillos, fotografías, integrantes, antojos y calendarios.</p>
    <div class="calendar-edit-actions"><button type="button" class="btn btn-primary" data-action="admin-backup-export" ${state.backupBusy ? 'disabled' : ''}>Descargar respaldo JSON</button></div>
    <div class="admin-backup-upload"><h3>Restaurar un respaldo</h3>
      <label class="dish-field"><span>Selecciona un archivo JSON</span><input id="admin-backup-file" type="file" accept=".json,application/json" ${state.backupBusy ? 'disabled' : ''}></label>
      ${state.backupFileName ? `<p class="muted-label">${h(state.backupFileName)}</p>` : ''}
      ${counts ? `<div class="admin-backup-preview"><strong>Contenido del respaldo</strong><div class="admin-backup-stats">
        ${Object.entries(counts).map(([key, count]) => `<div><strong>${count}</strong><small>${h(labels[key])}</small></div>`).join('')}
        </div><p class="muted-label">Fecha del respaldo: ${h(new Date(preview.exportedAt).toLocaleString('es-MX', {timeZone:'America/Mexico_City'}))}.</p>
        <p>Se actualizarán los registros incluidos en el archivo. Los registros adicionales se conservarán. Las cuentas deben existir en Firebase; esta operación no restaura contraseñas.</p>
        <button type="button" class="btn btn-primary" data-action="admin-backup-restore" ${state.backupBusy ? 'disabled' : ''}>Restaurar datos</button></div>` : ''}
    </div>
    ${state.backupProgress ? `<p role="status" class="notice-text">${h(state.backupProgress)}</p>` : ''}
    ${state.backupError ? `<p role="alert" class="notice-text">${h(state.backupError)}</p>` : ''}
  </section>`;
}
