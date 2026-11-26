import React, { useState } from 'react';
import { Bell, Menu, Moon, Plus, Search, Sparkles, Sun } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { NavPage } from '../types';
import { NotificationsPopover } from './NotificationsPopover';

const PAGE_LABELS: Record<NavPage, string> = {
  dashboard: 'Dashboard',
  today: 'Today',
  upcoming: 'Upcoming',
  'all-tasks': 'All Tasks',
  calendar: 'Calendar',
  projects: 'Projects',
  habits: 'Habit Tracker',
  focus: 'Focus Mode',
  analytics: 'Analytics',
  completed: 'Completed Tasks',
  settings: 'Settings',
};

export const TopBar: React.FC = () => {
  const {
    state,
    activePage,
    setMobileMenuOpen,
    setCommandPaletteOpen,
    setAiDrawerOpen,
    openCreateTaskModal,
    updatePreferences,
    notifications,
  } = useFocusFlow();

  const [notifOpen, setNotifOpen] = useState(false);

  const isDark =
    state.preferences.theme === 'dark' ||
    (state.preferences.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    updatePreferences({ theme: isDark ? 'light' : 'dark' });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-zinc-200 dark:border-[#232530] bg-white/90 dark:bg-[#111216]/90 backdrop-blur-md px-4 sm:px-6">
      {/* Left Zone: Mobile toggle + Breadcrumb / Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-[#262832] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500 whitespace-nowrap">Focus Flow</span>
          <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600" aria-hidden="true">
            /
          </span>
          <h1 className="font-display text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {PAGE_LABELS[activePage]}
          </h1>
        </div>
      </div>

      {/* Center / Right Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#262832] bg-zinc-50 dark:bg-[#18191F] px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search or jump</span>
          <kbd className="ml-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#111216] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="inline-flex sm:hidden h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-[#262832] text-zinc-600 dark:text-zinc-300"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setAiDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#18191F] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors whitespace-nowrap shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="hidden md:inline">AI Assistant</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-[#262832] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {notifications.length}
              </span>
            )}
          </button>
          {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-[#262832] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => openCreateTaskModal()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>
    </header>
  );
};
