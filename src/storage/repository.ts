import { Category, Task, WorkspaceState } from '../types';
import { createEmptyWorkspaceState, createInitialSeedWorkspaceState, DEFAULT_CATEGORIES, DEFAULT_PREFERENCES } from './seed';

const STORAGE_KEY = 'focusflow_data_v1';

/**
 * StorageAdapter interface designed so LocalStorage can later be swapped
 * for Supabase or Firebase without rebuilding UI components.
 */
export interface WorkspaceRepository {
  load(): WorkspaceState;
  save(state: WorkspaceState): void;
  hydrate(partial: Partial<WorkspaceState>): WorkspaceState;
  reset(mode: 'sample' | 'empty'): WorkspaceState;
  exportJSON(state: WorkspaceState): string;
  exportTasksCSV(tasks: Task[], categories: Category[]): string;
  parseImportedJSON(rawJson: string): WorkspaceState;
}

class LocalStorageWorkspaceRepository implements WorkspaceRepository {
  load(): WorkspaceState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = createInitialSeedWorkspaceState();
        this.save(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
      return this.hydrate(parsed);
    } catch {
      const seeded = createInitialSeedWorkspaceState();
      return seeded;
    }
  }

  save(state: WorkspaceState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Handle storage quota edge cases gracefully
    }
  }

  reset(mode: 'sample' | 'empty'): WorkspaceState {
    const next = mode === 'sample' ? createInitialSeedWorkspaceState() : createEmptyWorkspaceState();
    this.save(next);
    return next;
  }

  exportJSON(state: WorkspaceState): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'Focus Flow',
        ...state,
      },
      null,
      2
    );
  }

  exportTasksCSV(tasks: Task[], categories: Category[]): string {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const headers = [
      'ID',
      'Title',
      'Description',
      'Status',
      'Priority',
      'Category',
      'Due Date',
      'Due Time',
      'Estimated Minutes',
      'Recurring',
      'Tags',
      'Completed At',
    ];
    const rows = tasks.map((t) => [
      escapeCell(t.id),
      escapeCell(t.title),
      escapeCell(t.description),
      escapeCell(t.status),
      escapeCell(t.priority),
      escapeCell(catMap.get(t.categoryId) ?? 'Personal'),
      escapeCell(t.dueDate),
      escapeCell(t.dueTime),
      String(t.estimatedMinutes),
      escapeCell(t.recurring),
      escapeCell(t.tags.join('; ')),
      escapeCell(t.completedAt ?? ''),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  parseImportedJSON(rawJson: string): WorkspaceState {
    const parsed = JSON.parse(rawJson) as Partial<WorkspaceState>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
      throw new Error('Invalid Focus Flow backup file: missing tasks array.');
    }
    return this.hydrate(parsed);
  }

  hydrate(partial: Partial<WorkspaceState>): WorkspaceState {
    const base = createEmptyWorkspaceState();
    return {
      version: 1,
      tasks: Array.isArray(partial.tasks) ? partial.tasks : [],
      categories:
        Array.isArray(partial.categories) && partial.categories.length > 0
          ? partial.categories
          : DEFAULT_CATEGORIES,
      projects: Array.isArray(partial.projects) ? partial.projects : [],
      habits: Array.isArray(partial.habits) ? partial.habits : [],
      focusSessions: Array.isArray(partial.focusSessions) ? partial.focusSessions : [],
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(partial.preferences ?? {}),
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          ...(partial.preferences?.notifications ?? {}),
        },
      },
      focusTimer: {
        ...base.focusTimer,
        ...(partial.focusTimer ?? {}),
      },
      dismissedNotificationIds: Array.isArray(partial.dismissedNotificationIds)
        ? partial.dismissedNotificationIds
        : [],
    };
  }
}

export const workspaceRepository: WorkspaceRepository = new LocalStorageWorkspaceRepository();
