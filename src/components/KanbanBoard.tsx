import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { KanbanColumnId, Task, TaskStatus } from '../types';
import { PRIORITY_CONFIG } from '../utils/constants';
import { formatDisplayDate, formatTime12h, getTodayStr, isTaskOverdue } from '../utils/date';

interface KanbanBoardProps {
  tasks: Task[];
}

const COLUMNS: Array<{ id: KanbanColumnId; title: string; accentClass: string }> = [
  { id: 'todo', title: 'To Do', accentClass: 'text-zinc-700 dark:text-zinc-200' },
  { id: 'in_progress', title: 'In Progress', accentClass: 'text-[var(--accent)]' },
  { id: 'completed', title: 'Completed', accentClass: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'overdue', title: 'Overdue', accentClass: 'text-red-600 dark:text-red-400' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks }) => {
  const { state, moveTaskStatus, updateTask, toggleTaskCompletion, openEditTaskModal, openCreateTaskModal } =
    useFocusFlow();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanColumnId | null>(null);

  const getColumnForTask = (task: Task): KanbanColumnId => {
    if (task.status === 'completed') return 'completed';
    if (isTaskOverdue(task)) return 'overdue';
    return task.status;
  };

  const handleDropOnColumn = (colId: KanbanColumnId) => {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    setDragOverCol(null);
    setDraggedTaskId(null);
    if (!task) return;

    if (colId === 'completed') {
      moveTaskStatus(task.id, 'completed');
      return;
    }

    if (colId === 'overdue') {
      // Moving to overdue keeps pending status; user sees overdue if past due
      if (task.status === 'completed') moveTaskStatus(task.id, 'todo');
      return;
    }

    // Moving an overdue task into To Do or In Progress also reschedules past-due date to today so it leaves Overdue cleanly
    const patch: Partial<Task> = {
      status: colId as TaskStatus,
      completedAt: null,
    };
    if (isTaskOverdue(task)) {
      patch.dueDate = getTodayStr();
      patch.dueTime = '';
    }
    updateTask(task.id, patch);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => getColumnForTask(t) === col.id);
        const isDropTarget = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.id);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnColumn(col.id);
            }}
            className={`flex flex-col rounded-xl border transition-colors min-h-[340px] ${
              isDropTarget
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-zinc-200 dark:border-[#232530] bg-zinc-50/70 dark:bg-[#14151B]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-[#232530] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${col.accentClass}`}>{col.title}</h3>
                <span className="font-mono tabular-nums text-xs text-zinc-400 dark:text-zinc-500">
                  {colTasks.length}
                </span>
              </div>
              {col.id !== 'overdue' && col.id !== 'completed' && (
                <button
                  type="button"
                  onClick={() => openCreateTaskModal()}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="Add task"
                  aria-label={`Add task to ${col.title}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
              {colTasks.length === 0 ? (
                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-[#272936] px-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  {col.id === 'overdue' ? 'No overdue tasks' : `Drop tasks into ${col.title}`}
                </div>
              ) : (
                colTasks.map((task) => {
                  const category = state.categories.find((c) => c.id === task.categoryId);
                  const priorityMeta = PRIORITY_CONFIG[task.priority];
                  const isDone = task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedTaskId(task.id)}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverCol(null);
                      }}
                      className="cursor-grab active:cursor-grabbing rounded-lg border border-zinc-200 dark:border-[#262936] bg-white dark:bg-[#191B23] p-3 hover:border-zinc-300 dark:hover:border-[#373B4D] transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleTaskCompletion(task.id)}
                          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isDone
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : 'border-zinc-300 dark:border-zinc-600 hover:border-[var(--accent)]'
                          }`}
                        >
                          {isDone && <Check className="h-3 w-3 stroke-[2.5]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditTaskModal(task)}
                          className={`text-left text-sm font-medium leading-snug hover:text-[var(--accent)] ${
                            isDone ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {task.title}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className={`inline-flex items-center gap-1 font-medium ${priorityMeta.textColor}`}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: priorityMeta.dotColor }}
                          />
                          {priorityMeta.label}
                        </span>
                        {task.dueDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {formatDisplayDate(task.dueDate)}
                              {task.dueTime ? ` ${formatTime12h(task.dueTime)}` : ''}
                            </span>
                          </>
                        )}
                        {category && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
