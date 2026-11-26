import React, { useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { RecurringSchedule, Subtask, TaskPriority, TaskStatus } from '../types';
import { getTodayStr } from '../utils/date';

export const TaskModal: React.FC = () => {
  const {
    state,
    taskModalState,
    closeTaskModal,
    addTask,
    updateTask,
    setAiBreakdownTaskId,
    setAiDrawerTab,
    setAiDrawerOpen,
  } = useFocusFlow();

  const { open, task, prefillDate, prefillTime, prefillProjectId } = taskModalState;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(state.preferences.defaultPriority);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? 'cat-personal');
  const [projectId, setProjectId] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [recurring, setRecurring] = useState<RecurringSchedule>('none');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setNewSubtaskTitle('');
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDueDate(task.dueDate);
      setDueTime(task.dueTime);
      setPriority(task.priority);
      setStatus(task.status);
      setCategoryId(task.categoryId);
      setProjectId(task.projectId ?? '');
      setEstimatedMinutes(task.estimatedMinutes);
      setRecurring(task.recurring);
      setTagsInput(task.tags.join(', '));
      setNotes(task.notes);
      setSubtasks(task.subtasks);
    } else {
      setTitle('');
      setDescription('');
      setDueDate(prefillDate ?? getTodayStr());
      setDueTime(prefillTime ?? '');
      setPriority(state.preferences.defaultPriority);
      setStatus('todo');
      setCategoryId(state.categories[0]?.id ?? 'cat-personal');
      setProjectId(prefillProjectId ?? '');
      setEstimatedMinutes(30);
      setRecurring('none');
      setTagsInput('');
      setNotes('');
      setSubtasks([]);
    }
  }, [open, task, prefillDate, prefillTime, prefillProjectId, state.preferences.defaultPriority, state.categories]);

  const handleAddSubtask = () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: trimmed, completed: false },
    ]);
    setNewSubtaskTitle('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      dueDate,
      dueTime,
      priority,
      status,
      categoryId,
      projectId: projectId || null,
      estimatedMinutes: Math.max(5, Number(estimatedMinutes) || 30),
      recurring,
      tags,
      notes: notes.trim(),
      subtasks,
    };

    if (task) {
      updateTask(task.id, payload);
    } else {
      addTask(payload);
    }
    closeTaskModal();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeTaskModal}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#17181E] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#242632] px-6 py-4">
              <h2 id="task-modal-title" className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {task ? 'Edit Task' : 'Create Task'}
              </h2>
              <div className="flex items-center gap-2">
                {task && (
                  <button
                    type="button"
                    onClick={() => {
                      closeTaskModal();
                      setAiBreakdownTaskId(task.id);
                      setAiDrawerTab('breakdown');
                      setAiDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2B2E3B] px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                    AI Breakdown
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="task-title" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Task Title *
                </label>
                <input
                  id="task-title"
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g., Prepare architecture presentation slides"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="task-desc" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Description
                </label>
                <textarea
                  id="task-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context, links, or success criteria..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label htmlFor="task-date" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Due Date
                  </label>
                  <input
                    id="task-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-time" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Due Time
                  </label>
                  <input
                    id="task-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-duration" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Est. Duration (min)
                  </label>
                  <input
                    id="task-duration"
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label htmlFor="task-priority" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="urgent">Urgent (Red)</option>
                    <option value="high">High (Orange)</option>
                    <option value="medium">Medium (Yellow)</option>
                    <option value="low">Low (Green)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="task-category" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Category
                  </label>
                  <select
                    id="task-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  >
                    {state.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-status" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Status
                  </label>
                  <select
                    id="task-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="task-project" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Project
                  </label>
                  <select
                    id="task-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="">No project</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-recurring" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Recurring Schedule
                  </label>
                  <select
                    id="task-recurring"
                    value={recurring}
                    onChange={(e) => setRecurring(e.target.value as RecurringSchedule)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Every weekday</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Subtasks Builder */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Subtasks
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="Add a step and press Enter"
                    className="flex-1 rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
                {subtasks.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 dark:border-[#252834] px-3 py-1.5 text-xs"
                      >
                        <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onChange={() =>
                              setSubtasks((prev) =>
                                prev.map((item) =>
                                  item.id === st.id ? { ...item, completed: !item.completed } : item
                                )
                              )
                            }
                            className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
                          />
                          <span className={`truncate ${st.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {st.title}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setSubtasks((prev) => prev.filter((item) => item.id !== st.id))}
                          className="text-zinc-400 hover:text-red-500 p-0.5"
                          aria-label="Remove subtask"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="task-tags" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Tags (comma-separated)
                  </label>
                  <input
                    id="task-tags"
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g., exam, deep-work, review"
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-notes" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Additional Notes
                  </label>
                  <input
                    id="task-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Quick reminder or reference"
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-[#242632] pt-4">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {task ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
