import { createCycle, DEFAULT_ANCHOR_MONDAY, DEFAULT_DAY_TYPES } from '../utils/dates.js';
export function visibleCycle(state, start) {
  if (state.cycle?.startDate === start && Array.isArray(state.cycle.days) && state.cycle.days.length === 14) return state.cycle;
  return createCycle(start, state.config?.defaultDayTypes || DEFAULT_DAY_TYPES);
}
export function mealForDay(day, state) {
  if (day.type !== 'wish') {
    return { title: day.healthyDishes?.length ? day.healthyDishes.map((d) => d.nameSnapshot).join(' + ') : 'Comida por definir', description: day.healthyDishes?.length ? 'Menú libre' : 'Día libre' };
  }
  const member = state.familyUsers?.find((u) => u.uid === day.wishUserId);
  const wish = state.wishes?.find((w) => w.userId === day.wishUserId);
  return { title: wish?.status === 'declined' ? 'Antojo renunciado'
    : wish?.status === 'selected' && wish.dishes?.length ? wish.dishes.map((d) => d.nameSnapshot).join(' + ') : 'Antojo por definir',
    description: member ? `Antojo de ${member.displayName}` : 'Antojo sin asignar' };
}
