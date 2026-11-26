import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCurrentUser,
  loginWithSupabase,
  logoutFromSupabase,
  signupWithSupabase,
  updateSupabaseProfile,
} from '../services/authClient';
import {
  BackendSyncState,
  loadWorkspaceFromSupabase,
  syncWorkspaceToSupabase,
} from '../services/supabaseSync';
import { workspaceRepository } from '../storage/repository';
import {
  ActiveFocusTimerState,
  AppNotification,
  AuthUser,
  Category,
  FocusModeType,
  FocusSession,
  Habit,
  NavPage,
  Project,
  RecurringSchedule,
  Task,
  TaskStatus,
  UserPreferences,
  WorkspaceState,
} from '../types';
import { ACCENT_PRESETS } from '../utils/constants';
import {
  addDays,
  getTodayStr,
  isHabitScheduledForDate,
  isTaskDueSoon,
  isTaskOverdue,
  parseLocalDate,
  toLocalDateStr,
} from '../utils/date';
import { playFocusChime } from '../utils/sound';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

interface UndoToastState {
  id: string;
  message: string;
  onUndo: () => void;
}

interface FocusFlowContextValue {
  state: WorkspaceState;
  activePage: NavPage;
  setActivePage: (page: NavPage) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;

  // Modals & Drawers
  quickAddOpen: boolean;
  setQuickAddOpen: (v: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (v: boolean) => void;
  aiDrawerTab: 'plan' | 'breakdown' | 'schedule' | 'summary';
  setAiDrawerTab: (tab: 'plan' | 'breakdown' | 'schedule' | 'summary') => void;
  aiBreakdownTaskId: string | null;
  setAiBreakdownTaskId: (id: string | null) => void;
  taskModalState: { open: boolean; task: Task | null; prefillDate?: string; prefillTime?: string; prefillProjectId?: string | null };
  openCreateTaskModal: (prefill?: { date?: string; time?: string; projectId?: string | null }) => void;
  openEditTaskModal: (task: Task) => void;
  closeTaskModal: () => void;

  // Confirmation & Undo
  confirmDialog: ConfirmOptions | null;
  requestConfirm: (opts: ConfirmOptions) => void;
  closeConfirm: () => void;
  undoToast: UndoToastState | null;
  dismissUndoToast: () => void;

  // Task operations
  addTask: (input: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'order'>) => Task;
  addManyTasks: (inputs: Array<Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'order'>>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  toggleTaskCompletion: (id: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  moveTaskStatus: (id: string, status: TaskStatus) => void;
  reorderTasks: (draggedId: string, targetId: string) => void;

  // Category operations
  addCategory: (cat: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // Project operations
  addProject: (proj: Omit<Project, 'id' | 'createdAt'>) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Habit operations
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDate: (id: string, dateStr?: string) => void;

  // Focus timer operations
  focusTimer: ActiveFocusTimerState;
  startFocusTimer: () => void;
  pauseFocusTimer: () => void;
  resetFocusTimer: () => void;
  switchFocusMode: (mode: FocusModeType, customMins?: number) => void;
  setFocusTask: (taskId: string | null) => void;

  // Preferences & Data
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  resetAllData: (mode: 'sample' | 'empty') => void;
  importWorkspaceData: (jsonText: string) => void;

  // Notifications
  notifications: AppNotification[];
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  requestBrowserNotifications: () => Promise<NotificationPermission | 'unsupported'>;

  // Supabase Backend Sync
  backendSyncStatus: BackendSyncState;
  backendStatusMessage: string;
  lastSyncedAt: string | null;
  syncNowToSupabase: () => Promise<void>;
  reloadFromSupabase: () => Promise<void>;

  // Supabase Authentication
  authUser: AuthUser | null;
  authChecked: boolean;
  supabaseConfigured: boolean;
  guestMode: boolean;
  loginAccount: (input: { email: string; password: string }) => Promise<{ ok: boolean; error?: string; code?: string }>;
  signupAccount: (input: {
    fullName: string;
    email: string;
    password: string;
    roleTitle?: string;
  }) => Promise<{ ok: boolean; error?: string; code?: string; schemaWarning?: string }>;
  logoutAccount: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  updateAccountProfile: (patch: { fullName?: string; roleTitle?: string }) => Promise<{ ok: boolean; error?: string }>;
}

const FocusFlowContext = createContext<FocusFlowContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getNextRecurringDate(currentDueDate: string, recurring: RecurringSchedule): string {
  const base = currentDueDate || getTodayStr();
  if (recurring === 'daily') return addDays(base, 1);
  if (recurring === 'weekly') return addDays(base, 7);
  if (recurring === 'monthly') {
    const dt = parseLocalDate(base);
    dt.setMonth(dt.getMonth() + 1);
    return toLocalDateStr(dt);
  }
  if (recurring === 'weekdays') {
    let next = addDays(base, 1);
    while ([0, 6].includes(parseLocalDate(next).getDay())) {
      next = addDays(next, 1);
    }
    return next;
  }
  return base;
}

export const FocusFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WorkspaceState>(() => workspaceRepository.load());
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiDrawerTab, setAiDrawerTab] = useState<'plan' | 'breakdown' | 'schedule' | 'summary'>('plan');
  const [aiBreakdownTaskId, setAiBreakdownTaskId] = useState<string | null>(null);

  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    task: Task | null;
    prefillDate?: string;
    prefillTime?: string;
    prefillProjectId?: string | null;
  }>({ open: false, task: null });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);
  const focusCompletedRef = useRef<string | null>(null);

  // Auth & Supabase sync state (accessToken kept strictly in memory, never in localStorage)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean>(false);
  const [guestMode, setGuestMode] = useState<boolean>(false);
  const accessTokenRef = useRef<string | null>(null);

  const [backendSyncStatus, setBackendSyncStatus] = useState<BackendSyncState>('local');
  const [backendStatusMessage, setBackendStatusMessage] = useState<string>('Checking Supabase backend...');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const supabaseHydratedRef = useRef<boolean>(false);
  const skipNextSyncRef = useRef<boolean>(false);
  const syncTimerRef = useRef<number | null>(null);
  const profileSyncTimerRef = useRef<number | null>(null);

  // Persist state to LocalStorage immediately for zero-latency offline cache
  useEffect(() => {
    workspaceRepository.save(state);
  }, [state]);

  const hydrateUserWorkspace = useCallback(async (user: AuthUser, token: string | null, isFreshSignup = false) => {
    supabaseHydratedRef.current = false;
    setBackendSyncStatus('syncing');
    const res = await loadWorkspaceFromSupabase(token);
    supabaseHydratedRef.current = true;
    setBackendSyncStatus(res.status);
    setBackendStatusMessage(res.message);

    if (res.status === 'synced') {
      if (!res.empty && res.workspace && !isFreshSignup) {
        const mergedWorkspace: WorkspaceState = {
          ...res.workspace,
          preferences: {
            ...res.workspace.preferences,
            displayName: res.workspace.preferences.displayName || user.fullName,
            roleTitle: res.workspace.preferences.roleTitle || user.roleTitle,
            avatarUrl: res.workspace.preferences.avatarUrl || user.avatarUrl,
          },
        };
        skipNextSyncRef.current = true;
        setState(mergedWorkspace);
        setLastSyncedAt(new Date().toISOString());
      } else {
        const baseState = isFreshSignup ? workspaceRepository.reset('empty') : workspaceRepository.load();
        const initializedState: WorkspaceState = {
          ...baseState,
          preferences: {
            ...baseState.preferences,
            displayName: user.fullName,
            roleTitle: user.roleTitle || 'Personal Workspace',
            avatarUrl: user.avatarUrl || baseState.preferences.avatarUrl,
          },
        };
        skipNextSyncRef.current = true;
        setState(initializedState);
        const pushRes = await syncWorkspaceToSupabase(initializedState, token);
        setBackendSyncStatus(pushRes.status);
        setBackendStatusMessage(pushRes.message);
        if (pushRes.syncedAt) setLastSyncedAt(pushRes.syncedAt);
      }
    } else {
      setState((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          displayName: user.fullName,
          roleTitle: user.roleTitle || prev.preferences.roleTitle,
          avatarUrl: user.avatarUrl || prev.preferences.avatarUrl,
        },
      }));
    }
  }, []);

  // Initial session check & load from linked Supabase backend
  useEffect(() => {
    let active = true;
    (async () => {
      const me = await fetchCurrentUser();
      if (!active) return;
      setSupabaseConfigured(me.configured);

      if (me.authenticated && me.user) {
        setAuthUser(me.user);
        setAuthChecked(true);
        await hydrateUserWorkspace(me.user, null, false);
      } else {
        setAuthUser(null);
        setAuthChecked(true);
        supabaseHydratedRef.current = true;
        if (!me.configured) {
          setBackendSyncStatus('needs_key');
          setBackendStatusMessage('Add SUPABASE_SERVICE_ROLE_KEY in Settings > Secrets to enable cloud accounts.');
        } else {
          setBackendSyncStatus('local');
          setBackendStatusMessage('Sign in to sync your personal workspace with Supabase.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [hydrateUserWorkspace]);

  // Debounced sync to Supabase whenever persistent data changes (ignoring 1s timer countdown ticks)
  const syncFingerprint = useMemo(
    () =>
      JSON.stringify({
        tasks: state.tasks,
        categories: state.categories,
        projects: state.projects,
        habits: state.habits,
        focusSessions: state.focusSessions,
        preferences: state.preferences,
        dismissedNotificationIds: state.dismissedNotificationIds,
        timerMode: state.focusTimer.mode,
        timerStatus: state.focusTimer.status,
        timerTask: state.focusTimer.selectedTaskId,
      }),
    [
      state.tasks,
      state.categories,
      state.projects,
      state.habits,
      state.focusSessions,
      state.preferences,
      state.dismissedNotificationIds,
      state.focusTimer.mode,
      state.focusTimer.status,
      state.focusTimer.selectedTaskId,
    ]
  );

  useEffect(() => {
    if (!supabaseHydratedRef.current) return;
    if (!authUser) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    if (backendSyncStatus !== 'synced' && backendSyncStatus !== 'syncing' && backendSyncStatus !== 'error') {
      return;
    }

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(async () => {
      setBackendSyncStatus('syncing');
      const res = await syncWorkspaceToSupabase(state, accessTokenRef.current);
      setBackendSyncStatus(res.status);
      setBackendStatusMessage(res.message);
      if (res.syncedAt) setLastSyncedAt(res.syncedAt);
    }, 700);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [syncFingerprint, authUser]);

  const syncNowToSupabase = useCallback(async () => {
    setBackendSyncStatus('syncing');
    const res = await syncWorkspaceToSupabase(state, accessTokenRef.current);
    setBackendSyncStatus(res.status);
    setBackendStatusMessage(res.message);
    if (res.syncedAt) setLastSyncedAt(res.syncedAt);
  }, [state]);

  const reloadFromSupabase = useCallback(async () => {
    setBackendSyncStatus('syncing');
    const res = await loadWorkspaceFromSupabase(accessTokenRef.current);
    setBackendSyncStatus(res.status);
    setBackendStatusMessage(res.message);
    if (res.status === 'synced' && !res.empty && res.workspace) {
      skipNextSyncRef.current = true;
      setState(res.workspace);
      setLastSyncedAt(new Date().toISOString());
    }
  }, []);

  const loginAccount = useCallback(
    async (input: { email: string; password: string }) => {
      const res = await loginWithSupabase(input);
      if (!res.ok) {
        return { ok: false, error: res.error, code: res.code };
      }
      accessTokenRef.current = res.accessToken;
      setAuthUser(res.user);
      setGuestMode(false);
      setActivePage('dashboard');
      await hydrateUserWorkspace(res.user, res.accessToken, false);
      return { ok: true };
    },
    [hydrateUserWorkspace]
  );

  const signupAccount = useCallback(
    async (input: { fullName: string; email: string; password: string; roleTitle?: string }) => {
      const res = await signupWithSupabase(input);
      if (!res.ok) {
        return { ok: false, error: res.error, code: res.code };
      }
      accessTokenRef.current = res.accessToken;
      setAuthUser(res.user);
      setGuestMode(false);
      setActivePage('dashboard');
      await hydrateUserWorkspace(res.user, res.accessToken, true);
      return { ok: true, schemaWarning: res.schemaWarning };
    },
    [hydrateUserWorkspace]
  );

  const logoutAccount = useCallback(async () => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    if (profileSyncTimerRef.current) window.clearTimeout(profileSyncTimerRef.current);
    await logoutFromSupabase(accessTokenRef.current);
    accessTokenRef.current = null;
    setAuthUser(null);
    setGuestMode(false);
    setLastSyncedAt(null);
    setBackendSyncStatus(supabaseConfigured ? 'local' : 'needs_key');
    setBackendStatusMessage('Signed out.');
    const freshGuest = workspaceRepository.reset('sample');
    skipNextSyncRef.current = true;
    setState(freshGuest);
    setActivePage('dashboard');
  }, [supabaseConfigured]);

  const enterGuestMode = useCallback(() => {
    setGuestMode(true);
    setActivePage('dashboard');
  }, []);

  const exitGuestMode = useCallback(() => {
    setGuestMode(false);
  }, []);

  const updateAccountProfile = useCallback(
    async (patch: { fullName?: string; roleTitle?: string }) => {
      if (!authUser) return { ok: false, error: 'Not signed in.' };
      const res = await updateSupabaseProfile(patch, accessTokenRef.current);
      if (res.ok && res.user) {
        setAuthUser(res.user);
        return { ok: true };
      }
      return { ok: false, error: res.error };
    },
    [authUser]
  );

  // Sync theme & accent CSS variables
  useEffect(() => {
    const { theme, accent } = state.preferences;
    const applyTheme = () => {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);

      const preset = ACCENT_PRESETS[accent] ?? ACCENT_PRESETS.indigo;
      document.documentElement.style.setProperty('--accent', preset.hex);
      document.documentElement.style.setProperty('--accent-hover', preset.hoverHex);
      document.documentElement.style.setProperty('--accent-soft', isDark ? preset.softDark : preset.softLight);
      document.documentElement.style.setProperty('--accent-ring', `${preset.hex}55`);
    };

    applyTheme();
    if (theme === 'system' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', applyTheme);
      return () => mql.removeEventListener('change', applyTheme);
    }
  }, [state.preferences.theme, state.preferences.accent]);

  const showUndoToast = useCallback((message: string, onUndo: () => void) => {
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
    const id = makeId('undo');
    setUndoToast({ id, message, onUndo });
    undoTimeoutRef.current = window.setTimeout(() => {
      setUndoToast(null);
    }, 6000);
  }, []);

  const dismissUndoToast = useCallback(() => {
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
    setUndoToast(null);
  }, []);

  const requestConfirm = useCallback((opts: ConfirmOptions) => {
    setConfirmDialog(opts);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  // Global keyboard shortcuts: N, Ctrl/Cmd+K, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (confirmDialog) {
          setConfirmDialog(null);
          return;
        }
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          return;
        }
        if (quickAddOpen) {
          setQuickAddOpen(false);
          return;
        }
        if (taskModalState.open) {
          setTaskModalState({ open: false, task: null });
          return;
        }
        if (aiDrawerOpen) {
          setAiDrawerOpen(false);
          return;
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          return;
        }
      }

      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        const anyOpen = quickAddOpen || commandPaletteOpen || taskModalState.open || aiDrawerOpen || Boolean(confirmDialog);
        if (!anyOpen) {
          e.preventDefault();
          setQuickAddOpen(true);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickAddOpen, commandPaletteOpen, taskModalState.open, aiDrawerOpen, confirmDialog, mobileMenuOpen]);

  // Persistent wall-clock accurate Pomodoro timer tick
  const handleFocusCompletion = useCallback((timer: ActiveFocusTimerState, prefs: UserPreferences, tasks: Task[]) => {
    const key = `${timer.mode}-${timer.endTimestampMs}`;
    if (focusCompletedRef.current === key) return;
    focusCompletedRef.current = key;

    if (prefs.soundEnabled) {
      playFocusChime();
    }

    const selectedTask = tasks.find((t) => t.id === timer.selectedTaskId);
    const durationMins = Math.max(1, Math.round(timer.totalSeconds / 60));

    const newSession: FocusSession = {
      id: makeId('fs'),
      taskId: timer.selectedTaskId,
      taskTitle: selectedTask?.title ?? null,
      mode: timer.mode,
      durationMinutes: durationMins,
      completedAt: new Date().toISOString(),
      date: getTodayStr(),
    };

    if (prefs.notifications.focusAlerts && prefs.notifications.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Focus Flow Timer Complete', {
          body: timer.mode === 'focus' ? `Completed ${durationMins}m focus session${selectedTask ? ` on "${selectedTask.title}"` : ''}.` : 'Break complete! Ready for your next focus session.',
        });
      } catch {
        // ignore notification errors
      }
    }

    setState((prev) => {
      const nextMode: FocusModeType =
        timer.mode === 'focus' && prev.preferences.autoStartBreaks ? 'short_break' : timer.mode;
      const nextSeconds =
        nextMode === 'focus'
          ? prev.preferences.focusMinutes * 60
          : nextMode === 'short_break'
          ? prev.preferences.shortBreakMinutes * 60
          : nextMode === 'long_break'
          ? prev.preferences.longBreakMinutes * 60
          : prev.focusTimer.customMinutes * 60;

      const autoStart = timer.mode === 'focus' && prev.preferences.autoStartBreaks;
      return {
        ...prev,
        focusSessions: timer.mode === 'focus' || timer.mode === 'custom' ? [newSession, ...prev.focusSessions] : prev.focusSessions,
        focusTimer: {
          ...prev.focusTimer,
          mode: nextMode,
          status: autoStart ? 'running' : 'idle',
          totalSeconds: nextSeconds,
          remainingSeconds: nextSeconds,
          endTimestampMs: autoStart ? Date.now() + nextSeconds * 1000 : null,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (state.focusTimer.status !== 'running' || !state.focusTimer.endTimestampMs) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.focusTimer.endTimestampMs! - Date.now()) / 1000));
      if (remaining <= 0) {
        handleFocusCompletion(state.focusTimer, state.preferences, state.tasks);
      } else if (remaining !== state.focusTimer.remainingSeconds) {
        setState((prev) => ({
          ...prev,
          focusTimer: {
            ...prev.focusTimer,
            remainingSeconds: remaining,
          },
        }));
      }
    };

    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [state.focusTimer.status, state.focusTimer.endTimestampMs, state.focusTimer.remainingSeconds, handleFocusCompletion, state.preferences, state.tasks]);

  // Task operations
  const addTask = useCallback((input: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'order'>): Task => {
    const newTask: Task = {
      ...input,
      id: makeId('task'),
      order: Date.now(),
      createdAt: new Date().toISOString(),
      completedAt: input.status === 'completed' ? new Date().toISOString() : null,
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
    return newTask;
  }, []);

  const addManyTasks = useCallback((inputs: Array<Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'order'>>) => {
    const baseOrder = Date.now();
    const created: Task[] = inputs.map((input, idx) => ({
      ...input,
      id: makeId('task'),
      order: baseOrder + idx,
      createdAt: new Date().toISOString(),
      completedAt: input.status === 'completed' ? new Date().toISOString() : null,
    }));
    setState((prev) => ({
      ...prev,
      tasks: [...created, ...prev.tasks],
    }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== id) return t;
        const nextStatus = patch.status ?? t.status;
        const completedAt =
          patch.status === 'completed' && t.status !== 'completed'
            ? new Date().toISOString()
            : patch.status && patch.status !== 'completed'
            ? null
            : t.completedAt;
        return { ...t, ...patch, status: nextStatus, completedAt };
      }),
    }));
  }, []);

  const deleteTask = useCallback(
    (id: string) => {
      const target = state.tasks.find((t) => t.id === id);
      if (!target) return;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }));
      showUndoToast(`Deleted "${target.title}"`, () => {
        setState((prev) => ({
          ...prev,
          tasks: [target, ...prev.tasks],
        }));
      });
    },
    [state.tasks, showUndoToast]
  );

  const duplicateTask = useCallback((id: string) => {
    setState((prev) => {
      const original = prev.tasks.find((t) => t.id === id);
      if (!original) return prev;
      const copy: Task = {
        ...original,
        id: makeId('task'),
        title: `${original.title} (Copy)`,
        status: 'todo',
        completedAt: null,
        createdAt: new Date().toISOString(),
        order: Date.now(),
        subtasks: original.subtasks.map((s) => ({ ...s, id: makeId('st'), completed: false })),
      };
      return { ...prev, tasks: [copy, ...prev.tasks] };
    });
  }, []);

  const toggleTaskCompletion = useCallback(
    (id: string) => {
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) return;

      const completing = existing.status !== 'completed';
      let spawnedId: string | null = null;

      setState((prev) => {
        const updatedTasks = prev.tasks.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            status: completing ? ('completed' as TaskStatus) : ('todo' as TaskStatus),
            completedAt: completing ? new Date().toISOString() : null,
          };
        });

        if (completing && existing.recurring !== 'none') {
          const nextDue = getNextRecurringDate(existing.dueDate, existing.recurring);
          const nextTask: Task = {
            ...existing,
            id: makeId('task'),
            dueDate: nextDue,
            status: 'todo',
            completedAt: null,
            createdAt: new Date().toISOString(),
            order: Date.now(),
            subtasks: existing.subtasks.map((s) => ({ ...s, id: makeId('st'), completed: false })),
          };
          spawnedId = nextTask.id;
          return { ...prev, tasks: [nextTask, ...updatedTasks] };
        }
        return { ...prev, tasks: updatedTasks };
      });

      if (completing) {
        showUndoToast(`Completed "${existing.title}"`, () => {
          setState((prev) => ({
            ...prev,
            tasks: prev.tasks
              .filter((t) => t.id !== spawnedId)
              .map((t) =>
                t.id === id ? { ...t, status: existing.status, completedAt: existing.completedAt } : t
              ),
          }));
        });
      }
    },
    [state.tasks, showUndoToast]
  );

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s)),
            }
          : t
      ),
    }));
  }, []);

  const moveTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status,
          completedAt: status === 'completed' ? new Date().toISOString() : null,
        };
      }),
    }));
  }, []);

  const reorderTasks = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setState((prev) => {
      const list = [...prev.tasks];
      const fromIdx = list.findIndex((t) => t.id === draggedId);
      const toIdx = list.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return {
        ...prev,
        tasks: list.map((t, idx) => ({ ...t, order: idx + 1 })),
      };
    });
  }, []);

  // Category operations
  const addCategory = useCallback((cat: Omit<Category, 'id'>): Category => {
    const newCat: Category = { ...cat, id: makeId('cat') };
    setState((prev) => ({ ...prev, categories: [...prev.categories, newCat] }));
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, patch: Partial<Category>) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setState((prev) => {
      const remaining = prev.categories.filter((c) => c.id !== id);
      const fallbackId = remaining[0]?.id ?? 'cat-personal';
      return {
        ...prev,
        categories: remaining,
        tasks: prev.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: fallbackId } : t)),
      };
    });
  }, []);

  // Project operations
  const addProject = useCallback((proj: Omit<Project, 'id' | 'createdAt'>): Project => {
    const created: Project = { ...proj, id: makeId('proj'), createdAt: new Date().toISOString() };
    setState((prev) => ({ ...prev, projects: [created, ...prev.projects] }));
    return created;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const deleteProject = useCallback(
    (id: string) => {
      const target = state.projects.find((p) => p.id === id);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        tasks: prev.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
      }));
      if (selectedProjectId === id) setSelectedProjectId(null);
      if (target) {
        showUndoToast(`Deleted project "${target.name}"`, () => {
          setState((prev) => ({ ...prev, projects: [target, ...prev.projects] }));
        });
      }
    },
    [state.projects, selectedProjectId, showUndoToast]
  );

  // Habit operations
  const addHabit = useCallback((habit: Omit<Habit, 'id' | 'createdAt' | 'completedDates'>): Habit => {
    const created: Habit = {
      ...habit,
      id: makeId('hab'),
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, habits: [...prev.habits, created] }));
    return created;
  }, []);

  const updateHabit = useCallback((id: string, patch: Partial<Habit>) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== id),
    }));
  }, []);

  const toggleHabitDate = useCallback((id: string, dateStr: string = getTodayStr()) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== id) return h;
        const exists = h.completedDates.includes(dateStr);
        return {
          ...h,
          completedDates: exists
            ? h.completedDates.filter((d) => d !== dateStr)
            : [...h.completedDates, dateStr],
        };
      }),
    }));
  }, []);

  // Focus timer controls
  const startFocusTimer = useCallback(() => {
    setState((prev) => {
      const remaining = Math.max(1, prev.focusTimer.remainingSeconds);
      return {
        ...prev,
        focusTimer: {
          ...prev.focusTimer,
          status: 'running',
          endTimestampMs: Date.now() + remaining * 1000,
        },
      };
    });
  }, []);

  const pauseFocusTimer = useCallback(() => {
    setState((prev) => {
      const remaining = prev.focusTimer.endTimestampMs
        ? Math.max(0, Math.ceil((prev.focusTimer.endTimestampMs - Date.now()) / 1000))
        : prev.focusTimer.remainingSeconds;
      return {
        ...prev,
        focusTimer: {
          ...prev.focusTimer,
          status: 'paused',
          remainingSeconds: remaining,
          endTimestampMs: null,
        },
      };
    });
  }, []);

  const resetFocusTimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      focusTimer: {
        ...prev.focusTimer,
        status: 'idle',
        remainingSeconds: prev.focusTimer.totalSeconds,
        endTimestampMs: null,
      },
    }));
  }, []);

  const switchFocusMode = useCallback((mode: FocusModeType, customMins?: number) => {
    setState((prev) => {
      const cMins = customMins ?? prev.focusTimer.customMinutes;
      const mins =
        mode === 'focus'
          ? prev.preferences.focusMinutes
          : mode === 'short_break'
          ? prev.preferences.shortBreakMinutes
          : mode === 'long_break'
          ? prev.preferences.longBreakMinutes
          : cMins;
      const totalSeconds = Math.max(1, mins) * 60;
      return {
        ...prev,
        focusTimer: {
          ...prev.focusTimer,
          mode,
          status: 'idle',
          totalSeconds,
          remainingSeconds: totalSeconds,
          endTimestampMs: null,
          customMinutes: cMins,
        },
      };
    });
  }, []);

  const setFocusTask = useCallback((taskId: string | null) => {
    setState((prev) => ({
      ...prev,
      focusTimer: {
        ...prev.focusTimer,
        selectedTaskId: taskId,
      },
    }));
  }, []);

  // Preferences & Data
  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      setState((prev) => {
        const nextPrefs = {
          ...prev.preferences,
          ...patch,
          notifications: {
            ...prev.preferences.notifications,
            ...(patch.notifications ?? {}),
          },
        };
        // If idle, sync default focus timer duration when focusMinutes changes
        let nextTimer = prev.focusTimer;
        if (prev.focusTimer.status === 'idle') {
          const mins =
            prev.focusTimer.mode === 'focus'
              ? nextPrefs.focusMinutes
              : prev.focusTimer.mode === 'short_break'
              ? nextPrefs.shortBreakMinutes
              : prev.focusTimer.mode === 'long_break'
              ? nextPrefs.longBreakMinutes
              : prev.focusTimer.customMinutes;
          nextTimer = {
            ...prev.focusTimer,
            totalSeconds: mins * 60,
            remainingSeconds: mins * 60,
          };
        }
        return {
          ...prev,
          preferences: nextPrefs,
          focusTimer: nextTimer,
        };
      });

      if (authUser && (patch.displayName !== undefined || patch.roleTitle !== undefined || patch.avatarUrl !== undefined)) {
        if (profileSyncTimerRef.current) window.clearTimeout(profileSyncTimerRef.current);
        profileSyncTimerRef.current = window.setTimeout(async () => {
          const res = await updateSupabaseProfile(
            {
              fullName: patch.displayName,
              roleTitle: patch.roleTitle,
              avatarUrl: patch.avatarUrl,
            },
            accessTokenRef.current
          );
          if (res.ok && res.user) {
            setAuthUser(res.user);
          }
        }, 650);
      }
    },
    [authUser]
  );

  const resetAllData = useCallback((mode: 'sample' | 'empty') => {
    const fresh = workspaceRepository.reset(mode);
    setState(fresh);
    setSelectedProjectId(null);
  }, []);

  const importWorkspaceData = useCallback((jsonText: string) => {
    const imported = workspaceRepository.parseImportedJSON(jsonText);
    workspaceRepository.save(imported);
    setState(imported);
  }, []);

  // Modals
  const openCreateTaskModal = useCallback(
    (prefill?: { date?: string; time?: string; projectId?: string | null }) => {
      setTaskModalState({
        open: true,
        task: null,
        prefillDate: prefill?.date,
        prefillTime: prefill?.time,
        prefillProjectId: prefill?.projectId,
      });
    },
    []
  );

  const openEditTaskModal = useCallback((task: Task) => {
    setTaskModalState({ open: true, task });
  }, []);

  const closeTaskModal = useCallback(() => {
    setTaskModalState({ open: false, task: null });
  }, []);

  // Computed notifications derived from real workspace state
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const today = getTodayStr();
    const { notifications: notifPrefs } = state.preferences;

    if (notifPrefs.overdueAlerts) {
      const overdueTasks = state.tasks.filter((t) => isTaskOverdue(t));
      if (overdueTasks.length > 0) {
        list.push({
          id: `overdue-${today}-${overdueTasks.length}`,
          type: 'overdue',
          title: `${overdueTasks.length} overdue ${overdueTasks.length === 1 ? 'task' : 'tasks'}`,
          message: `Needs attention: "${overdueTasks[0].title}"${overdueTasks.length > 1 ? ` +${overdueTasks.length - 1} more` : ''}.`,
          timestamp: 'Action required',
          actionPage: 'all-tasks',
        });
      }
    }

    if (notifPrefs.deadlineReminders) {
      const dueSoon = state.tasks.filter((t) => isTaskDueSoon(t));
      dueSoon.slice(0, 3).forEach((t) => {
        list.push({
          id: `deadline-${t.id}-${today}`,
          type: 'deadline',
          title: 'Upcoming deadline today',
          message: `"${t.title}"${t.dueTime ? ` at ${t.dueTime}` : ''}`,
          timestamp: 'Today',
          actionPage: 'today',
        });
      });
    }

    if (notifPrefs.habitReminders) {
      const pendingHabits = state.habits.filter(
        (h) => isHabitScheduledForDate(h, today) && !h.completedDates.includes(today)
      );
      if (pendingHabits.length > 0) {
        list.push({
          id: `habits-${today}-${pendingHabits.length}`,
          type: 'habit',
          title: `${pendingHabits.length} daily ${pendingHabits.length === 1 ? 'habit' : 'habits'} remaining`,
          message: `Check off ${pendingHabits.slice(0, 2).map((h) => h.name).join(', ')} to protect your streak.`,
          timestamp: 'Today',
          actionPage: 'habits',
        });
      }
    }

    if (notifPrefs.dailySummary) {
      const todayTasks = state.tasks.filter((t) => t.dueDate === today);
      const completedToday = todayTasks.filter((t) => t.status === 'completed').length;
      if (todayTasks.length > 0) {
        list.push({
          id: `summary-${today}-${completedToday}-${todayTasks.length}`,
          type: 'summary',
          title: 'Daily task summary',
          message: `${completedToday} of ${todayTasks.length} tasks due today completed.`,
          timestamp: 'Today',
          actionPage: 'dashboard',
        });
      }
    }

    return list.filter((n) => !state.dismissedNotificationIds.includes(n.id));
  }, [state.tasks, state.habits, state.preferences, state.dismissedNotificationIds]);

  const dismissNotification = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      dismissedNotificationIds: [...prev.dismissedNotificationIds, id],
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissedNotificationIds: [
        ...new Set([...prev.dismissedNotificationIds, ...notifications.map((n) => n.id)]),
      ],
    }));
  }, [notifications]);

  const requestBrowserNotifications = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    const perm = await Notification.requestPermission();
    updatePreferences({
      notifications: {
        ...state.preferences.notifications,
        browserNotifications: perm === 'granted',
      },
    });
    return perm;
  }, [state.preferences.notifications, updatePreferences]);

  return (
    <FocusFlowContext.Provider
      value={{
        state,
        activePage,
        setActivePage,
        selectedProjectId,
        setSelectedProjectId,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileMenuOpen,
        setMobileMenuOpen,
        quickAddOpen,
        setQuickAddOpen,
        commandPaletteOpen,
        setCommandPaletteOpen,
        aiDrawerOpen,
        setAiDrawerOpen,
        aiDrawerTab,
        setAiDrawerTab,
        aiBreakdownTaskId,
        setAiBreakdownTaskId,
        taskModalState,
        openCreateTaskModal,
        openEditTaskModal,
        closeTaskModal,
        confirmDialog,
        requestConfirm,
        closeConfirm,
        undoToast,
        dismissUndoToast,
        addTask,
        addManyTasks,
        updateTask,
        deleteTask,
        duplicateTask,
        toggleTaskCompletion,
        toggleSubtask,
        moveTaskStatus,
        reorderTasks,
        addCategory,
        updateCategory,
        deleteCategory,
        addProject,
        updateProject,
        deleteProject,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitDate,
        focusTimer: state.focusTimer,
        startFocusTimer,
        pauseFocusTimer,
        resetFocusTimer,
        switchFocusMode,
        setFocusTask,
        updatePreferences,
        resetAllData,
        importWorkspaceData,
        notifications,
        dismissNotification,
        clearAllNotifications,
        requestBrowserNotifications,
        backendSyncStatus,
        backendStatusMessage,
        lastSyncedAt,
        syncNowToSupabase,
        reloadFromSupabase,
        authUser,
        authChecked,
        supabaseConfigured,
        guestMode,
        loginAccount,
        signupAccount,
        logoutAccount,
        enterGuestMode,
        exitGuestMode,
        updateAccountProfile,
      }}
    >
      {children}
    </FocusFlowContext.Provider>
  );
};

export function useFocusFlow(): FocusFlowContextValue {
  const ctx = useContext(FocusFlowContext);
  if (!ctx) throw new Error('useFocusFlow must be used inside FocusFlowProvider');
  return ctx;
}
