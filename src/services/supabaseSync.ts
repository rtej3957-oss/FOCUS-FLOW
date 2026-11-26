import { workspaceRepository } from '../storage/repository';
import { WorkspaceState } from '../types';

export type BackendSyncState = 'local' | 'syncing' | 'synced' | 'needs_key' | 'needs_schema' | 'error';

export interface SupabaseStatusInfo {
  configured: boolean;
  schemaReady: boolean;
  projectRef: string;
  supabaseUrl: string;
  code?: string;
  message: string;
}

export interface WorkspaceLoadResult {
  status: BackendSyncState;
  empty: boolean;
  workspace: WorkspaceState | null;
  message: string;
}

function buildHeaders(accessToken?: string | null, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'FocusFlow',
  };
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function fetchSupabaseStatus(): Promise<SupabaseStatusInfo> {
  try {
    const res = await fetch('/api/supabase/status', {
      credentials: 'include',
      headers: buildHeaders(),
    });
    if (!res.ok) {
      return {
        configured: false,
        schemaReady: false,
        projectRef: 'exsuwvqxvxihrkzuahmd',
        supabaseUrl: 'https://exsuwvqxvxihrkzuahmd.supabase.co',
        message: 'Could not check Supabase backend status.',
      };
    }
    return (await res.json()) as SupabaseStatusInfo;
  } catch {
    return {
      configured: false,
      schemaReady: false,
      projectRef: 'exsuwvqxvxihrkzuahmd',
      supabaseUrl: 'https://exsuwvqxvxihrkzuahmd.supabase.co',
      message: 'Backend server unreachable; running on LocalStorage.',
    };
  }
}

export async function loadWorkspaceFromSupabase(
  accessToken?: string | null
): Promise<WorkspaceLoadResult> {
  try {
    const res = await fetch('/api/workspace', {
      credentials: 'include',
      headers: buildHeaders(accessToken),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503 || data?.code === 'KEY_MISSING') {
      return {
        status: 'needs_key',
        empty: true,
        workspace: null,
        message: data?.error || 'Supabase secret key not configured yet.',
      };
    }
    if (res.status === 424 || data?.code === 'SCHEMA_MISSING') {
      return {
        status: 'needs_schema',
        empty: true,
        workspace: null,
        message: data?.error || 'Supabase tables not initialized yet.',
      };
    }
    if (!res.ok) {
      return {
        status: 'error',
        empty: true,
        workspace: null,
        message: data?.error || `Failed to load from Supabase (${res.status})`,
      };
    }

    if (data.empty || !data.workspace) {
      return {
        status: 'synced',
        empty: true,
        workspace: null,
        message: 'Connected to Supabase (workspace empty).',
      };
    }

    return {
      status: 'synced',
      empty: false,
      workspace: workspaceRepository.hydrate(data.workspace as Partial<WorkspaceState>),
      message: 'Loaded workspace from Supabase.',
    };
  } catch {
    return {
      status: 'error',
      empty: true,
      workspace: null,
      message: 'Network error while connecting to Supabase backend.',
    };
  }
}

export async function syncWorkspaceToSupabase(
  state: WorkspaceState,
  accessToken?: string | null
): Promise<{ status: BackendSyncState; syncedAt?: string; message: string }> {
  try {
    const res = await fetch('/api/workspace', {
      method: 'PUT',
      credentials: 'include',
      headers: buildHeaders(accessToken, true),
      body: JSON.stringify(state),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503 || data?.code === 'KEY_MISSING') {
      return { status: 'needs_key', message: data?.error || 'Supabase secret key missing.' };
    }
    if (res.status === 424 || data?.code === 'SCHEMA_MISSING') {
      return { status: 'needs_schema', message: data?.error || 'Supabase tables not initialized yet.' };
    }
    if (!res.ok) {
      return { status: 'error', message: data?.error || `Sync failed (${res.status})` };
    }
    return { status: 'synced', syncedAt: data.syncedAt, message: 'Synced with Supabase PostgreSQL.' };
  } catch {
    return { status: 'error', message: 'Network error syncing with Supabase.' };
  }
}
