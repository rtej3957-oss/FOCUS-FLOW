import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';
import {
  AiBreakdownResponse,
  AiPlanResponse,
  AiScheduleResponse,
  AiWeeklySummaryResponse,
  checkAiHealth,
  requestAiBreakdown,
  requestAiPlan,
  requestAiSchedule,
  requestAiWeeklySummary,
} from '../services/aiClient';
import { AiSuggestedTask, TaskPriority } from '../types';
import { PRIORITY_CONFIG } from '../utils/constants';
import { addDays, formatDisplayDate, formatTime12h, getTodayStr, toLocalDateStr } from '../utils/date';

const VALID_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

export const AiAssistantDrawer: React.FC = () => {
  const {
    state,
    aiDrawerOpen,
    setAiDrawerOpen,
    aiDrawerTab,
    setAiDrawerTab,
    aiBreakdownTaskId,
    setAiBreakdownTaskId,
    addManyTasks,
    updateTask,
  } = useFocusFlow();

  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusNote, setStatusNote] = useState('');

  // Tab 1: Plan from Natural Language
  const [planPrompt, setPlanPrompt] = useState('');
  const [planResult, setPlanResult] = useState<AiPlanResponse | null>(null);
  const [selectedPlanIndices, setSelectedPlanIndices] = useState<number[]>([]);

  // Tab 2: Task Breakdown
  const pendingTasks = state.tasks.filter((t) => t.status !== 'completed');
  const [breakdownTaskId, setBreakdownTaskId] = useState<string>(pendingTasks[0]?.id ?? '');
  const [breakdownResult, setBreakdownResult] = useState<AiBreakdownResponse | null>(null);

  // Tab 3: Smart Schedule & Overload
  const [scheduleResult, setScheduleResult] = useState<AiScheduleResponse | null>(null);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');

  // Tab 4: Weekly Summary
  const [summaryResult, setSummaryResult] = useState<AiWeeklySummaryResponse | null>(null);

  useEffect(() => {
    if (!aiDrawerOpen) return;
    setError('');
    setStatusNote('');
    checkAiHealth().then((res) => setAiAvailable(res.aiConfigured));
    if (aiBreakdownTaskId) {
      setBreakdownTaskId(aiBreakdownTaskId);
    } else if (!breakdownTaskId && pendingTasks[0]) {
      setBreakdownTaskId(pendingTasks[0].id);
    }
  }, [aiDrawerOpen, aiBreakdownTaskId]);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planPrompt.trim()) {
      setError('Describe your goal, exam, or project first.');
      return;
    }
    setLoading(true);
    setError('');
    setStatusNote('');
    try {
      const res = await requestAiPlan({
        prompt: planPrompt,
        todayDate: getTodayStr(),
        categories: state.categories.map((c) => c.name),
        projects: state.projects.map((p) => p.name),
      });
      setPlanResult(res);
      setSelectedPlanIndices((res.tasks ?? []).map((_, i) => i));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePlanTasks = () => {
    if (!planResult) return;
    const chosen: AiSuggestedTask[] = planResult.tasks.filter((_, idx) => selectedPlanIndices.includes(idx));
    if (chosen.length === 0) return;

    addManyTasks(
      chosen.map((item) => {
        const matchedCat =
          state.categories.find((c) => c.name.toLowerCase() === (item.category || '').toLowerCase()) ??
          state.categories[0];
        const prio = VALID_PRIORITIES.includes(item.priority) ? item.priority : 'medium';
        return {
          title: item.title,
          description: item.description ?? '',
          dueDate: item.dueDate || getTodayStr(),
          dueTime: item.dueTime || '',
          priority: prio,
          categoryId: matchedCat?.id ?? 'cat-personal',
          projectId: null,
          status: 'todo',
          subtasks: (item.subtasks ?? []).map((st, idx) => ({
            id: `st-ai-${Date.now()}-${idx}`,
            title: st,
            completed: false,
          })),
          tags: item.tags ?? [],
          estimatedMinutes: item.estimatedMinutes || 30,
          recurring: 'none',
          notes: 'Planned via Focus Flow AI',
        };
      })
    );
    setStatusNote(`Added ${chosen.length} reviewed ${chosen.length === 1 ? 'task' : 'tasks'} to your workspace.`);
    setPlanResult(null);
    setPlanPrompt('');
  };

  const handleBreakdown = async () => {
    const target = state.tasks.find((t) => t.id === breakdownTaskId);
    if (!target) {
      setError('Select a pending task to break down.');
      return;
    }
    setLoading(true);
    setError('');
    setStatusNote('');
    try {
      const res = await requestAiBreakdown(target);
      setBreakdownResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to break down task.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBreakdown = () => {
    if (!breakdownResult || !breakdownTaskId) return;
    const target = state.tasks.find((t) => t.id === breakdownTaskId);
    if (!target) return;
    const newSubtasks = breakdownResult.subtasks.map((title, idx) => ({
      id: `st-ai-${Date.now()}-${idx}`,
      title,
      completed: false,
    }));
    const prio = VALID_PRIORITIES.includes(breakdownResult.suggestedPriority as TaskPriority)
      ? (breakdownResult.suggestedPriority as TaskPriority)
      : target.priority;

    updateTask(target.id, {
      subtasks: [...target.subtasks, ...newSubtasks],
      priority: prio,
      estimatedMinutes: breakdownResult.estimatedMinutes || target.estimatedMinutes,
    });
    setStatusNote(`Updated "${target.title}" with ${newSubtasks.length} subtasks.`);
    setBreakdownResult(null);
    setAiBreakdownTaskId(null);
  };

  const handleGenerateSchedule = async () => {
    if (pendingTasks.length === 0) {
      setError('Add some pending tasks before generating a daily schedule.');
      return;
    }
    setLoading(true);
    setError('');
    setStatusNote('');
    try {
      const res = await requestAiSchedule({
        tasks: pendingTasks,
        todayDate: getTodayStr(),
        workHoursStart: workStart,
        workHoursEnd: workEnd,
      });
      setScheduleResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAdjustment = (adj: AiScheduleResponse['adjustments'][number]) => {
    const patch: Record<string, unknown> = {};
    if (adj.suggestedDueDate) patch.dueDate = adj.suggestedDueDate;
    if (adj.suggestedPriority && VALID_PRIORITIES.includes(adj.suggestedPriority as TaskPriority)) {
      patch.priority = adj.suggestedPriority;
    }
    updateTask(adj.taskId, patch);
    setStatusNote(`Applied suggestion to "${adj.title}".`);
  };

  const handleGenerateWeeklySummary = async () => {
    setLoading(true);
    setError('');
    setStatusNote('');
    const today = getTodayStr();
    const weekAgo = addDays(today, -6);

    const completedThisWeek = state.tasks.filter(
      (t) => t.status === 'completed' && t.completedAt && toLocalDateStr(new Date(t.completedAt)) >= weekAgo
    );
    const focusThisWeek = state.focusSessions.filter((s) => s.date >= weekAgo);
    const habitChecksThisWeek = state.habits.reduce(
      (sum, h) => sum + h.completedDates.filter((d) => d >= weekAgo).length,
      0
    );

    try {
      const res = await requestAiWeeklySummary({
        period: `${weekAgo} to ${today}`,
        tasksCompletedCount: completedThisWeek.length,
        pendingTasksCount: pendingTasks.length,
        focusMinutesTotal: focusThisWeek.reduce((s, f) => s + f.durationMinutes, 0),
        focusSessionsCount: focusThisWeek.length,
        habitCheckInsCount: habitChecksThisWeek,
        totalHabitsCount: state.habits.length,
      });
      setSummaryResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to summarize productivity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setAiDrawerOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Focus Flow AI Productivity Assistant"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#15161C] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#242632] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    AI Productivity Assistant
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Review every suggestion before applying to your workspace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close AI Assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Segmented Tab Controls */}
            <div className="border-b border-zinc-200 dark:border-[#242632] px-5 py-2.5">
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-zinc-100 dark:bg-[#1E2028] p-1">
                {[
                  { id: 'plan', label: 'Plan Goal', icon: Plus },
                  { id: 'breakdown', label: 'Breakdown', icon: ListChecks },
                  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
                  { id: 'summary', label: 'Weekly AI', icon: TrendingUp },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = aiDrawerTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setAiDrawerTab(tab.id as typeof aiDrawerTab);
                        setError('');
                        setStatusNote('');
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {aiAvailable === false && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Gemini AI is currently offline</p>
                    <p className="mt-0.5 leading-relaxed">
                      Server-side GEMINI_API_KEY is not configured yet. All core Focus Flow task, habit, calendar, and
                      timer features remain fully functional.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {statusNote && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{statusNote}</span>
                </div>
              )}

              {/* TAB 1: PLAN GOAL */}
              {aiDrawerTab === 'plan' && (
                <div className="space-y-4">
                  <form onSubmit={handleGeneratePlan} className="space-y-3">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Describe what you need to accomplish
                    </label>
                    <textarea
                      rows={3}
                      value={planPrompt}
                      onChange={(e) => setPlanPrompt(e.target.value)}
                      placeholder='e.g., "I have a DBMS exam on Friday and need to complete three chapters."'
                      className="w-full rounded-xl border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#111217] p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPlanPrompt('I have a DBMS exam on Friday and need to complete three chapters.')
                        }
                        className="text-xs text-zinc-500 hover:text-[var(--accent)] underline decoration-dotted"
                      >
                        Use DBMS exam example
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-60 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {loading ? 'Generating plan...' : 'Generate Plan'}
                      </button>
                    </div>
                  </form>

                  {planResult && (
                    <div className="space-y-3 border-t border-zinc-200 dark:border-[#242632] pt-4">
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{planResult.summary}</p>
                      <div className="space-y-2.5">
                        {planResult.tasks.map((task, idx) => {
                          const checked = selectedPlanIndices.includes(idx);
                          const prio = VALID_PRIORITIES.includes(task.priority) ? task.priority : 'medium';
                          return (
                            <div
                              key={idx}
                              className={`rounded-xl border p-3.5 transition-colors ${
                                checked
                                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                  : 'border-zinc-200 dark:border-[#252834] bg-white dark:bg-[#191B23]'
                              }`}
                            >
                              <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedPlanIndices((prev) =>
                                      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                                    )
                                  }
                                  className="mt-1 h-4 w-4 rounded accent-[var(--accent)]"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</p>
                                  {task.description && (
                                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                                      {task.description}
                                    </p>
                                  )}
                                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                    <span className={PRIORITY_CONFIG[prio].textColor}>
                                      {PRIORITY_CONFIG[prio].label}
                                    </span>
                                    <span>·</span>
                                    <span>{formatDisplayDate(task.dueDate)}</span>
                                    {task.dueTime && (
                                      <>
                                        <span>·</span>
                                        <span>{formatTime12h(task.dueTime)}</span>
                                      </>
                                    )}
                                    <span>·</span>
                                    <span>{task.category}</span>
                                    <span>·</span>
                                    <span className="font-mono">{task.estimatedMinutes}m</span>
                                  </div>
                                  {task.subtasks?.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400 list-disc pl-4">
                                      {task.subtasks.map((s, sIdx) => (
                                        <li key={sIdx}>{s}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setPlanResult(null)}
                          className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={handleApprovePlanTasks}
                          disabled={selectedPlanIndices.length === 0}
                          className="rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          Approve &amp; Add {selectedPlanIndices.length} Tasks
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TASK BREAKDOWN */}
              {aiDrawerTab === 'breakdown' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Select a pending task to break into steps
                    </label>
                    <select
                      value={breakdownTaskId}
                      onChange={(e) => {
                        setBreakdownTaskId(e.target.value);
                        setBreakdownResult(null);
                      }}
                      className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#111217] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                    >
                      {pendingTasks.length === 0 && <option value="">No pending tasks available</option>}
                      {pendingTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={loading || pendingTasks.length === 0}
                      onClick={handleBreakdown}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
                      {loading ? 'Analyzing task...' : 'Generate Subtasks & Priority'}
                    </button>
                  </div>

                  {breakdownResult && (
                    <div className="rounded-xl border border-zinc-200 dark:border-[#252834] p-4 space-y-3 bg-zinc-50/70 dark:bg-[#191B23]">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {breakdownResult.rationale}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          Suggested priority:{' '}
                          <strong className="text-zinc-900 dark:text-zinc-100 capitalize">
                            {breakdownResult.suggestedPriority}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Est. duration:{' '}
                          <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                            {breakdownResult.estimatedMinutes}m
                          </strong>
                        </span>
                      </div>
                      <ul className="space-y-1.5 text-sm text-zinc-800 dark:text-zinc-200">
                        {breakdownResult.subtasks.map((st, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                            <span>{st}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setBreakdownResult(null)}
                          className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyBreakdown}
                          className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-white"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          Apply to Task
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DAILY SCHEDULE & OVERLOAD DETECTION */}
              {aiDrawerTab === 'schedule' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Focus Window Start
                      </label>
                      <input
                        type="time"
                        value={workStart}
                        onChange={(e) => setWorkStart(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#111217] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Focus Window End
                      </label>
                      <input
                        type="time"
                        value={workEnd}
                        onChange={(e) => setWorkEnd(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#111217] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleGenerateSchedule}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CalendarClock className="h-3.5 w-3.5" />
                      )}
                      {loading ? 'Optimizing schedule...' : 'Generate Daily Schedule & Check Load'}
                    </button>
                  </div>

                  {scheduleResult && (
                    <div className="space-y-4 border-t border-zinc-200 dark:border-[#242632] pt-4">
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {scheduleResult.overview}
                      </p>

                      {scheduleResult.scheduleBlocks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Suggested Time Blocks Today
                          </h4>
                          {scheduleResult.scheduleBlocks.map((b, i) => (
                            <div
                              key={i}
                              className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 dark:border-[#252834] px-3.5 py-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">{b.title}</p>
                                {b.note && <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">{b.note}</p>}
                              </div>
                              <span className="font-mono tabular-nums text-[var(--accent)] shrink-0">
                                {b.startTime} – {b.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {scheduleResult.overloadedDays.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Overloaded Days Detected
                          </h4>
                          {scheduleResult.overloadedDays.map((day, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-xs"
                            >
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatDisplayDate(day.date)} · {day.taskCount} tasks · {day.totalMinutes}m
                              </p>
                              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{day.advice}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {scheduleResult.adjustments.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Suggested Deadline &amp; Priority Adjustments
                          </h4>
                          {scheduleResult.adjustments.map((adj, i) => (
                            <div
                              key={i}
                              className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 dark:border-[#252834] p-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">{adj.title}</p>
                                <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">{adj.reason}</p>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--accent)]">
                                  {adj.suggestedDueDate && <span>Move to {formatDisplayDate(adj.suggestedDueDate)}</span>}
                                  {adj.suggestedPriority && <span className="capitalize">Priority: {adj.suggestedPriority}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplyAdjustment(adj)}
                                className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: WEEKLY SUMMARY */}
              {aiDrawerTab === 'summary' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Generate an AI review strictly grounded in your actual completed tasks, focus sessions, and habit logs
                    over the last 7 days.
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGenerateWeeklySummary}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {loading ? 'Reviewing your week...' : 'Summarize My Weekly Productivity'}
                  </button>

                  {summaryResult && (
                    <div className="rounded-xl border border-zinc-200 dark:border-[#252834] p-4 space-y-3 bg-zinc-50/60 dark:bg-[#191B23]">
                      <h4 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {summaryResult.headline}
                      </h4>
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{summaryResult.summary}</p>
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Highlights</p>
                        <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400 list-disc pl-4">
                          {summaryResult.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                          Recommendations for Next Week
                        </p>
                        <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400 list-disc pl-4">
                          {summaryResult.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
