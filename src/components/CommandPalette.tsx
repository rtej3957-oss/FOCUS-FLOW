import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Flame,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Timer,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { NavPage } from '../types';

interface PaletteAction {
  id: string;
  label: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    state,
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActivePage,
    setQuickAddOpen,
    setAiDrawerOpen,
    openEditTaskModal,
    setSelectedProjectId,
    updatePreferences,
  } = useFocusFlow();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  const actions = useMemo<PaletteAction[]>(() => {
    const navItems: Array<{ page: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }> = [
      { page: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard },
      { page: 'today', label: 'Go to Today', icon: Sun },
      { page: 'upcoming', label: 'Go to Upcoming', icon: Calendar },
      { page: 'all-tasks', label: 'Go to All Tasks', icon: ListTodo },
      { page: 'calendar', label: 'Go to Calendar', icon: Calendar },
      { page: 'projects', label: 'Go to Projects', icon: FolderKanban },
      { page: 'habits', label: 'Go to Habit Tracker', icon: Flame },
      { page: 'focus', label: 'Go to Focus Mode', icon: Timer },
      { page: 'analytics', label: 'Go to Analytics', icon: BarChart3 },
      { page: 'completed', label: 'Go to Completed Tasks', icon: CheckCircle2 },
      { page: 'settings', label: 'Go to Settings', icon: Settings },
    ];

    const list: PaletteAction[] = [
      {
        id: 'act-quick-add',
        label: 'Quick Add Task (N)',
        section: 'Actions',
        icon: Plus,
        onSelect: () => {
          setCommandPaletteOpen(false);
          setQuickAddOpen(true);
        },
      },
      {
        id: 'act-ai',
        label: 'Open AI Productivity Assistant',
        section: 'Actions',
        icon: Sparkles,
        onSelect: () => {
          setCommandPaletteOpen(false);
          setAiDrawerOpen(true);
        },
      },
      {
        id: 'act-theme',
        label: `Switch Theme (Current: ${state.preferences.theme})`,
        section: 'Actions',
        icon: state.preferences.theme === 'dark' ? Sun : Moon,
        onSelect: () => {
          updatePreferences({ theme: state.preferences.theme === 'dark' ? 'light' : 'dark' });
          setCommandPaletteOpen(false);
        },
      },
      ...navItems.map((n) => ({
        id: `nav-${n.page}`,
        label: n.label,
        section: 'Navigation',
        icon: n.icon,
        onSelect: () => {
          setActivePage(n.page);
          setCommandPaletteOpen(false);
        },
      })),
      ...state.projects.map((p) => ({
        id: `proj-${p.id}`,
        label: `Project: ${p.name}`,
        section: 'Projects',
        icon: FolderKanban,
        onSelect: () => {
          setSelectedProjectId(p.id);
          setActivePage('projects');
          setCommandPaletteOpen(false);
        },
      })),
      ...state.tasks.slice(0, 25).map((t) => ({
        id: `task-${t.id}`,
        label: t.title,
        section: 'Tasks',
        icon: CheckCircle2,
        onSelect: () => {
          setCommandPaletteOpen(false);
          openEditTaskModal(t);
        },
      })),
    ];

    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 14);
    return list.filter((item) => item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q));
  }, [
    query,
    state.projects,
    state.tasks,
    state.preferences.theme,
    setCommandPaletteOpen,
    setQuickAddOpen,
    setAiDrawerOpen,
    updatePreferences,
    setActivePage,
    setSelectedProjectId,
    openEditTaskModal,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(actions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && actions[selectedIndex]) {
      e.preventDefault();
      actions[selectedIndex].onSelect();
    }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={() => setCommandPaletteOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl rounded-xl border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#17181E] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-[#242632] px-4 py-3">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command, page, project, or task..."
                className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
              />
              <kbd className="rounded border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                ESC
              </kbd>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2 space-y-0.5">
              {actions.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No matching commands or tasks found.
                </div>
              ) : (
                actions.map((item, idx) => {
                  const Icon = item.icon;
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={item.onSelect}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">
                        {item.section}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
