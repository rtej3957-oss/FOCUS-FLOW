import React, { useMemo, useState } from 'react';
import { CornerDownLeft, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { PRIORITY_CONFIG } from '../utils/constants';
import { formatDisplayDate, formatTime12h } from '../utils/date';
import { parseNaturalLanguageTask } from '../utils/nlp';

export const QuickAddModal: React.FC = () => {
  const {
    state,
    quickAddOpen,
    setQuickAddOpen,
    addTask,
    openCreateTaskModal,
    setAiDrawerTab,
    setAiDrawerOpen,
  } = useFocusFlow();

  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const parsed = useMemo(
    () => parseNaturalLanguageTask(input, state.categories),
    [input, state.categories]
  );

  const resolvedPriority = parsed.priority ?? state.preferences.defaultPriority;
  const resolvedCategory =
    state.categories.find((c) => c.id === parsed.categoryId) ?? state.categories[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError('Enter a task title or natural-language instruction.');
      return;
    }

    addTask({
      title: parsed.title,
      description: '',
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: resolvedPriority,
      categoryId: resolvedCategory?.id ?? 'cat-personal',
      projectId: null,
      status: 'todo',
      subtasks: [],
      tags: parsed.tags,
      estimatedMinutes: parsed.estimatedMinutes ?? 30,
      recurring: parsed.recurring,
      notes: '',
    });

    setInput('');
    setError('');
    setQuickAddOpen(false);
  };

  return (
    <AnimatePresence>
      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={() => setQuickAddOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Quick Add Task"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl rounded-xl border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#17181E] shadow-2xl overflow-hidden"
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#242632] px-4 py-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Quick Add Task · Natural Language Enabled
                </span>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(false)}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label="Close quick add"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4">
                <input
                  type="text"
                  autoFocus
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder='Try "Complete assignment tomorrow at 5 PM, high priority"'
                  className="w-full bg-transparent text-base font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                />

                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

                {/* Live Parsed Metadata Preview (clean unboxed inline text) */}
                {input.trim() && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-100 dark:border-[#242632] pt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]">
                      {parsed.title}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDisplayDate(parsed.dueDate)}</span>
                    {parsed.dueTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatTime12h(parsed.dueTime)}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className={PRIORITY_CONFIG[resolvedPriority].textColor}>
                      {PRIORITY_CONFIG[resolvedPriority].label}
                    </span>
                    {resolvedCategory && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{resolvedCategory.name}</span>
                      </>
                    )}
                    {parsed.recurring !== 'none' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">Repeats {parsed.recurring}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  <span>Examples:</span>
                  <button
                    type="button"
                    onClick={() => setInput('Submit project on Friday, high priority #Work')}
                    className="hover:text-zinc-700 dark:hover:text-zinc-300 underline decoration-dotted"
                  >
                    Submit project on Friday, high priority
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setInput('Go to the gym every Monday at 7 AM 45m')}
                    className="hover:text-zinc-700 dark:hover:text-zinc-300 underline decoration-dotted"
                  >
                    Go to the gym every Monday
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-zinc-200 dark:border-[#242632] bg-zinc-50/70 dark:bg-[#131419] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddOpen(false);
                      openCreateTaskModal();
                    }}
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 whitespace-nowrap"
                  >
                    Full editor
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddOpen(false);
                      setAiDrawerTab('plan');
                      setAiDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
                  >
                    <Sparkles className="h-3 w-3" />
                    Multi-task AI Plan
                  </button>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-white whitespace-nowrap shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <span>Add Task</span>
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
