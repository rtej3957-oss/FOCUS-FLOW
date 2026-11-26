import { Category, RecurringSchedule, TaskPriority } from '../types';
import { addDays, getTodayStr, parseLocalDate, toLocalDateStr } from './date';

export interface ParsedQuickTask {
  title: string;
  dueDate: string;
  dueTime: string;
  priority: TaskPriority | null;
  recurring: RecurringSchedule;
  categoryId: string | null;
  estimatedMinutes: number | null;
  tags: string[];
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function getNextWeekdayDate(targetDay: number): string {
  const today = parseLocalDate(getTodayStr());
  const current = today.getDay();
  let diff = targetDay - current;
  if (diff <= 0) diff += 7;
  today.setDate(today.getDate() + diff);
  return toLocalDateStr(today);
}

export function parseNaturalLanguageTask(rawInput: string, categories: Category[]): ParsedQuickTask {
  let text = rawInput.trim();
  const today = getTodayStr();

  let dueDate = today;
  let dueTime = '';
  let priority: TaskPriority | null = null;
  let recurring: RecurringSchedule = 'none';
  let categoryId: string | null = null;
  let estimatedMinutes: number | null = null;
  const tags: string[] = [];

  // Extract #tags or #category
  text = text.replace(/#([a-zA-Z0-9_-]+)/g, (_, word: string) => {
    const matchedCategory = categories.find((c) => c.name.toLowerCase() === word.toLowerCase());
    if (matchedCategory && !categoryId) {
      categoryId = matchedCategory.id;
    } else {
      tags.push(word.toLowerCase());
    }
    return '';
  });

  // Extract estimated minutes e.g. "45m", "1h", "90 min"
  text = text.replace(/\b(\d+)\s*(min|mins|minutes|m)\b/gi, (_, n: string) => {
    estimatedMinutes = Math.min(480, Math.max(5, Number(n)));
    return '';
  });
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours|h)\b/gi, (_, n: string) => {
    estimatedMinutes = Math.min(480, Math.max(15, Math.round(Number(n) * 60)));
    return '';
  });

  // Extract priority phrases
  const priorityMatch = text.match(/,?\s*\b(urgent|high|medium|low)\s+priority\b|\b!(urgent|high|medium|low)\b/i);
  if (priorityMatch) {
    const p = (priorityMatch[1] || priorityMatch[2]).toLowerCase() as TaskPriority;
    priority = p;
    text = text.replace(priorityMatch[0], '');
  }

  // Extract recurring phrases
  if (/\bevery\s+weekday(s)?\b/i.test(text)) {
    recurring = 'weekdays';
    text = text.replace(/\bevery\s+weekday(s)?\b/gi, '');
  } else if (/\bevery\s+day\b|\bdaily\b/i.test(text)) {
    recurring = 'daily';
    text = text.replace(/\bevery\s+day\b|\bdaily\b/gi, '');
  } else if (/\bevery\s+month\b|\bmonthly\b/i.test(text)) {
    recurring = 'monthly';
    text = text.replace(/\bevery\s+month\b|\bmonthly\b/gi, '');
  } else {
    const everyWeekdayMatch = text.match(
      /\bevery\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i
    );
    if (everyWeekdayMatch) {
      recurring = 'weekly';
      const targetDay = WEEKDAY_MAP[everyWeekdayMatch[1].toLowerCase()];
      if (targetDay !== undefined) {
        dueDate = getNextWeekdayDate(targetDay);
      }
      text = text.replace(everyWeekdayMatch[0], '');
    } else if (/\bevery\s+week\b|\bweekly\b/i.test(text)) {
      recurring = 'weekly';
      text = text.replace(/\bevery\s+week\b|\bweekly\b/gi, '');
    }
  }

  // Extract time like "at 5 PM", "at 17:30", "at 9:15 am"
  const timeMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2}):(\d{2})\b/i);
  if (timeMatch) {
    let hour = Number(timeMatch[1] ?? timeMatch[4]);
    const min = Number(timeMatch[2] ?? timeMatch[5] ?? 0);
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      dueTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    text = text.replace(timeMatch[0], '');
  }

  // Extract date keywords
  if (/\btomorrow\b/i.test(text)) {
    dueDate = addDays(today, 1);
    text = text.replace(/\btomorrow\b/gi, '');
  } else if (/\btoday\b/i.test(text)) {
    dueDate = today;
    text = text.replace(/\btoday\b/gi, '');
  } else if (/\bnext\s+week\b/i.test(text)) {
    dueDate = addDays(today, 7);
    text = text.replace(/\bnext\s+week\b/gi, '');
  } else {
    const onWeekdayMatch = text.match(
      /\b(?:on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
    );
    if (onWeekdayMatch) {
      const targetDay = WEEKDAY_MAP[onWeekdayMatch[1].toLowerCase()];
      if (targetDay !== undefined) {
        dueDate = getNextWeekdayDate(targetDay);
      }
      text = text.replace(onWeekdayMatch[0], '');
    }
  }

  // Infer category from natural text keywords if none specified via #
  if (!categoryId) {
    const lower = rawInput.toLowerCase();
    const keywordMap: Array<[RegExp, string]> = [
      [/\b(gym|workout|run|fitness|yoga|exercise|walk)\b/, 'Fitness'],
      [/\b(exam|study|assignment|lecture|chapter|dbms|homework|thesis)\b/, 'Academics'],
      [/\b(invoice|budget|tax|bank|bill|finance|expense)\b/, 'Finance'],
      [/\b(client|sprint|deploy|meeting|review|report|work|office)\b/, 'Work'],
      [/\b(pitch|startup|business|revenue|marketing|launch)\b/, 'Business'],
    ];
    for (const [rx, catName] of keywordMap) {
      if (rx.test(lower)) {
        const found = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        if (found) {
          categoryId = found.id;
          break;
        }
      }
    }
  }

  // Clean dangling prepositions/punctuation
  const cleanedTitle = text
    .replace(/\s+(on|at|for)\s*$/i, '')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    title: cleanedTitle || rawInput.trim(),
    dueDate,
    dueTime,
    priority,
    recurring,
    categoryId,
    estimatedMinutes,
    tags,
  };
}
