import { addDays, cycleStartForDate } from './dates.js';

/** Returns to the week containing today, regardless of the currently visible cycle. */
export function calendarTodayState(today, anchorMonday) {
  const firstDay = cycleStartForDate(today, anchorMonday);
  return { cycleOffset: 0, calendarView: 'week', weekIndex: today > addDays(firstDay, 6) ? 1 : 0 };
}
