/**
 * La vista principal de la aplicación es Calendario.
 * Se mantienen los enlaces antiguos a Inicio como alias para no romper marcadores.
 */
export function needsCalendarRedirect(hash = '') {
  const path = hash.split('?')[0];
  return path === '' || path === '#' || path === '#/' || path === '#/inicio';
}

export function routeFromHash(hash = '') {
  if (needsCalendarRedirect(hash)) return 'calendario';
  return hash.startsWith('#/') ? hash.slice(2).split('?')[0] || 'calendario' : 'calendario';
}
