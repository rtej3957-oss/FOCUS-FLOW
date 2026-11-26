import React, { useRef, useState } from 'react';
import { Check, Copy, Database, Download, LogIn, LogOut, Plus, RefreshCw, RotateCcw, Trash2, Upload, UserCheck } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { useFocusFlow } from '../context/FocusFlowContext';
import { workspaceRepository } from '../storage/repository';
import { DEFAULT_AVATAR_URL } from '../storage/seed';
import { AccentPreset, TaskPriority, ThemeMode } from '../types';
import { ACCENT_PRESETS, CATEGORY_ICON_OPTIONS, COLOR_PALETTE } from '../utils/constants';

const SUPABASE_SCHEMA_SQL = `-- Focus Flow Supabase PostgreSQL Schema
create table if not exists public.ff_accounts (
  id text primary key,
  email text unique not null,
  full_name text not null,
  role_title text not null default 'Personal Workspace',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);
create table if not exists public.ff_categories (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  color text not null,
  icon text not null,
  is_default boolean not null default false
);
create table if not exists public.ff_projects (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  description text not null default '',
  deadline text not null default '',
  color text not null default '#5E6AD2',
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create table if not exists public.ff_tasks (
  id text primary key,
  workspace_id text not null default 'default',
  title text not null,
  description text not null default '',
  due_date text not null default '',
  due_time text not null default '',
  priority text not null default 'medium',
  category_id text not null default 'cat-personal',
  project_id text,
  status text not null default 'todo',
  subtasks jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null default 30,
  recurring text not null default 'none',
  notes text not null default '',
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.ff_habits (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  description text not null default '',
  color text not null default '#0D9488',
  icon text not null default 'Flame',
  schedule_type text not null default 'daily',
  target_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
  completed_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.ff_focus_sessions (
  id text primary key,
  workspace_id text not null default 'default',
  task_id text,
  task_title text,
  mode text not null default 'focus',
  duration_minutes integer not null default 25,
  completed_at timestamptz not null default now(),
  session_date text not null
);
create table if not exists public.ff_preferences (
  workspace_id text primary key,
  preferences jsonb not null default '{}'::jsonb,
  focus_timer jsonb not null default '{}'::jsonb,
  dismissed_notification_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists idx_ff_accounts_email on public.ff_accounts (email);
alter table public.ff_accounts enable row level security;
alter table public.ff_categories enable row level security;
alter table public.ff_projects enable row level security;
alter table public.ff_tasks enable row level security;
alter table public.ff_habits enable row level security;
alter table public.ff_focus_sessions enable row level security;
alter table public.ff_preferences enable row level security;

drop policy if exists "ff_accounts_own_all" on public.ff_accounts;
create policy "ff_accounts_own_all" on public.ff_accounts for all to authenticated using (auth.uid()::text = id) with check (auth.uid()::text = id);
drop policy if exists "ff_categories_own_all" on public.ff_categories;
create policy "ff_categories_own_all" on public.ff_categories for all to authenticated using (auth.uid()::text = workspace_id) with check (auth.uid()::text = workspace_id);
drop policy if exists "ff_projects_own_all" on public.ff_projects;
create policy "ff_projects_own_all" on public.ff_projects for all to authenticated using (auth.uid()::text = workspace_id) with check (auth.uid()::text = workspace_id);
drop policy if exists "ff_tasks_own_all" on public.ff_tasks;
create policy "ff_tasks_own_all" on public.ff_tasks for all to authenticated using (auth.uid()::text = workspace_id) with check (auth.uid()::text = workspace_id);
drop policy if exists "ff_habits_own_all" on public.ff_habits;
create policy "ff_habits_own_all" on public.ff_habits for all to authenticated using (auth.uid()::text = workspace_id) with check (auth.uid()::text = workspace_id);
drop policy if exists "ff_focus_sessions_own_all" on public.ff_focus_sessions;
create policy "ff_focus_sessions_own_all" on public.ff_focus_sessions for all to authenticated using (auth.uid()::text = workspace_id) with check (auth.uid()::text = workspace_id);
drop policy if exists "ff_preferences_own_all" on public.ff_preferences;
create policy "ff_preferences_own_all" on public.ff_preferences for all to authenticated using (auth.uid()::text = workspace_id) with check (auth.uid()::text = workspace_id);`;

export const SettingsPage: React.FC = () => {
  const {
    state,
    updatePreferences,
    addCategory,
    deleteCategory,
    resetAllData,
    importWorkspaceData,
    requestConfirm,
    requestBrowserNotifications,
    backendSyncStatus,
    backendStatusMessage,
    lastSyncedAt,
    syncNowToSupabase,
    reloadFromSupabase,
    authUser,
    logoutAccount,
    exitGuestMode,
  } = useFocusFlow();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(COLOR_PALETTE[0]);
  const [catIcon, setCatIcon] = useState<string>('Layers');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importWorkspaceData(text);
      setStatusMsg({ type: 'ok', text: 'Workspace data imported successfully.' });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not import JSON file.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    addCategory({
      name: catName.trim(),
      color: catColor,
      icon: catIcon,
      isDefault: false,
    });
    setCatName('');
  };

  return (
    <div className="mx-auto max-w-[960px] space-y-6 pb-10">
      <div>
        <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Customize your profile, appearance, categories, timer defaults, and local data backup.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Supabase Account */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <UserCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Account
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {authUser
                  ? `Signed in as ${authUser.email} — account details stored in Supabase ff_accounts.`
                  : 'Currently using Local Guest Mode. Sign in or create an account to save details in Supabase.'}
              </p>
            </div>
          </div>

          {authUser ? (
            <button
              type="button"
              onClick={() => void logoutAccount()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={exitGuestMode}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In / Create Account
            </button>
          )}
        </div>

        {authUser && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-zinc-100 dark:border-[#232530] pt-4 text-xs">
            <div>
              <p className="text-zinc-400 dark:text-zinc-500">Email</p>
              <p className="mt-0.5 font-medium text-zinc-800 dark:text-zinc-200 truncate">{authUser.email}</p>
            </div>
            <div>
              <p className="text-zinc-400 dark:text-zinc-500">Account ID</p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate">{authUser.id}</p>
            </div>
            <div>
              <p className="text-zinc-400 dark:text-zinc-500">Member Since</p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                {new Date(authUser.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Profile Customization */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-4">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">Profile</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <img
            src={state.preferences.avatarUrl || DEFAULT_AVATAR_URL}
            alt={state.preferences.displayName}
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={state.preferences.displayName}
                onChange={(e) => updatePreferences({ displayName: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Role / Focus Subtitle
              </label>
              <input
                type="text"
                value={state.preferences.roleTitle}
                onChange={(e) => updatePreferences({ roleTitle: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Appearance & Accent Color */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-5">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h3>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Theme Mode</label>
          <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-[#1E2028] p-1">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updatePreferences({ theme: t })}
                className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                  state.preferences.theme === t
                    ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Accent Color</label>
          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(ACCENT_PRESETS) as AccentPreset[]).map((key) => {
              const preset = ACCENT_PRESETS[key];
              const active = state.preferences.accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => updatePreferences({ accent: key })}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                      : 'border-zinc-200 dark:border-[#2A2D39] text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.hex }} />
                  <span>{preset.label}</span>
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Task & Focus Preferences */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-5">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Tasks &amp; Focus Timer Defaults
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Default Priority
            </label>
            <select
              value={state.preferences.defaultPriority}
              onChange={(e) => updatePreferences({ defaultPriority: e.target.value as TaskPriority })}
              className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Focus (min)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={state.preferences.focusMinutes}
              onChange={(e) => updatePreferences({ focusMinutes: Math.max(5, Number(e.target.value) || 25) })}
              className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 font-mono text-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Short Break (min)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={state.preferences.shortBreakMinutes}
              onChange={(e) => updatePreferences({ shortBreakMinutes: Math.max(1, Number(e.target.value) || 5) })}
              className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 font-mono text-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Long Break (min)
            </label>
            <input
              type="number"
              min={5}
              max={60}
              value={state.preferences.longBreakMinutes}
              onChange={(e) => updatePreferences({ longBreakMinutes: Math.max(5, Number(e.target.value) || 15) })}
              className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 font-mono text-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={state.preferences.soundEnabled}
              onChange={(e) => updatePreferences({ soundEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-[var(--accent)]"
            />
            Play chime sound when focus session ends
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={state.preferences.autoStartBreaks}
              onChange={(e) => updatePreferences({ autoStartBreaks: e.target.checked })}
              className="h-4 w-4 rounded accent-[var(--accent)]"
            />
            Auto-start short break after focus session
          </label>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Alerts appear in-app while Focus Flow is open. Optional browser notifications require your permission.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await requestBrowserNotifications();
              setStatusMsg({
                type: res === 'granted' ? 'ok' : 'err',
                text:
                  res === 'granted'
                    ? 'Browser notifications enabled.'
                    : 'Browser notifications were not enabled.',
              });
            }}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)]"
          >
            Request Browser Permission
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { key: 'deadlineReminders', label: 'Upcoming deadline reminders' },
            { key: 'overdueAlerts', label: 'Overdue task alerts' },
            { key: 'dailySummary', label: 'Daily task summary' },
            { key: 'habitReminders', label: 'Habit check-in reminders' },
            { key: 'focusAlerts', label: 'Focus session completion alerts' },
          ].map((item) => {
            const k = item.key as keyof typeof state.preferences.notifications;
            return (
              <label key={item.key} className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.preferences.notifications[k]}
                  onChange={(e) =>
                    updatePreferences({
                      notifications: {
                        ...state.preferences.notifications,
                        [k]: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded accent-[var(--accent)]"
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Custom Categories Manager */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-4">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Task Categories
        </h3>

        <div className="flex flex-wrap gap-2">
          {state.categories.map((cat) => (
            <div
              key={cat.id}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#262832] px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200"
            >
              <CategoryIcon name={cat.icon} className="h-3.5 w-3.5" style={{ color: cat.color }} />
              <span>{cat.name}</span>
              {!cat.isDefault && (
                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  className="ml-1 text-zinc-400 hover:text-red-500"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateCategory} className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-[#232530]">
          <input
            type="text"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="New category name"
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
          />
          <select
            value={catIcon}
            onChange={(e) => setCatIcon(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200"
          >
            {CATEGORY_ICON_OPTIONS.map((ic) => (
              <option key={ic} value={ic}>
                {ic}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            {COLOR_PALETTE.slice(0, 6).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatColor(c)}
                className={`h-5 w-5 rounded-full ${catColor === c ? 'ring-2 ring-zinc-400' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Category color ${c}`}
              />
            ))}
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        </form>
      </section>

      {/* Export, Import & Reset */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-4">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Data Backup &amp; Reset
        </h3>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() =>
              handleDownload(
                workspaceRepository.exportJSON(state),
                `focus-flow-backup-${new Date().toISOString().slice(0, 10)}.json`,
                'application/json'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={() =>
              handleDownload(
                workspaceRepository.exportTasksCSV(state.tasks, state.categories),
                `focus-flow-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
                'text/csv'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export Tasks CSV
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Upload className="h-3.5 w-3.5" />
            Import JSON Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 border-t border-zinc-100 dark:border-[#232530] pt-4">
          <button
            type="button"
            onClick={() =>
              requestConfirm({
                title: 'Restore sample workspace?',
                message: 'This replaces your current tasks, projects, habits, and focus logs with the starter workspace.',
                confirmLabel: 'Restore Sample Data',
                destructive: true,
                onConfirm: () => {
                  resetAllData('sample');
                  setStatusMsg({ type: 'ok', text: 'Restored sample workspace.' });
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Sample Data
          </button>

          <button
            type="button"
            onClick={() =>
              requestConfirm({
                title: 'Clear all application data?',
                message: 'All tasks, projects, habits, and focus session logs will be permanently deleted from LocalStorage and synced storage.',
                confirmLabel: 'Clear Everything',
                destructive: true,
                onConfirm: () => {
                  resetAllData('empty');
                  setStatusMsg({ type: 'ok', text: 'Cleared all workspace data.' });
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset All Data (Empty)
          </button>
        </div>
      </section>

      {/* Supabase Cloud Backend */}
      <section className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <Database className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Supabase Backend
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Linked project <span className="font-mono text-zinc-700 dark:text-zinc-300">exsuwvqxvxihrkzuahmd</span>
                {' · '}
                <span>{backendStatusMessage}</span>
              </p>
              {lastSyncedAt && (
                <p className="mt-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          <span
            className={`text-xs font-medium ${
              backendSyncStatus === 'synced'
                ? 'text-emerald-600 dark:text-emerald-400'
                : backendSyncStatus === 'syncing'
                ? 'text-[var(--accent)]'
                : backendSyncStatus === 'needs_key' || backendSyncStatus === 'needs_schema'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500'
            }`}
          >
            {backendSyncStatus === 'synced'
              ? 'Connected'
              : backendSyncStatus === 'syncing'
              ? 'Syncing...'
              : backendSyncStatus === 'needs_key'
              ? 'Needs Secret Key'
              : backendSyncStatus === 'needs_schema'
              ? 'Schema Needed'
              : 'Local Fallback'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={syncNowToSupabase}
            disabled={backendSyncStatus === 'syncing'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${backendSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            Sync to Supabase
          </button>

          <button
            type="button"
            onClick={reloadFromSupabase}
            disabled={backendSyncStatus === 'syncing'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] disabled:opacity-50"
          >
            Pull from Supabase
          </button>

          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL);
              setCopiedSql(true);
              setTimeout(() => setCopiedSql(false), 2500);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)]"
          >
            {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedSql ? 'SQL Schema Copied' : 'Copy Supabase SQL Schema'}
          </button>
        </div>

        {(backendSyncStatus === 'needs_key' || backendSyncStatus === 'needs_schema') && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-[#232530] pt-3">
            {backendSyncStatus === 'needs_key'
              ? 'To finish connecting, add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in AI Studio Settings > Secrets, and run supabase/schema.sql in your Supabase SQL Editor.'
              : 'Your Supabase key is connected. Copy and run the SQL schema above in your Supabase SQL Editor, then click Sync to Supabase.'}
          </p>
        )}
      </section>
    </div>
  );
};
