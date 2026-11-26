import React, { useMemo } from 'react';
import { ArrowRight, Check, Flame, Plus, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CategoryIcon } from '../components/CategoryIcon';
import { TaskItem } from '../components/TaskItem';
import { useFocusFlow } from '../context/FocusFlowContext';
import {
  addDays,
  calculateTaskCompletionStreak,
  formatDisplayDate,
  formatTime12h,
  getDailyQuote,
  getGreeting,
  getTodayStr,
  isHabitScheduledForDate,
  isTaskOverdue,
  parseLocalDate,
  toLocalDateStr,
} from '../utils/date';

export const DashboardPage: React.FC = () => {
  const {
    state,
    setActivePage,
    openCreateTaskModal,
    openEditTaskModal,
    toggleHabitDate,
    setAiDrawerTab,
    setAiDrawerOpen,
  } = useFocusFlow();

  const today = getTodayStr();
  const quote = useMemo(() => getDailyQuote(), []);
  const greeting = getGreeting(state.preferences.displayName);

  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const totalTasks = state.tasks.length;
  const completedTasks = state.tasks.filter((t) => t.status === 'completed').length;
  const pendingTasks = totalTasks - completedTasks;
  const overdueTasks = state.tasks.filter((t) => isTaskOverdue(t)).length;
  const streak = useMemo(() => calculateTaskCompletionStreak(state.tasks), [state.tasks]);

  // Today's tasks: due today OR completed today OR overdue
  const todaysTasks = useMemo(() => {
    return state.tasks
      .filter((t) => {
        if (t.dueDate === today) return true;
        if (isTaskOverdue(t)) return true;
        if (t.completedAt && toLocalDateStr(new Date(t.completedAt)) === today) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return a.order - b.order;
      });
  }, [state.tasks, today]);

  const todaysTotalCount = todaysTasks.length;
  const todaysCompletedCount = todaysTasks.filter((t) => t.status === 'completed').length;
  const dailyCompletionPct =
    todaysTotalCount > 0 ? Math.round((todaysCompletedCount / todaysTotalCount) * 100) : 0;

  // Upcoming deadlines (next 7 days, excluding completed)
  const upcomingDeadlines = useMemo(() => {
    const end = addDays(today, 7);
    return state.tasks
      .filter((t) => t.status !== 'completed' && t.dueDate >= today && t.dueDate <= end)
      .sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`))
      .slice(0, 6);
  }, [state.tasks, today]);

  // Real 7-day weekly productivity data
  const weeklyChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(today, i - 6);
      const dt = parseLocalDate(dateStr);
      const label = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const completed = state.tasks.filter(
        (t) => t.status === 'completed' && t.completedAt && toLocalDateStr(new Date(t.completedAt)) === dateStr
      ).length;
      const focusMins = state.focusSessions
        .filter((s) => s.date === dateStr)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        day: label,
        date: dateStr,
        completed,
        focusMins,
      };
    });
  }, [state.tasks, state.focusSessions, today]);

  // Circular SVG ring geometry
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (dailyCompletionPct / 100) * ringCircumference;

  const todaysHabits = useMemo(
    () => state.habits.filter((h) => isHabitScheduledForDate(h, today)),
    [state.habits, today]
  );

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      {/* Greeting Header + Circular Daily Progress Indicator */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{formattedToday}</p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-balance">
              {greeting}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              &ldquo;{quote.text}&rdquo;{' '}
              <span className="text-zinc-400 dark:text-zinc-500">— {quote.author}</span>
            </p>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-label="Daily completion progress">
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-zinc-100 dark:text-[#232530]"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {dailyCompletionPct}%
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Today</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 tabular-nums">
                {todaysCompletedCount} of {todaysTotalCount} today&apos;s tasks done
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreateTaskModal()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiDrawerTab('schedule');
                    setAiDrawerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] transition-colors whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Plan Day
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          { label: 'Total Tasks', value: totalTasks, sub: 'All workspace items', colorClass: 'text-zinc-900 dark:text-zinc-100' },
          { label: 'Pending', value: pendingTasks, sub: 'Remaining to finish', colorClass: 'text-zinc-900 dark:text-zinc-100' },
          { label: 'Completed', value: completedTasks, sub: 'Finished tasks', colorClass: 'text-emerald-600 dark:text-emerald-400' },
          {
            label: 'Overdue',
            value: overdueTasks,
            sub: overdueTasks > 0 ? 'Needs attention' : 'All on schedule',
            colorClass: overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100',
          },
          {
            label: 'Productivity Streak',
            value: `${streak}d`,
            sub: streak > 0 ? 'Consecutive active days' : 'Complete a task today',
            colorClass: 'text-[var(--accent)]',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] px-4 py-4"
          >
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            <p className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${stat.colorClass}`}>{stat.value}</p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{stat.sub}</p>
          </div>
        ))}
      </section>

      {/* Main Workspace Grid: Today's Tasks + Weekly Chart / Deadlines / Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Today's Tasks */}
        <section className="lg:col-span-7 rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Today&apos;s Tasks
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Focused list of tasks due today and overdue items
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('today')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todaysTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-[#282B38] py-12 px-4 text-center">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nothing scheduled for today</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Create a task or ask AI to build your study or work plan.
              </p>
              <button
                type="button"
                onClick={() => openCreateTaskModal({ date: today })}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Task
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todaysTasks.slice(0, 7).map((task) => (
                <TaskItem key={task.id} task={task} compact />
              ))}
              {todaysTasks.length > 7 && (
                <button
                  type="button"
                  onClick={() => setActivePage('today')}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#262832] py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  Show {todaysTasks.length - 7} more tasks
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right 5 cols: Weekly Chart + Upcoming Deadlines + Daily Habits */}
        <div className="lg:col-span-5 space-y-6">
          {/* Weekly Productivity Chart */}
          <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Weekly Productivity
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Tasks completed over the last 7 days</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('analytics')}
                className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
              >
                Full analytics
              </button>
            </div>

            <div className="h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18191F',
                      borderColor: '#2A2D39',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#F4F4F5',
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      name === 'completed' ? `${value} tasks` : `${value} min`,
                      name === 'completed' ? 'Completed' : 'Focus time',
                    ]}
                  />
                  <Bar dataKey="completed" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Daily Habits Check-in */}
          <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Daily Habits
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('habits')}
                className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
              >
                Habit tracker
              </button>
            </div>

            {todaysHabits.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No habits scheduled today. Add one in Habit Tracker.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {todaysHabits.map((habit) => {
                  const done = habit.completedDates.includes(today);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => toggleHabitDate(habit.id, today)}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                        done
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-900 dark:text-zinc-100'
                          : 'border-zinc-200 dark:border-[#262832] hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <CategoryIcon name={habit.icon} className="h-3.5 w-3.5 shrink-0" style={{ color: habit.color }} />
                        <span className="truncate">{habit.name}</span>
                      </span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          done
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {done && <Check className="h-3 w-3 stroke-[2.5]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming Deadlines */}
          <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Upcoming Deadlines
              </h3>
              <button
                type="button"
                onClick={() => setActivePage('upcoming')}
                className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
              >
                View upcoming
              </button>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No upcoming deadlines in the next 7 days.</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-[#232530]">
                {upcomingDeadlines.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openEditTaskModal(t)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 rounded-md px-1 transition-colors"
                  >
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{t.title}</span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                      {formatDisplayDate(t.dueDate)}
                      {t.dueTime ? ` · ${formatTime12h(t.dueTime)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
