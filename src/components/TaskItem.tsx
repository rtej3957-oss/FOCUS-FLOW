import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  GripVertical,
  Play,
  Repeat,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { Task } from '../types';
import { PRIORITY_CONFIG } from '../utils/constants';
import { formatDisplayDate, formatTime12h, isTaskOverdue } from '../utils/date';
import { CategoryIcon } from './CategoryIcon';

interface TaskItemProps {
  task: Task;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent, taskId: string) => void;
  onDrop?: (e: React.DragEvent, taskId: string) => void;
  compact?: boolean;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  compact = false,
}) => {
  const {
    state,
    toggleTaskCompletion,
    toggleSubtask,
    openEditTaskModal,
    duplicateTask,
    deleteTask,
    requestConfirm,
    setFocusTask,
    setActivePage,
    setAiBreakdownTaskId,
    setAiDrawerTab,
    setAiDrawerOpen,
  } = useFocusFlow();

  const [expanded, setExpanded] = useState(false);

  const category = state.categories.find((c) => c.id === task.categoryId);
  const project = task.projectId ? state.projects.find((p) => p.id === task.projectId) : null;
  const overdue = isTaskOverdue(task);
  const completed = task.status === 'completed';
  const priorityMeta = PRIORITY_CONFIG[task.priority];

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  const handleStartFocus = () => {
    setFocusTask(task.id);
    setActivePage('focus');
  };

  const handleAiBreakdown = () => {
    setAiBreakdownTaskId(task.id);
    setAiDrawerTab('breakdown');
    setAiDrawerOpen(true);
  };

  const handleDelete = () => {
    requestConfirm({
      title: 'Delete task?',
      message: `"${task.title}" will be removed. You can undo right after deleting.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteTask(task.id),
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e as unknown as React.DragEvent, task.id)}
      onDragOver={(e) => onDragOver?.(e as unknown as React.DragEvent, task.id)}
      onDrop={(e) => onDrop?.(e as unknown as React.DragEvent, task.id)}
      className={`group rounded-xl border border-zinc-200 dark:border-[#242632] bg-white dark:bg-[#17181E] transition-colors hover:border-zinc-300 dark:hover:border-[#343848] ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
      }`}
    >
      <div className="flex items-start gap-3">
        {draggable && (
          <span
            className="mt-1 hidden sm:inline-flex cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}

        {/* Animated Checkbox */}
        <button
          type="button"
          onClick={() => toggleTaskCompletion(task.id)}
          aria-label={completed ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
            completed
              ? 'border-[var(--accent)] bg-[var(--accent)] text-white scale-100'
              : 'border-zinc-300 dark:border-zinc-600 hover:border-[var(--accent)] bg-transparent'
          }`}
        >
          <motion.span
            initial={false}
            animate={{ scale: completed ? 1 : 0, opacity: completed ? 1 : 0 }}
            transition={{ duration: 0.14 }}
          >
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          </motion.span>
        </button>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => openEditTaskModal(task)}
              className={`text-left text-sm font-medium leading-snug transition-colors focus-visible:outline-none focus-visible:underline ${
                completed
                  ? 'line-through text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-900 dark:text-zinc-100 hover:text-[var(--accent)]'
              }`}
            >
              {task.title}
            </button>

            {/* Quick Hover / Focus Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              {!completed && (
                <button
                  type="button"
                  onClick={handleStartFocus}
                  title="Start Focus Session"
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-[var(--accent)] dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Focus on this task"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              {!completed && (
                <button
                  type="button"
                  onClick={handleAiBreakdown}
                  title="AI Break Down into Subtasks"
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-[var(--accent)] dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Break down with AI"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => openEditTaskModal(task)}
                title="Edit task"
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                aria-label="Edit task"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {!compact && (
                <button
                  type="button"
                  onClick={() => duplicateTask(task.id)}
                  title="Duplicate task"
                  className="hidden md:inline-flex rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  aria-label="Duplicate task"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                title="Delete task"
                className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!compact && task.description && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{task.description}</p>
          )}

          {/* Clean unboxed inline metadata with · separators */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {/* Priority with color + explicit label */}
            <span className={`inline-flex items-center gap-1.5 font-medium ${priorityMeta.textColor}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityMeta.dotColor }} />
              {priorityMeta.label}
            </span>

            {task.dueDate && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={`tabular-nums ${
                    overdue ? 'font-medium text-red-600 dark:text-red-400' : ''
                  }`}
                >
                  {overdue ? 'Overdue · ' : ''}
                  {formatDisplayDate(task.dueDate)}
                  {task.dueTime ? ` at ${formatTime12h(task.dueTime)}` : ''}
                </span>
              </>
            )}

            {category && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <CategoryIcon name={category.icon} className="h-3 w-3" style={{ color: category.color }} />
                  <span>{category.name}</span>
                </span>
              </>
            )}

            {project && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-xs" style={{ backgroundColor: project.color }} />
                  <span className="truncate max-w-[140px]">{project.name}</span>
                </span>
              </>
            )}

            {task.status === 'in_progress' && !overdue && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[var(--accent)]">In Progress</span>
              </>
            )}

            {task.estimatedMinutes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{task.estimatedMinutes}m</span>
              </>
            )}

            {task.recurring !== 'none' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 capitalize">
                  <Repeat className="h-3 w-3" />
                  {task.recurring}
                </span>
              </>
            )}

            {task.subtasks.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors tabular-nums"
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {completedSubtasks}/{task.subtasks.length} subtasks
                </button>
              </>
            )}

            {task.tags.length > 0 && !compact && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  {task.tags.map((t) => `#${t}`).join(' ')}
                </span>
              </>
            )}
          </div>

          {/* Expandable Subtasks */}
          {expanded && task.subtasks.length > 0 && (
            <div className="mt-2.5 space-y-1.5 border-t border-zinc-100 dark:border-[#232530] pt-2.5">
              {task.subtasks.map((st) => (
                <label
                  key={st.id}
                  className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => toggleSubtask(task.id, st.id)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600 accent-[var(--accent)]"
                  />
                  <span className={st.completed ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}>
                    {st.title}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
