import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Columns3, List, Plus, Search } from 'lucide-react';
import { CalendarWidget } from '../components/CalendarWidget';
import { KanbanBoard } from '../components/KanbanBoard';
import { TaskItem } from '../components/TaskItem';
import { useFocusFlow } from '../context/FocusFlowContext';
import { TaskPriority, TaskViewMode } from '../types';
import { PRIORITY_CONFIG } from '../utils/constants';
import { getTodayStr, isTaskOverdue, isWithinNextDays, toLocalDateStr } from '../utils/date';

interface TasksViewPageProps {
  scope: 'today' | 'upcoming' | 'all' | 'completed';
}

type SortKey = 'order' | 'dueDate' | 'priority' | 'duration' | 'title';
type StatusFilter = 'all' | 'todo' | 'in_progress' | 'completed' | 'overdue';
type DeadlineFilter = 'all' | 'overdue' | 'today' | 'week' | 'nodate';

export const TasksViewPage: React.FC<TasksViewPageProps> = ({ scope }) => {
  const { state, openCreateTaskModal, reorderTasks } = useFocusFlow();

  const [viewMode, setViewMode] = useState<TaskViewMode>('list');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('order');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const today = getTodayStr();

  const headerInfo = useMemo(() => {
    switch (scope) {
      case 'today':
        return {
          title: 'Today',
          subtitle: 'Tasks due today, overdue items needing attention, and tasks completed today.',
        };
      case 'upcoming':
        return {
          title: 'Upcoming',
          subtitle: 'Scheduled tasks coming up over the next 14 days.',
        };
      case 'completed':
        return {
          title: 'Completed Tasks',
          subtitle: 'Archive of every finished task across your workspace.',
        };
      default:
        return {
          title: 'All Tasks',
          subtitle: 'Full task backlog with List, Kanban, and Calendar views.',
        };
    }
  }, [scope]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    const base = state.tasks.filter((task) => {
      // Scope filter
      if (scope === 'today') {
        const completedToday =
          task.status === 'completed' && task.completedAt && toLocalDateStr(new Date(task.completedAt)) === today;
        const isTodayOrOverdue = task.dueDate === today || isTaskOverdue(task) || completedToday;
        if (!isTodayOrOverdue) return false;
      } else if (scope === 'upcoming') {
        if (task.status === 'completed') return false;
        if (!task.dueDate || !isWithinNextDays(task.dueDate, 14)) return false;
      } else if (scope === 'completed') {
        if (task.status !== 'completed') return false;
      }

      // Search
      if (q) {
        const hay = `${task.title} ${task.description} ${task.tags.join(' ')} ${task.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Priority
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

      // Category
      if (categoryFilter !== 'all' && task.categoryId !== categoryFilter) return false;

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
          if (!isTaskOverdue(task)) return false;
        } else if (task.status !== statusFilter) {
          return false;
        }
      }

      // Deadline filter
      if (deadlineFilter !== 'all') {
        if (deadlineFilter === 'overdue' && !isTaskOverdue(task)) return false;
        if (deadlineFilter === 'today' && task.dueDate !== today) return false;
        if (deadlineFilter === 'week' && !isWithinNextDays(task.dueDate, 7)) return false;
        if (deadlineFilter === 'nodate' && task.dueDate !== '') return false;
      }

      return true;
    });

    // Sort
    return [...base].sort((a, b) => {
      if (sortBy === 'dueDate') {
        return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
      }
      if (sortBy === 'priority') {
        return PRIORITY_CONFIG[b.priority].rank - PRIORITY_CONFIG[a.priority].rank;
      }
      if (sortBy === 'duration') {
        return b.estimatedMinutes - a.estimatedMinutes;
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // Default order: keep incomplete before completed
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return a.order - b.order;
    });
  }, [state.tasks, scope, today, search, priorityFilter, categoryFilter, statusFilter, deadlineFilter, sortBy]);

  return (
    <div className="mx-auto max-w-[1320px] space-y-5">
      {/* Header + View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {headerInfo.title}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{headerInfo.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {scope !== 'completed' && (
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-[#1B1D25] p-1">
              {[
                { id: 'list', label: 'List', icon: List },
                { id: 'kanban', label: 'Kanban', icon: Columns3 },
                { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
              ].map((m) => {
                const Icon = m.icon;
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id as TaskViewMode)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-[#121318] text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => openCreateTaskModal({ date: scope === 'today' ? today : undefined })}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Search, Filter & Sort Toolbar */}
      <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="lg:col-span-2 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, tags, notes..."
              className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </select>

          <div className="flex gap-2">
            <select
              aria-label="Filter by deadline"
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
              className="flex-1 rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="all">Any Deadline</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Next 7 Days</option>
              <option value="nodate">No Date</option>
            </select>

            <select
              aria-label="Sort tasks"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="flex-1 rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="order">Manual Order</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="duration">Duration</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'kanban' && scope !== 'completed' ? (
        <KanbanBoard tasks={filteredTasks} />
      ) : viewMode === 'calendar' && scope !== 'completed' ? (
        <CalendarWidget tasks={filteredTasks} compact />
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-[#282B38] bg-white dark:bg-[#17181E] py-14 px-6 text-center">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {search || priorityFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'No tasks match your current filters'
              : scope === 'completed'
              ? 'No completed tasks yet'
              : 'No tasks in this view'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {scope === 'completed'
              ? 'Completed tasks will appear here automatically once you check them off.'
              : 'Create a new task or adjust your filters to see matching tasks.'}
          </p>
          {scope !== 'completed' && (
            <button
              type="button"
              onClick={() => openCreateTaskModal()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              draggable={sortBy === 'order'}
              onDragStart={(_, id) => setDraggedId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(_, targetId) => {
                if (draggedId && draggedId !== targetId) {
                  reorderTasks(draggedId, targetId);
                }
                setDraggedId(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
