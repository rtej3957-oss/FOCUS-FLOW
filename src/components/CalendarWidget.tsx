import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { Task } from '../types';
import { PRIORITY_CONFIG } from '../utils/constants';
import {
  addDays,
  formatTime12h,
  getMonthMatrix,
  getTodayStr,
  getWeekDays,
  isTaskOverdue,
  parseLocalDate,
  toLocalDateStr,
} from '../utils/date';

type CalendarScale = 'month' | 'week' | 'day';

interface CalendarWidgetProps {
  tasks: Task[];
  defaultScale?: CalendarScale;
  compact?: boolean;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 to 21:00

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  tasks,
  defaultScale = 'month',
  compact = false,
}) => {
  const { state, openCreateTaskModal, openEditTaskModal } = useFocusFlow();
  const [scale, setScale] = useState<CalendarScale>(defaultScale);
  const [cursorDate, setCursorDate] = useState<string>(getTodayStr());

  const today = getTodayStr();
  const cursorObj = parseLocalDate(cursorDate);
  const catColorMap = useMemo(
    () => new Map(state.categories.map((c) => [c.id, c.color])),
    [state.categories]
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    });
    return map;
  }, [tasks]);

  const navigate = (dir: -1 | 1) => {
    if (scale === 'day') {
      setCursorDate(addDays(cursorDate, dir));
    } else if (scale === 'week') {
      setCursorDate(addDays(cursorDate, dir * 7));
    } else {
      const next = new Date(cursorObj.getFullYear(), cursorObj.getMonth() + dir, 1);
      setCursorDate(toLocalDateStr(next));
    }
  };

  const headerTitle = useMemo(() => {
    if (scale === 'day') {
      return cursorObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (scale === 'week') {
      const week = getWeekDays(cursorDate);
      const start = parseLocalDate(week[0]);
      const end = parseLocalDate(week[6]);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' }
      )}`;
    }
    return cursorObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [scale, cursorDate, cursorObj]);

  const monthCells = useMemo(
    () => getMonthMatrix(cursorObj.getFullYear(), cursorObj.getMonth()),
    [cursorObj]
  );
  const weekDays = useMemo(() => getWeekDays(cursorDate), [cursorDate]);

  const renderTaskChip = (task: Task) => {
    const catColor = catColorMap.get(task.categoryId) ?? '#5E6AD2';
    const overdue = isTaskOverdue(task);
    const done = task.status === 'completed';

    return (
      <button
        key={task.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openEditTaskModal(task);
        }}
        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors truncate border ${
          overdue
            ? 'border-red-300 dark:border-red-900/60 bg-red-50/90 dark:bg-red-950/30 text-red-700 dark:text-red-300'
            : 'border-zinc-200/80 dark:border-[#272A36] bg-white dark:bg-[#1C1E27] text-zinc-800 dark:text-zinc-200 hover:border-[var(--accent)]'
        }`}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: overdue ? '#DC2626' : catColor }}
        />
        <span className={`truncate ${done ? 'line-through opacity-50' : ''}`}>
          {task.dueTime ? `${task.dueTime} ` : ''}
          {task.title}
        </span>
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-[#232530] px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursorDate(today)}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h3 className="ml-2 font-display text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {headerTitle}
          </h3>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-[#1E2028] p-1">
          {(['month', 'week', 'day'] as CalendarScale[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                scale === s
                  ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* MONTH VIEW */}
      {scale === 'month' && (
        <div>
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-[#232530] bg-zinc-50/60 dark:bg-[#14151B]">
            {WEEKDAY_NAMES.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200/80 dark:divide-[#232530]">
            {monthCells.map((dateStr) => {
              const dt = parseLocalDate(dateStr);
              const inMonth = dt.getMonth() === cursorObj.getMonth();
              const isTodayCell = dateStr === today;
              const dayTasks = tasksByDate.get(dateStr) ?? [];
              const hasOverdue = dayTasks.some((t) => isTaskOverdue(t));

              return (
                <div
                  key={dateStr}
                  onClick={() => openCreateTaskModal({ date: dateStr })}
                  className={`group cursor-pointer p-1.5 sm:p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${
                    compact ? 'min-h-[82px]' : 'min-h-[108px]'
                  } ${!inMonth ? 'bg-zinc-50/50 dark:bg-[#121318]/60 opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs tabular-nums ${
                        isTodayCell
                          ? 'text-white font-semibold'
                          : hasOverdue
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                      style={isTodayCell ? { backgroundColor: 'var(--accent)' } : undefined}
                    >
                      {dt.getDate()}
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 text-zinc-400 transition-opacity">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, compact ? 2 : 3).map(renderTaskChip)}
                    {dayTasks.length > (compact ? 2 : 3) && (
                      <div className="px-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                        +{dayTasks.length - (compact ? 2 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {scale === 'week' && (
        <div className="overflow-x-auto">
          <div className="min-w-[720px] grid grid-cols-7 divide-x divide-zinc-200 dark:divide-[#232530]">
            {weekDays.map((dateStr) => {
              const dt = parseLocalDate(dateStr);
              const isTodayCol = dateStr === today;
              const dayTasks = [...(tasksByDate.get(dateStr) ?? [])].sort((a, b) =>
                (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99')
              );

              return (
                <div
                  key={dateStr}
                  onClick={() => openCreateTaskModal({ date: dateStr })}
                  className={`min-h-[340px] cursor-pointer p-3 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/20 ${
                    isTodayCol ? 'bg-[var(--accent-soft)]/30' : ''
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        {WEEKDAY_NAMES[dt.getDay()]}
                      </p>
                      <p
                        className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums ${
                          isTodayCol ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                        style={isTodayCol ? { backgroundColor: 'var(--accent)' } : undefined}
                      >
                        {dt.getDate()}
                      </p>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <div className="space-y-1.5">
                    {dayTasks.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-600">No tasks</p>
                    ) : (
                      dayTasks.map(renderTaskChip)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {scale === 'day' && (
        <div className="divide-y divide-zinc-200/80 dark:divide-[#232530]">
          {/* All-day / untimed tasks */}
          {(() => {
            const allDay = (tasksByDate.get(cursorDate) ?? []).filter((t) => !t.dueTime);
            return (
              <div className="flex items-start gap-4 px-4 py-3 bg-zinc-50/60 dark:bg-[#14151B]">
                <span className="w-16 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 pt-1">
                  All day
                </span>
                <div className="flex-1 flex flex-wrap gap-2">
                  {allDay.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => openCreateTaskModal({ date: cursorDate })}
                      className="text-xs text-zinc-400 hover:text-[var(--accent)]"
                    >
                      + Add untimed task for this date
                    </button>
                  ) : (
                    allDay.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openEditTaskModal(t)}
                        className="rounded-lg border border-zinc-200 dark:border-[#272A36] bg-white dark:bg-[#1B1D25] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-[var(--accent)]"
                      >
                        {t.title}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })()}

          {/* Hourly timeline */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-zinc-100 dark:divide-[#20222C]">
            {HOURS.map((hour) => {
              const hourPrefix = `${String(hour).padStart(2, '0')}:`;
              const slotTasks = (tasksByDate.get(cursorDate) ?? []).filter((t) =>
                t.dueTime.startsWith(hourPrefix)
              );

              return (
                <div
                  key={hour}
                  onClick={() => openCreateTaskModal({ date: cursorDate, time: `${hourPrefix}00` })}
                  className="group flex min-h-[52px] cursor-pointer items-stretch px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition-colors"
                >
                  <div className="w-16 shrink-0 py-2 font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                    {formatTime12h(`${hourPrefix}00`)}
                  </div>
                  <div className="flex-1 border-l border-zinc-200/70 dark:border-[#232530] pl-4 py-1.5 flex flex-wrap gap-2 items-center">
                    {slotTasks.map((t) => {
                      const overdue = isTaskOverdue(t);
                      const prio = PRIORITY_CONFIG[t.priority];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditTaskModal(t);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                            overdue
                              ? 'border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                              : 'border-zinc-200 dark:border-[#2A2D39] bg-white dark:bg-[#1B1D25] text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prio.dotColor }} />
                          <span className={t.status === 'completed' ? 'line-through opacity-50' : ''}>{t.title}</span>
                          <span className="font-mono text-[11px] text-zinc-400">{formatTime12h(t.dueTime)}</span>
                        </button>
                      );
                    })}
                    {slotTasks.length === 0 && (
                      <span className="opacity-0 group-hover:opacity-100 text-xs text-zinc-400 transition-opacity">
                        + Schedule at {formatTime12h(`${hourPrefix}00`)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
