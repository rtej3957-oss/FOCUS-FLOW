import React, { useMemo, useState } from 'react';
import { ArrowLeft, Edit3, FolderKanban, Plus, Trash2, X } from 'lucide-react';
import { TaskItem } from '../components/TaskItem';
import { useFocusFlow } from '../context/FocusFlowContext';
import { Project, ProjectStatus } from '../types';
import { COLOR_PALETTE } from '../utils/constants';
import { formatDisplayDate } from '../utils/date';

const STATUS_LABELS: Record<ProjectStatus, { label: string; textClass: string }> = {
  active: { label: 'Active', textClass: 'text-emerald-600 dark:text-emerald-400' },
  on_hold: { label: 'On Hold', textClass: 'text-amber-600 dark:text-amber-400' },
  completed: { label: 'Completed', textClass: 'text-[var(--accent)]' },
  archived: { label: 'Archived', textClass: 'text-zinc-500 dark:text-zinc-400' },
};

export const ProjectsPage: React.FC = () => {
  const {
    state,
    selectedProjectId,
    setSelectedProjectId,
    addProject,
    updateProject,
    deleteProject,
    requestConfirm,
    openCreateTaskModal,
  } = useFocusFlow();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [error, setError] = useState('');

  const openCreateModal = () => {
    setEditingProj(null);
    setName('');
    setDescription('');
    setDeadline('');
    setColor(COLOR_PALETTE[0]);
    setStatus('active');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProj(proj);
    setName(proj.name);
    setDescription(proj.description);
    setDeadline(proj.deadline);
    setColor(proj.color);
    setStatus(proj.status);
    setError('');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (editingProj) {
      updateProject(editingProj.id, {
        name: name.trim(),
        description: description.trim(),
        deadline,
        color,
        status,
      });
    } else {
      addProject({
        name: name.trim(),
        description: description.trim(),
        deadline,
        color,
        status,
      });
    }
    setModalOpen(false);
  };

  const projectStats = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; pct: number }>();
    state.projects.forEach((p) => {
      const pTasks = state.tasks.filter((t) => t.projectId === p.id);
      const completed = pTasks.filter((t) => t.status === 'completed').length;
      const total = pTasks.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      map.set(p.id, { total, completed, pct });
    });
    return map;
  }, [state.projects, state.tasks]);

  const activeProject = selectedProjectId
    ? state.projects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  const activeProjectTasks = useMemo(() => {
    if (!activeProject) return [];
    return state.tasks
      .filter((t) => t.projectId === activeProject.id)
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return a.order - b.order;
      });
  }, [state.tasks, activeProject]);

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      {activeProject ? (
        /* Project Detail View */
        (() => {
          const stats = projectStats.get(activeProject.id) ?? { total: 0, completed: 0, pct: 0 };
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Projects
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(activeProject)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Project
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateTaskModal({ projectId: activeProject.id })}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Project Task
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-xs shrink-0" style={{ backgroundColor: activeProject.color }} />
                      <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {activeProject.name}
                      </h2>
                    </div>
                    {activeProject.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{activeProject.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className={`font-medium ${STATUS_LABELS[activeProject.status].textClass}`}>
                        {STATUS_LABELS[activeProject.status].label}
                      </span>
                      {activeProject.deadline && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">Deadline: {formatDisplayDate(activeProject.deadline)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {stats.completed}/{stats.total} tasks completed
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-52 shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                      <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {stats.pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-[#232530] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${stats.pct}%`, backgroundColor: activeProject.color }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {activeProjectTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 dark:border-[#282B38] bg-white dark:bg-[#17181E] py-12 px-4 text-center">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No tasks in this project yet</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Add tasks to track progress automatically.
                  </p>
                  <button
                    type="button"
                    onClick={() => openCreateTaskModal({ projectId: activeProject.id })}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add First Task
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeProjectTasks.map((t) => (
                    <TaskItem key={t.id} task={t} />
                  ))}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* Projects Grid */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">Projects</h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Organize multi-step initiatives with automatic progress tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap self-start sm:self-auto"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>
          </div>

          {state.projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-[#282B38] bg-white dark:bg-[#17181E] py-16 px-4 text-center">
              <FolderKanban className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No projects created yet</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Group related tasks under a project to track milestones and deadlines.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.projects.map((proj) => {
                const stats = projectStats.get(proj.id) ?? { total: 0, completed: 0, pct: 0 };
                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className="group cursor-pointer rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5 hover:border-zinc-300 dark:hover:border-[#343848] transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-3 w-3 rounded-xs shrink-0"
                            style={{ backgroundColor: proj.color }}
                          />
                          <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {proj.name}
                          </h3>
                        </div>

                        <div
                          className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openEditModal(proj)}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            aria-label="Edit project"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestConfirm({
                                title: 'Delete project?',
                                message: `Delete "${proj.name}"? Tasks inside will remain in your workspace without a project.`,
                                confirmLabel: 'Delete',
                                destructive: true,
                                onConfirm: () => deleteProject(proj.id),
                              })
                            }
                            className="rounded p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-500"
                            aria-label="Delete project"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {proj.description && (
                        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                          {proj.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span className={`font-medium ${STATUS_LABELS[proj.status].textClass}`}>
                          {STATUS_LABELS[proj.status].label}
                        </span>
                        <span className="font-mono tabular-nums">
                          {stats.completed}/{stats.total} tasks · {stats.pct}%
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-[#232530] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${stats.pct}%`, backgroundColor: proj.color }}
                        />
                      </div>

                      {proj.deadline && (
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                          Deadline: {formatDisplayDate(proj.deadline)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Project Modal */}
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
                {editingProj ? 'Edit Project' : 'New Project'}
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
                  Project Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g., Thesis Research"
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project scope or milestones..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
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
                      className={`h-6 w-6 rounded-full transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-[#17181E] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
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
                  {editingProj ? 'Save Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
