import { Habit, Task } from '../types';

export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStr(): string {
  return toLocalDateStr(new Date());
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(dt.getDate() + days);
  return toLocalDateStr(dt);
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return 'No due date';
  const today = getTodayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  const dt = parseLocalDate(dateStr);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: dt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function isTaskOverdue(task: Pick<Task, 'status' | 'dueDate' | 'dueTime'>): boolean {
  if (task.status === 'completed' || !task.dueDate) return false;
  const now = new Date();
  const today = toLocalDateStr(now);
  if (task.dueDate < today) return true;
  if (task.dueDate > today) return false;
  if (!task.dueTime) return false;
  const [hh, mm] = task.dueTime.split(':').map(Number);
  const dueMinutes = (hh || 0) * 60 + (mm || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > dueMinutes;
}

export function isTaskDueSoon(task: Pick<Task, 'status' | 'dueDate' | 'dueTime'>): boolean {
  if (task.status === 'completed' || !task.dueDate) return false;
  const now = new Date();
  const today = toLocalDateStr(now);
  if (task.dueDate !== today) return false;
  if (!task.dueTime) return true;
  const [hh, mm] = task.dueTime.split(':').map(Number);
  const dueMinutes = (hh || 0) * 60 + (mm || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return dueMinutes >= nowMinutes && dueMinutes - nowMinutes <= 120;
}

export function isWithinNextDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const today = getTodayStr();
  const end = addDays(today, days);
  return dateStr >= today && dateStr <= end;
}

export function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const first = name.trim().split(/\s+/)[0] || 'there';
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

const DAILY_QUOTES = [
  { text: 'Focus is not saying yes to one thing; it is saying no to a hundred good ideas.', author: 'Steve Jobs' },
  { text: 'Simplicity is about subtracting the obvious and adding the meaningful.', author: 'John Maeda' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'What gets measured gets managed, and what gets scheduled gets done.', author: 'Peter Drucker' },
  { text: 'Clarity of mind leads to clarity of action.', author: 'Marcus Aurelius' },
  { text: 'Small daily improvements over time lead to remarkable results.', author: 'Robin Sharma' },
  { text: 'Amateurs sit and wait for inspiration; the rest of us just get up and go to work.', author: 'Stephen King' },
  { text: 'Protect your attention like your most finite resource—because it is.', author: 'Cal Newport' },
];

export function getDailyQuote(): { text: string; author: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

export function getMonthMatrix(year: number, monthIndex: number): string[] {
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const startDate = new Date(year, monthIndex, 1 - startOffset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(startDate);
    dt.setDate(startDate.getDate() + i);
    cells.push(toLocalDateStr(dt));
  }
  return cells;
}

export function getWeekDays(anchorDateStr: string): string[] {
  const anchor = parseLocalDate(anchorDateStr);
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - anchor.getDay());
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sunday);
    dt.setDate(sunday.getDate() + i);
    days.push(toLocalDateStr(dt));
  }
  return days;
}

export function isHabitScheduledForDate(habit: Habit, dateStr: string): boolean {
  const day = parseLocalDate(dateStr).getDay();
  if (habit.scheduleType === 'daily') return true;
  if (habit.scheduleType === 'weekdays') return day >= 1 && day <= 5;
  return habit.targetDays.includes(day);
}

export function calculateHabitStreaks(habit: Habit): { current: number; longest: number } {
  const completedSet = new Set(habit.completedDates);
  const today = getTodayStr();

  // Current streak: walk backwards from today (if today not completed yet, allow starting from yesterday)
  let current = 0;
  let cursor = completedSet.has(today) ? today : addDays(today, -1);

  for (let i = 0; i < 365; i++) {
    const scheduled = isHabitScheduledForDate(habit, cursor);
    if (completedSet.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    } else if (!scheduled) {
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }

  // Longest streak across recorded window
  let longest = current;
  if (habit.completedDates.length > 0) {
    const sorted = [...habit.completedDates].sort();
    const start = sorted[0];
    let run = 0;
    let d = start;
    for (let i = 0; i < 500 && d <= today; i++) {
      const scheduled = isHabitScheduledForDate(habit, d);
      if (completedSet.has(d)) {
        run++;
        if (run > longest) longest = run;
      } else if (scheduled) {
        run = 0;
      }
      d = addDays(d, 1);
    }
  }

  return { current, longest };
}

export function calculateTaskCompletionStreak(tasks: Task[]): number {
  const completedDays = new Set(
    tasks
      .filter((t) => t.status === 'completed' && t.completedAt)
      .map((t) => toLocalDateStr(new Date(t.completedAt!)))
  );
  const today = getTodayStr();
  let cursor = completedDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (completedDays.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}
