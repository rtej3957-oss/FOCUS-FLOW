import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFocusFlow } from '../context/FocusFlowContext';
import {
  addDays,
  calculateTaskCompletionStreak,
  getTodayStr,
  isHabitScheduledForDate,
  isTaskOverdue,
  parseLocalDate,
  toLocalDateStr,
} from '../utils/date';

export const AnalyticsPage: React.FC = () => {
  const { state, setAiDrawerTab, setAiDrawerOpen } = useFocusFlow();
  const today = getTodayStr();

  const metrics = useMemo(() => {
    const total = state.tasks.length;
    const completed = state.tasks.filter((t) => t.status === 'completed').length;
    const pending = total - completed;
    const overdue = state.tasks.filter((t) => isTaskOverdue(t)).length;
    const overdueRate = pending > 0 ? Math.round((overdue / pending) * 100) : 0;

    // Daily completion rate (tasks due today or completed today)
    const todayTasks = state.tasks.filter(
      (t) => t.dueDate === today || (t.completedAt && toLocalDateStr(new Date(t.completedAt)) === today)
    );
    const todayDone = todayTasks.filter((t) => t.status === 'completed').length;
    const dailyRate = todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0;

    // Total focus hours
    const totalFocusMins = state.focusSessions.reduce((s, f) => s + f.durationMinutes, 0);
    const totalFocusHours = (totalFocusMins / 60).toFixed(1);

    // 7-day habit consistency
    let sched = 0;
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i);
      state.habits.forEach((h) => {
        if (isHabitScheduledForDate(h, d)) {
          sched++;
          if (h.completedDates.includes(d)) done++;
        }
      });
    }
    const habitConsistency = sched > 0 ? Math.round((done / sched) * 100) : 0;

    // Streak
    const streak = calculateTaskCompletionStreak(state.tasks);

    // Most productive day of week from real completed tasks
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    state.tasks.forEach((t) => {
      if (t.status === 'completed' && t.completedAt) {
        dayCounts[new Date(t.completedAt).getDay()]++;
      }
    });
    const maxCount = Math.max(...dayCounts);
    const mostProductiveDay = maxCount > 0 ? dayNames[dayCounts.indexOf(maxCount)] : 'No data yet';

    return {
      total,
      completed,
      pending,
      overdue,
      overdueRate,
      dailyRate,
      totalFocusHours,
      totalFocusMins,
      habitConsistency,
      streak,
      mostProductiveDay,
    };
  }, [state.tasks, state.focusSessions, state.habits, today]);

  // Weekly 7-day data
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      const label = parseLocalDate(d).toLocaleDateString('en-US', { weekday: 'short' });
      const tasksCompleted = state.tasks.filter(
        (t) => t.status === 'completed' && t.completedAt && toLocalDateStr(new Date(t.completedAt)) === d
      ).length;
      const focusMinutes = state.focusSessions
        .filter((s) => s.date === d)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return { day: label, tasksCompleted, focusMinutes };
    });
  }, [state.tasks, state.focusSessions, today]);

  // Monthly 30-day trend
  const monthlyData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(today, i - 29);
      const dt = parseLocalDate(d);
      const label = `${dt.getMonth() + 1}/${dt.getDate()}`;
      const tasksCompleted = state.tasks.filter(
        (t) => t.status === 'completed' && t.completedAt && toLocalDateStr(new Date(t.completedAt)) === d
      ).length;
      const habitsCompleted = state.habits.filter((h) => h.completedDates.includes(d)).length;
      return { date: label, tasksCompleted, habitsCompleted };
    });
  }, [state.tasks, state.habits, today]);

  // Completed vs Pending Donut
  const completionDonut = useMemo(
    () => [
      { name: 'Completed', value: metrics.completed, color: '#16A34A' },
      { name: 'Pending', value: Math.max(0, metrics.pending - metrics.overdue), color: '#5E6AD2' },
      { name: 'Overdue', value: metrics.overdue, color: '#DC2626' },
    ].filter((item) => item.value > 0),
    [metrics]
  );

  // Category distribution
  const categoryData = useMemo(() => {
    return state.categories
      .map((cat) => {
        const count = state.tasks.filter((t) => t.categoryId === cat.id).length;
        const done = state.tasks.filter((t) => t.categoryId === cat.id && t.status === 'completed').length;
        return {
          name: cat.name,
          total: count,
          completed: done,
          color: cat.color,
        };
      })
      .filter((c) => c.total > 0);
  }, [state.categories, state.tasks]);

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Productivity Analytics
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            All metrics and charts are calculated live from your recorded tasks, focus sessions, and habits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAiDrawerTab('summary');
            setAiDrawerOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-white dark:bg-[#17181E] px-3.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-[var(--accent)] transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
          AI Weekly Review
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { label: 'Daily Completion', value: `${metrics.dailyRate}%`, sub: 'Today target rate' },
          { label: 'Total Focus Hours', value: `${metrics.totalFocusHours}h`, sub: `${metrics.totalFocusMins}m logged` },
          { label: 'Habit Consistency', value: `${metrics.habitConsistency}%`, sub: 'Last 7 days' },
          { label: 'Productivity Streak', value: `${metrics.streak}d`, sub: 'Active day run' },
          { label: 'Most Productive Day', value: metrics.mostProductiveDay, sub: 'By completed tasks' },
          {
            label: 'Overdue Rate',
            value: `${metrics.overdueRate}%`,
            sub: `${metrics.overdue} overdue of ${metrics.pending} pending`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4"
          >
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{kpi.label}</p>
            <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 truncate">
              {kpi.value}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Weekly Bar + Completed/Pending Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Weekly Productivity &amp; Focus Minutes
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Completed tasks vs focus session minutes over the past 7 days
            </p>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18191F',
                    borderColor: '#2A2D39',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F4F4F5',
                  }}
                />
                <Bar dataKey="tasksCompleted" name="Tasks Completed" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="focusMinutes" name="Focus Minutes" fill="#0D9488" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5 flex flex-col">
          <div className="mb-2">
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Completed vs Pending
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Workspace task status breakdown</p>
          </div>

          {completionDonut.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
              Add tasks to view distribution.
            </div>
          ) : (
            <>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionDonut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {completionDonut.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18191F',
                        borderColor: '#2A2D39',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#F4F4F5',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
                {completionDonut.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-zinc-600 dark:text-zinc-300">{d.name}</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Charts Row 2: Monthly 30-Day Line Chart + Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Monthly Productivity (30 Days)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Daily completed tasks and habit check-ins across the last month
            </p>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis
                  dataKey="date"
                  interval={4}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18191F',
                    borderColor: '#2A2D39',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F4F4F5',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="tasksCompleted"
                  name="Tasks Completed"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="habitsCompleted"
                  name="Habits Logged"
                  stroke="#16A34A"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Category Distribution
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Task volume and completion by category</p>
          </div>

          {categoryData.length === 0 ? (
            <p className="py-12 text-center text-xs text-zinc-500">No tasks categorized yet.</p>
          ) : (
            <div className="space-y-3.5">
              {categoryData.map((cat) => {
                const pct = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{cat.name}</span>
                      <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {cat.completed}/{cat.total} done ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-[#232530] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${Math.max(6, Math.round((cat.total / Math.max(1, metrics.total)) * 100))}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
