import React, { useMemo, useState } from 'react';
import { Check, Edit3, Flame, Plus, Trash2, X } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { useFocusFlow } from '../context/FocusFlowContext';
import { Habit } from '../types';
import { CATEGORY_ICON_OPTIONS, COLOR_PALETTE } from '../utils/constants';
import {
  addDays,
  calculateHabitStreaks,
  getTodayStr,
  isHabitScheduledForDate,
  parseLocalDate,
} from '../utils/date';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HabitsPage: React.FC = () => {
  const { state, addHabit, updateHabit, deleteHabit, toggleHabitDate, requestConfirm } = useFocusFlow();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>('Flame');
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekdays' | 'custom'>('daily');
  const [targetDays, setTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState('');

  const today = getTodayStr();
  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);

  // Build 18-week (126 days) GitHub-style heatmap aligned to Sunday
  const heatmapWeeks = useMemo(() => {
    const todayDate = parseLocalDate(today);
    const totalWeeks = 18;
    const endOffset = 6 - todayDate.getDay();
    const gridEnd = addDays(today, endOffset);
    const gridStart = addDays(gridEnd, -(totalWeeks * 7 - 1));

    const weeks: string[][] = [];
    for (let w = 0; w < totalWeeks; w++) {
      const col: string[] = [];
      for (let d = 0; d < 7; d++) {
        col.push(addDays(gridStart, w * 7 + d));
      }
      weeks.push(col);
    }
    return weeks;
  }, [today]);

  const habitConsistency = useMemo(() => {
    const totalHabits = state.habits.length;
    if (totalHabits === 0) return { dailyPct: 0, weeklyPct: 0, bestCurrent: 0, bestLongest: 0 };

    const scheduledToday = state.habits.filter((h) => isHabitScheduledForDate(h, today));
    const completedToday = scheduledToday.filter((h) => h.completedDates.includes(today)).length;
    const dailyPct = scheduledToday.length > 0 ? Math.round((completedToday / scheduledToday.length) * 100) : 0;

    let scheduledWeek = 0;
    let completedWeek = 0;
    last7Days.forEach((d) => {
      state.habits.forEach((h) => {
        if (isHabitScheduledForDate(h, d)) {
          scheduledWeek++;
          if (h.completedDates.includes(d)) completedWeek++;
        }
      });
    });
    const weeklyPct = scheduledWeek > 0 ? Math.round((completedWeek / scheduledWeek) * 100) : 0;

    let bestCurrent = 0;
    let bestLongest = 0;
    state.habits.forEach((h) => {
      const s = calculateHabitStreaks(h);
      if (s.current > bestCurrent) bestCurrent = s.current;
      if (s.longest > bestLongest) bestLongest = s.longest;
    });

    return { dailyPct, weeklyPct, bestCurrent, bestLongest };
  }, [state.habits, today, last7Days]);

  const openCreateModal = () => {
    setEditingHabit(null);
    setName('');
    setDescription('');
    setColor(COLOR_PALETTE[3]);
    setIcon('Dumbbell');
    setScheduleType('daily');
    setTargetDays([0, 1, 2, 3, 4, 5, 6]);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (h: Habit) => {
    setEditingHabit(h);
    setName(h.name);
    setDescription(h.description);
    setColor(h.color);
    setIcon(h.icon);
    setScheduleType(h.scheduleType);
    setTargetDays(h.targetDays);
    setError('');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Habit name is required.');
      return;
    }
    const days =
      scheduleType === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6]
        : scheduleType === 'weekdays'
        ? [1, 2, 3, 4, 5]
        : targetDays.length > 0
        ? targetDays
        : [1, 3, 5];

    if (editingHabit) {
      updateHabit(editingHabit.id, {
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        scheduleType,
        targetDays: days,
      });
    } else {
      addHabit({
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        scheduleType,
        targetDays: days,
      });
    }
    setModalOpen(false);
  };

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">Habit Tracker</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Build daily routines, monitor consistency streaks, and review your activity heatmap.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap self-start sm:self-auto"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Habit
        </button>
      </div>

      {/* Consistency KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Today&apos;s Consistency</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {habitConsistency.dailyPct}%
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">7-Day Consistency</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[var(--accent)]">
            {habitConsistency.weeklyPct}%
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Best Active Streak</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {habitConsistency.bestCurrent}d
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">All-Time Longest Streak</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {habitConsistency.bestLongest}d
          </p>
        </div>
      </div>

      {/* GitHub-Style Consistency Heatmap */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Consistency Heatmap
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Combined daily habit check-ins over the past 18 weeks
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Less</span>
            <span className="h-3 w-3 rounded-[3px] bg-zinc-100 dark:bg-[#232530]" />
            <span className="h-3 w-3 rounded-[3px] opacity-35" style={{ backgroundColor: 'var(--accent)' }} />
            <span className="h-3 w-3 rounded-[3px] opacity-65" style={{ backgroundColor: 'var(--accent)' }} />
            <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: 'var(--accent)' }} />
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-1.5">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((dateStr) => {
                  const isFuture = dateStr > today;
                  const totalScheduled = state.habits.filter((h) => isHabitScheduledForDate(h, dateStr)).length;
                  const completedCount = state.habits.filter((h) => h.completedDates.includes(dateStr)).length;
                  const ratio = totalScheduled > 0 ? completedCount / totalScheduled : 0;

                  let bgStyle: React.CSSProperties = {};
                  let bgClass = 'bg-zinc-100 dark:bg-[#22242F]';
                  if (!isFuture && completedCount > 0) {
                    bgClass = '';
                    const alpha = ratio >= 0.8 ? 1 : ratio >= 0.5 ? 0.68 : 0.35;
                    bgStyle = { backgroundColor: 'var(--accent)', opacity: alpha };
                  }

                  return (
                    <div
                      key={dateStr}
                      title={`${dateStr}: ${completedCount} habits completed`}
                      className={`h-3.5 w-3.5 rounded-[3px] ${isFuture ? 'opacity-20' : ''} ${bgClass}`}
                      style={bgStyle}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Habits Interactive Matrix (7-Day Check-off + Streaks) */}
      {state.habits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-[#282B38] bg-white dark:bg-[#17181E] py-14 px-4 text-center">
          <Flame className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No habits tracked yet</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Create your first daily habit like Exercise, Reading, or Studying.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Habit
          </button>
        </div>
      ) : (
        <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#232530] bg-zinc-50/60 dark:bg-[#14151B] text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <th className="py-3 px-4">Habit</th>
                  {last7Days.map((d) => {
                    const dt = parseLocalDate(d);
                    const isTodayCol = d === today;
                    return (
                      <th key={d} className="py-3 px-2 text-center">
                        <div className={isTodayCol ? 'text-[var(--accent)] font-semibold' : ''}>
                          {DAY_NAMES[dt.getDay()]}
                        </div>
                        <div className="font-mono text-[10px] tabular-nums">{dt.getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-3 text-right">Current</th>
                  <th className="py-3 px-3 text-right">Longest</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#232530]">
                {state.habits.map((habit) => {
                  const streaks = calculateHabitStreaks(habit);
                  return (
                    <tr key={habit.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/25">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${habit.color}18` }}
                          >
                            <CategoryIcon name={habit.icon} className="h-4 w-4" style={{ color: habit.color }} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {habit.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]">
                              {habit.description || habit.scheduleType}
                            </p>
                          </div>
                        </div>
                      </td>

                      {last7Days.map((d) => {
                        const checked = habit.completedDates.includes(d);
                        const scheduled = isHabitScheduledForDate(habit, d);
                        return (
                          <td key={d} className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleHabitDate(habit.id, d)}
                              aria-label={`Toggle ${habit.name} for ${d}`}
                              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                                checked
                                  ? 'text-white border-transparent'
                                  : scheduled
                                  ? 'border-zinc-200 dark:border-zinc-700 hover:border-[var(--accent)]'
                                  : 'border-dashed border-zinc-200/70 dark:border-zinc-800 opacity-50'
                              }`}
                              style={checked ? { backgroundColor: habit.color } : undefined}
                            >
                              {checked && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                            </button>
                          </td>
                        );
                      })}

                      <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {streaks.current}d
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {streaks.longest}d
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(habit)}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            aria-label="Edit habit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestConfirm({
                                title: 'Delete habit?',
                                message: `Remove "${habit.name}" and its streak history?`,
                                confirmLabel: 'Delete',
                                destructive: true,
                                onConfirm: () => deleteHabit(habit.id),
                              })
                            }
                            className="rounded p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-500"
                            aria-label="Delete habit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Create / Edit Habit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setModalOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#17181E] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {editingHabit ? 'Edit Habit' : 'Create Habit'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Habit Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g., Read 20 pages"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Description / Target
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., 30 minutes before dinner"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Schedule
                </label>
                <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-zinc-100 dark:bg-[#1E2028] p-1">
                  {(['daily', 'weekdays', 'custom'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScheduleType(s)}
                      className={`rounded-md py-1.5 text-xs font-medium capitalize ${
                        scheduleType === s
                          ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {scheduleType === 'custom' && (
                  <div className="mt-2.5 flex justify-between gap-1">
                    {DAY_NAMES.map((label, idx) => {
                      const active = targetDays.includes(idx);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            setTargetDays((prev) =>
                              prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                            )
                          }
                          className={`flex-1 rounded-md py-1.5 text-xs font-medium border ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                              : 'border-zinc-200 dark:border-[#2A2D39] text-zinc-500'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        icon === ic
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-zinc-200 dark:border-[#2A2D39] text-zinc-500'
                      }`}
                    >
                      <CategoryIcon name={ic} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full ${
                        color === c ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-[#17181E] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {editingHabit ? 'Save Habit' : 'Create Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
