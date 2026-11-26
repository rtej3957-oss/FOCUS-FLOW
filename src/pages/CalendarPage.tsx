import React, { useMemo } from 'react';
import { AlertCircle, CalendarClock, Plus } from 'lucide-react';
import { CalendarWidget } from '../components/CalendarWidget';
import { useFocusFlow } from '../context/FocusFlowContext';
import { formatDisplayDate, formatTime12h, getTodayStr, isTaskOverdue } from '../utils/date';

export const CalendarPage: React.FC = () => {
  const { state, openCreateTaskModal, openEditTaskModal } = useFocusFlow();
  const today = getTodayStr();

  const overdueList = useMemo(
    () =>
      state.tasks
        .filter((t) => isTaskOverdue(t))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.tasks]
  );

  const upcomingList = useMemo(
    () =>
      state.tasks
        .filter((t) => t.status !== 'completed' && t.dueDate >= today)
        .sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`))
        .slice(0, 8),
    [state.tasks, today]
  );

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">Calendar</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Click any date or time slot to schedule a task, or click an existing task to edit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateTaskModal()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap self-start sm:self-auto"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Schedule Task
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-9">
          <CalendarWidget tasks={state.tasks} />
        </div>

        <aside className="xl:col-span-3 space-y-5">
          {overdueList.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#17181E] p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Overdue ({overdueList.length})
                </h3>
              </div>
              <div className="space-y-2">
                {overdueList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openEditTaskModal(t)}
                    className="w-full rounded-lg border border-zinc-200/80 dark:border-[#262832] p-2.5 text-left hover:border-red-400 transition-colors"
                  >
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{t.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-red-600 dark:text-red-400">
                      Was due {formatDisplayDate(t.dueDate)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Upcoming Deadlines</h3>
            </div>
            {upcomingList.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No upcoming scheduled deadlines.</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-[#232530]">
                {upcomingList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openEditTaskModal(t)}
                    className="w-full py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 rounded px-1 transition-colors"
                  >
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{t.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {formatDisplayDate(t.dueDate)}
                      {t.dueTime ? ` · ${formatTime12h(t.dueTime)}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
