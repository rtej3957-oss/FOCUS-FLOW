export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export type KanbanColumnId = 'todo' | 'in_progress' | 'completed' | 'overdue';

export type RecurringSchedule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentPreset = 'indigo' | 'violet' | 'cobalt' | 'emerald' | 'rose';

export type NavPage =
  | 'dashboard'
  | 'today'
  | 'upcoming'
  | 'all-tasks'
  | 'calendar'
  | 'projects'
  | 'habits'
  | 'focus'
  | 'analytics'
  | 'completed'
  | 'settings';

export type TaskViewMode = 'list' | 'kanban' | 'calendar';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD or ''
  dueTime: string; // HH:MM (24h) or ''
  priority: TaskPriority;
  categoryId: string;
  projectId: string | null;
  status: TaskStatus;
  subtasks: Subtask[];
  tags: string[];
  estimatedMinutes: number;
  recurring: RecurringSchedule;
  notes: string;
  order: number;
  createdAt: string;
  completedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string; // hex
  icon: string; // lucide icon name key
  isDefault?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  deadline: string; // YYYY-MM-DD or ''
  color: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  scheduleType: 'daily' | 'weekdays' | 'custom';
  targetDays: number[]; // 0 (Sun) - 6 (Sat)
  completedDates: string[]; // YYYY-MM-DD[]
  createdAt: string;
}

export type FocusModeType = 'focus' | 'short_break' | 'long_break' | 'custom';

export interface FocusSession {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  mode: FocusModeType;
  durationMinutes: number;
  completedAt: string; // ISO
  date: string; // YYYY-MM-DD
}

export interface ProductivityDay {
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  focusMinutes: number;
  habitsCompleted: number;
}

export interface UserPreferences {
  displayName: string;
  roleTitle: string;
  avatarUrl: string;
  theme: ThemeMode;
  accent: AccentPreset;
  defaultPriority: TaskPriority;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  soundEnabled: boolean;
  autoStartBreaks: boolean;
  notifications: {
    deadlineReminders: boolean;
    overdueAlerts: boolean;
    dailySummary: boolean;
    habitReminders: boolean;
    focusAlerts: boolean;
    browserNotifications: boolean;
  };
}

export interface ActiveFocusTimerState {
  mode: FocusModeType;
  status: 'idle' | 'running' | 'paused';
  totalSeconds: number;
  remainingSeconds: number;
  endTimestampMs: number | null;
  selectedTaskId: string | null;
  customMinutes: number;
}

export interface WorkspaceState {
  version: number;
  tasks: Task[];
  categories: Category[];
  projects: Project[];
  habits: Habit[];
  focusSessions: FocusSession[];
  preferences: UserPreferences;
  focusTimer: ActiveFocusTimerState;
  dismissedNotificationIds: string[];
}

export interface AppNotification {
  id: string;
  type: 'overdue' | 'deadline' | 'habit' | 'summary' | 'focus';
  title: string;
  message: string;
  timestamp: string;
  actionPage?: NavPage;
}

export interface AiSuggestedTask {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: TaskPriority;
  category: string;
  estimatedMinutes: number;
  subtasks: string[];
  tags: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleTitle: string;
  avatarUrl: string;
  createdAt: string;
  lastLoginAt: string;
}

