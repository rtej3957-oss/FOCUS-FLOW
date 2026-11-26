import React, { useState } from 'react';
import {
  BarChart3,
  Calendar as CalendarIcon,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { NavPage } from '../types';
import { getTodayStr, isTaskOverdue, isWithinNextDays } from '../utils/date';

interface NavItemConfig {
  id: NavPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const Sidebar: React.FC = () => {
  const {
    state,
    activePage,
    setActivePage,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    setQuickAddOpen,
    focusTimer,
    authUser,
    logoutAccount,
    exitGuestMode,
  } = useFocusFlow();

  const [avatarFailed, setAvatarFailed] = useState(false);

  const today = getTodayStr();
  const todayCount = state.tasks.filter(
    (t) => t.status !== 'completed' && (t.dueDate === today || isTaskOverdue(t))
  ).length;
  const upcomingCount = state.tasks.filter(
    (t) => t.status !== 'completed' && t.dueDate > today && isWithinNextDays(t.dueDate, 7)
  ).length;
  const pendingCount = state.tasks.filter((t) => t.status !== 'completed').length;
  const completedCount = state.tasks.filter((t) => t.status === 'completed').length;

  const primaryNav: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'today', label: 'Today', icon: Sun, count: todayCount },
    { id: 'upcoming', label: 'Upcoming', icon: CalendarClock, count: upcomingCount },
    { id: 'all-tasks', label: 'All Tasks', icon: ListTodo, count: pendingCount },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'projects', label: 'Projects', icon: FolderKanban, count: state.projects.filter((p) => p.status === 'active').length },
    { id: 'habits', label: 'Habit Tracker', icon: Flame },
    { id: 'focus', label: 'Focus Mode', icon: Timer },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'completed', label: 'Completed Tasks', icon: CheckCircle2, count: completedCount },
  ];

  const handleNavigate = (page: NavPage) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const formatTimerMini = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const initials = state.preferences.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSidebarContent = (isMobileDrawer = false) => {
    const collapsed = !isMobileDrawer && sidebarCollapsed;

    return (
      <div className="flex h-full flex-col bg-[#FBFBFC] dark:bg-[#14151B] border-r border-zinc-200 dark:border-[#232530]">
        {/* Brand Row */}
        <div className={`flex h-14 items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'} border-b border-zinc-200/80 dark:border-[#232530]`}>
          {!collapsed && (
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-md px-1 py-0.5"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white font-display text-sm font-bold"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                F
              </span>
              <span className="font-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                Focus Flow
              </span>
            </button>
          )}

          {collapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-display text-sm font-bold"
              style={{ backgroundColor: 'var(--accent)' }}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              F
            </button>
          )}

          {!isMobileDrawer && !collapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {isMobileDrawer && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Prominent Quick Add Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              setQuickAddOpen(true);
              setMobileMenuOpen(false);
            }}
            title="Quick Add Task (N)"
            className={`flex w-full items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3.5'} py-2.5 rounded-lg text-sm font-medium text-white shadow-xs transition-transform active:scale-[0.99] whitespace-nowrap`}
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Quick Add Task</span>}
            </span>
            {!collapsed && (
              <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white/90">
                N
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-1 space-y-0.5" aria-label="Primary navigation">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`group flex w-full items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={`font-mono tabular-nums text-xs ${
                      isActive ? 'text-[var(--accent)] font-semibold' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Running Focus Timer mini-banner when navigating across pages */}
        {focusTimer.status !== 'idle' && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => handleNavigate('focus')}
              className={`flex w-full items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2 rounded-lg border border-zinc-200 dark:border-[#272A36] bg-white dark:bg-[#1B1D25] text-xs font-medium hover:border-[var(--accent)] transition-colors`}
              title="Return to Focus Mode"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Timer className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                {!collapsed && (
                  <span className="truncate text-zinc-700 dark:text-zinc-200">
                    {focusTimer.status === 'running' ? 'Focusing' : 'Paused'}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="font-mono tabular-nums font-semibold text-[var(--accent)]">
                  {formatTimerMini(focusTimer.remainingSeconds)}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Settings & User Profile */}
        <div className="border-t border-zinc-200/80 dark:border-[#232530] p-2.5 space-y-1">
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            title={collapsed ? 'Settings' : undefined}
            className={`flex w-full items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activePage === 'settings'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>

          {!isMobileDrawer && collapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="flex w-full items-center justify-center py-2 rounded-lg text-zinc-500 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNavigate('settings')}
              className={`flex min-w-0 flex-1 items-center ${collapsed ? 'justify-center px-1' : 'gap-2.5 px-2.5'} py-2 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors text-left`}
            >
              {state.preferences.avatarUrl && !avatarFailed ? (
                <img
                  src={state.preferences.avatarUrl}
                  alt={state.preferences.displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-8 w-8 shrink-0 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {initials || 'FF'}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {state.preferences.displayName}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {authUser ? authUser.email : 'Local Guest Mode'}
                  </p>
                </div>
              )}
            </button>

            {!collapsed && (
              authUser ? (
                <button
                  type="button"
                  onClick={() => {
                    void logoutAccount();
                    setMobileMenuOpen(false);
                  }}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    exitGuestMode();
                    setMobileMenuOpen(false);
                  }}
                  title="Sign in or create account"
                  aria-label="Sign in or create account"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                </button>
              )
            )}
          </div>

          {collapsed && (
            <button
              type="button"
              onClick={() => {
                if (authUser) {
                  void logoutAccount();
                } else {
                  exitGuestMode();
                }
              }}
              title={authUser ? 'Sign out' : 'Sign in'}
              aria-label={authUser ? 'Sign out' : 'Sign in'}
              className="flex w-full items-center justify-center py-2 rounded-lg text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
            >
              {authUser ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ease-out ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[252px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[268px]">{renderSidebarContent(true)}</aside>
        </div>
      )}
    </>
  );
};
