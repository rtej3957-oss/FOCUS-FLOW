import { AuthUser } from '../types';

export interface AuthMeResponse {
  authenticated: boolean;
  configured: boolean;
  user: AuthUser | null;
}

export type AuthActionResult =
  | {
      ok: true;
      accessToken: string;
      user: AuthUser;
      schemaWarning?: string;
    }
  | {
      ok: false;
      code?: string;
      error: string;
    };

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

export async function fetchCurrentUser(accessToken?: string | null): Promise<AuthMeResponse> {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: buildHeaders(accessToken),
    });
    if (!res.ok) {
      return { authenticated: false, configured: false, user: null };
    }
    return (await res.json()) as AuthMeResponse;
  } catch {
    return { authenticated: false, configured: false, user: null };
  }
}

export async function loginWithSupabase(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(null, true),
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.user || !data?.accessToken) {
      return {
        ok: false,
        code: data?.code,
        error: data?.error || 'Unable to sign in. Please verify your credentials.',
      };
    }
    return {
      ok: true,
      accessToken: data.accessToken as string,
      user: data.user as AuthUser,
    };
  } catch {
    return {
      ok: false,
      error: 'Network error while signing in.',
    };
  }
}

export async function signupWithSupabase(input: {
  fullName: string;
  email: string;
  password: string;
  roleTitle?: string;
}): Promise<AuthActionResult> {
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(null, true),
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.user || !data?.accessToken) {
      return {
        ok: false,
        code: data?.code,
        error: data?.error || 'Unable to create account.',
      };
    }
    return {
      ok: true,
      accessToken: data.accessToken as string,
      user: data.user as AuthUser,
      schemaWarning: data.schemaWarning as string | undefined,
    };
  } catch {
    return {
      ok: false,
      error: 'Network error while creating your account.',
    };
  }
}

export async function updateSupabaseProfile(
  patch: { fullName?: string; roleTitle?: string; avatarUrl?: string },
  accessToken?: string | null
): Promise<{ ok: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: buildHeaders(accessToken, true),
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.user) {
      return { ok: false, error: data?.error || 'Could not update profile.' };
    }
    return { ok: true, user: data.user as AuthUser };
  } catch {
    return { ok: false, error: 'Network error updating profile.' };
  }
}

export async function logoutFromSupabase(accessToken?: string | null): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(accessToken),
    });
  } catch {
    // ignore network errors on logout
  }
}
