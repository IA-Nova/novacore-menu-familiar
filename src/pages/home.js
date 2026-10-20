import { pageHeader, emptyIllustration } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { mealForDay, visibleCycle } from '../models/menu.js';
import { currentMexicoDate, cycleStartForDate, formatDate, addDays } from '../utils/dates.js';
import { escapeHtml } from '../utils/html.js';

export function renderHome(state) {
  const today = currentMexicoDate();
  const cycleStart = cycleStartForDate(today, state.config?.anchorMonday);
  const cycle = visibleCycle(state, cycleStart);
  const hasMeal = d => d.type === 'wish' || (d.healthyDishes?.length || 0) > 0;
  const nextDay = cycle.days.find(d => d.date >= today && hasMeal(d)) ||
    cycle.days.find(d => d.date >= today) || cycle.days[0];
  const meal = mealForDay(nextDay, state);
  const thisWeek = today <= addDays(cycleStart, 6) ? cycle.days.slice(0, 7) : cycle.days.slice(7);
  const heading = pageHeader('UN MENÚ PARA COMPARTIR', '¿Qué vamos a comer?', 'Consulta las comidas y los antojos de la familia.');
  const weekItems = thisWeek.slice(0, 5).map((d) => {
    const food = mealForDay(d, state);
    return `<div class="week-row"><div class="week-date"><strong>${formatDate(d.date, true).split(',')[0]}</strong><small>${formatDate(d.date)}</small></div>
      <span class="type-marker ${d.type === 'wish' ? 'wish' : 'free'}">${icon(d.type === 'wish' ? 'heart' : 'utensils', 17)}</span>
      <div class="week-meal"><strong>${escapeHtml(food.title)}</strong><small>${escapeHtml(food.description)}</small></div></div>`;
  }).join('');
  return `${heading}
    <div class="hero-panel"><div class="hero-copy"><span class="hero-kicker">CICLO ACTUAL · ${formatDate(cycleStart)} – ${formatDate(cycle.endDate)}</span>
      <h2>El menú de nuestra familia</h2><p>Dos semanas para compartir comidas y antojos.</p>
      <a href="#/calendario" class="btn btn-light">Ver calendario ${icon('arrow', 17)}</a></div><div class="hero-art" aria-hidden="true"><div class="hero-plate"></div><div class="hero-fork"></div><div class="hero-leaf one"></div><div class="hero-leaf two"></div></div></div>
    <div class="stats-grid"><div class="stat-card"><span class="stat-icon blue">${icon('calendar')}</span><strong>14 días</strong><span>por cada ciclo</span></div>
      <div class="stat-card"><span class="stat-icon pink">${icon('heart')}</span><strong>5 antojos</strong><span>uno por persona</span></div>
      <div class="stat-card"><span class="stat-icon lavender">${icon('utensils')}</span><strong>${cycle.days.filter(d => d.type !== 'wish' && d.healthyDishes?.length).length} comidas</strong><span>planeadas en días libres</span></div></div>
    <div class="content-grid"><section class="surface-card next-meal"><div class="section-top"><div><p class="eyebrow">EN EL CALENDARIO</p><h2>Próxima comida planeada</h2></div><span class="pill ${nextDay.type === 'wish' ? 'wish' : 'free'}">${nextDay.type === 'wish' ? 'Antojo' : 'Libre'}</span></div>
      <div class="next-meal-grid">${emptyIllustration()}<div><p class="muted-label">${formatDate(nextDay.date, true)}</p><h3>${escapeHtml(meal.title)}</h3><p>${escapeHtml(meal.description)}</p><a class="text-link" href="#/calendario">Ver detalles ${icon('arrow', 16)}</a></div></div></section>
      <section class="surface-card"><div class="section-top"><div><p class="eyebrow">ORGANIZACIÓN</p><h2>Esta semana</h2></div><a class="text-link" href="#/calendario">Ver más ${icon('arrow', 15)}</a></div><div class="week-list">${weekItems}</div></section></div>`;
}
