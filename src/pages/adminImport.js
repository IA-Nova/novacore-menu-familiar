import { escapeHtml as h } from '../utils/html.js';

const label = status => ({ nueva: 'Nueva', existente: 'Ya está en el recetario', repetida: 'Repetida en el archivo' }[status]);

export function renderAdminDishImport(state) {
  const rows = state.dishImportPreview;
  const ready = rows?.filter(row => row.status === 'nueva').length ?? 0;
  const skipped = rows ? rows.length - ready : 0;
  return `<section class="surface-card admin-people" id="admin-import-recipes">
    <div class="section-top"><div><p class="eyebrow">RECETARIO</p><h2>Importar recetas</h2></div></div>
    <p>Agrega varias recetas al recetario desde un archivo JSON o pegando su contenido.</p>
    <form data-form="admin-dish-import-preview" class="dish-import-form">
      <label class="dish-field"><span>Archivo JSON</span><input type="file" name="importFile" accept=".json,application/json" ${state.dishImportBusy ? 'disabled' : ''}></label>
      <label class="dish-field"><span>O pega el JSON aquí</span><textarea name="importText" rows="4" placeholder='[{"name":"Arroz rojo", "approvedForHealthyMenu":true}]' ${state.dishImportBusy ? 'disabled' : ''}>${h(state.dishImportText || '')}</textarea></label>
      <button class="btn btn-outline" type="submit" ${state.dishImportBusy ? 'disabled' : ''}>Revisar recetas</button>
    </form>
    ${rows ? `<div class="dish-import-preview" role="region" aria-label="Vista previa de recetas">
      <h3>Vista previa · ${rows.length} ${rows.length === 1 ? 'receta' : 'recetas'}</h3>
      <p>${ready} ${ready === 1 ? 'receta nueva' : 'recetas nuevas'} · ${skipped} ${skipped === 1 ? 'omitida' : 'omitidas'} por duplicado.</p>
      <ol class="dish-import-list">${rows.map(({ dish, status }) => `<li class="dish-import-row"><div><strong>${h(dish.name)}</strong>
        <small>${dish.approvedForHealthyMenu ? 'Saludable' : 'Sin marca saludable'}${dish.tags.length ? ` · ${h(dish.tags.join(', '))}` : ''}${dish.prepMinutes ? ` · ${dish.prepMinutes} min` : ''}</small></div>
        <span class="pill ${status === 'nueva' ? 'healthy' : 'neutral'}">${h(label(status))}</span></li>`).join('')}</ol>
      ${ready ? `<div class="calendar-edit-actions"><button type="button" class="btn btn-primary" data-action="admin-dish-import-save" ${state.dishImportBusy ? 'disabled' : ''}>Importar ${ready} ${ready === 1 ? 'receta' : 'recetas'}</button>
        <button type="button" class="btn btn-outline" data-action="admin-dish-import-cancel" ${state.dishImportBusy ? 'disabled' : ''}>Descartar selección</button></div>`
        : `<button type="button" class="btn btn-outline" data-action="admin-dish-import-cancel">Cerrar vista previa</button>`}
    </div>` : ''}
    ${state.dishImportBusy ? '<p role="status" class="notice-text">Procesando recetas...</p>' : ''}
    ${state.dishImportMessage ? `<p role="status" class="notice-text">${h(state.dishImportMessage)}</p>` : ''}
    ${state.dishImportError ? `<p role="alert" class="notice-text">${h(state.dishImportError)}</p>` : ''}
  </section>`;
}
