import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_ID = 'gemini-4-hydrogen';
const SUPABASE_PROJECT_REF = 'exsuwvqxvxihrkzuahmd';
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const DEFAULT_WORKSPACE_ID = 'default';
const SESSION_COOKIE_NAME = 'ff_session';

function getConfiguredSupabaseKey(): { key: string; isServiceRole: boolean } | null {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.SUPABASE_ANON_KEY?.trim();
  const key = srk || anon;
  if (!key) return null;

  let isServiceRole = false;
  if (key.startsWith('sb_secret_')) {
    isServiceRole = true;
  } else if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString('utf8')) as { role?: string };
      isServiceRole = payload?.role === 'service_role';
    } catch {
      isServiceRole = false;
    }
  }
  return { key, isServiceRole };
}

function hasServiceRoleKey(): boolean {
  return Boolean(getConfiguredSupabaseKey()?.isServiceRole);
}

function getSupabaseClient(userAccessToken?: string | null): SupabaseClient | null {
  const cfg = getConfiguredSupabaseKey();
  if (!cfg) return null;
  if (!cfg.isServiceRole && userAccessToken) {
    return createClient(SUPABASE_URL, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      },
    });
  }
  return createClient(SUPABASE_URL, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isMissingSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  });
  return out;
}

function getSessionToken(req: express.Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return { token: t, viaCookie: false };
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return { token: cookies[SESSION_COOKIE_NAME], viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

function verifyCsrf(req: express.Request): boolean {
  if (req.headers['x-requested-with'] === 'FocusFlow') return true;
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  } else {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    });
  } else {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
}

function scopeId(workspaceId: string, rawId: string): string {
  if (workspaceId === DEFAULT_WORKSPACE_ID) return rawId;
  return rawId.startsWith(`${workspaceId}::`) ? rawId : `${workspaceId}::${rawId}`;
}

function unscopeId(workspaceId: string, dbId: string): string {
  const prefix = `${workspaceId}::`;
  return dbId.startsWith(prefix) ? dbId.slice(prefix.length) : dbId;
}

async function resolveAuthUser(req: express.Request, sb: SupabaseClient) {
  const { token, viaCookie } = getSessionToken(req);
  if (!token) return { user: null, token: null, viaCookie };
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { user: null, token: null, viaCookie };
  return { user: data.user, token, viaCookie };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isTransient = msg.includes('503') || msg.includes('unavailable') || msg.includes('429');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

function handleAiError(res: express.Response, err: unknown) {
  const message = err instanceof Error ? err.message : 'Unexpected AI service error.';
  const lower = message.toLowerCase();
  if (lower.includes('api_key') || lower.includes('permission_denied') || lower.includes('403')) {
    res.status(403).json({
      error: 'Gemini API key is invalid or unauthorized. Please check Settings > Secrets.',
    });
    return;
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    res.status(429).json({
      error: 'AI quota temporarily reached. Please wait a moment and try again.',
    });
    return;
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    res.status(503).json({
      error: 'The AI service is experiencing temporary high demand. Please try again in a few seconds.',
    });
    return;
  }
  res.status(500).json({ error: message });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const key = process.env.GEMINI_API_KEY?.trim();
    const aiConfigured = Boolean(key && key !== 'MY_GEMINI_API_KEY');
    const supabaseConfigured = Boolean(getSupabaseClient());
    res.json({ ok: true, aiConfigured, supabaseConfigured, projectRef: SUPABASE_PROJECT_REF });
  });

  // Supabase connection & schema status
  app.get('/api/supabase/status', async (_req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.json({
        configured: false,
        schemaReady: false,
        projectRef: SUPABASE_PROJECT_REF,
        supabaseUrl: SUPABASE_URL,
        message: 'Add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in Settings > Secrets to connect your Supabase backend.',
      });
      return;
    }

    const checks = await Promise.all([
      sb.from('ff_accounts').select('id').limit(1),
      sb.from('ff_categories').select('id').limit(1),
      sb.from('ff_projects').select('id').limit(1),
      sb.from('ff_tasks').select('id').limit(1),
      sb.from('ff_habits').select('id').limit(1),
      sb.from('ff_focus_sessions').select('id').limit(1),
      sb.from('ff_preferences').select('workspace_id').limit(1),
    ]);
    const error = checks.find((c) => c.error)?.error;
    if (error) {
      if (isMissingSchemaError(error)) {
        res.json({
          configured: true,
          schemaReady: false,
          projectRef: SUPABASE_PROJECT_REF,
          supabaseUrl: SUPABASE_URL,
          code: 'SCHEMA_MISSING',
          message: 'Connected to Supabase, but Focus Flow tables are not created yet. Run supabase/schema.sql in your SQL Editor.',
        });
        return;
      }
      res.json({
        configured: true,
        schemaReady: false,
        projectRef: SUPABASE_PROJECT_REF,
        supabaseUrl: SUPABASE_URL,
        message: error.message,
      });
      return;
    }

    res.json({
      configured: true,
      schemaReady: true,
      projectRef: SUPABASE_PROJECT_REF,
      supabaseUrl: SUPABASE_URL,
      message: 'Connected and synced with Supabase PostgreSQL.',
    });
  });

  // Supabase Auth: Sign Up (stores in Supabase Auth + ff_accounts table)
  app.post('/api/auth/signup', async (req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.status(503).json({
        code: 'KEY_MISSING',
        error: 'Supabase key is not configured in server secrets yet.',
      });
      return;
    }

    const { fullName, email, password, roleTitle } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
    const cleanRole = typeof roleTitle === 'string' && roleTitle.trim() ? roleTitle.trim().slice(0, 80) : 'Personal Workspace';

    if (!cleanName || cleanName.length > 100) {
      res.status(400).json({ error: 'Please enter your full name (1-100 characters).' });
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    try {
      let createdUserId = '';
      if (hasServiceRoleKey()) {
        const { data: created, error: createErr } = await sb.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: cleanName, role_title: cleanRole },
        });
        if (createErr) {
          res.status(400).json({ error: createErr.message });
          return;
        }
        createdUserId = created.user.id;
      } else {
        const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: cleanName, role_title: cleanRole } },
        });
        if (signUpErr) {
          res.status(400).json({ error: signUpErr.message });
          return;
        }
        createdUserId = signUpData.user?.id ?? '';
      }

      const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInErr || !signInData.session || !signInData.user) {
        res.status(400).json({
          error:
            signInErr?.message ||
            'Account created! Please confirm your email in Supabase or use SUPABASE_SERVICE_ROLE_KEY for instant sign-in.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const userId = signInData.user.id || createdUserId;
      const defaultAvatar = '/src/assets/images/avatar_focusflow_user_1795666568668.jpg';
      const db = getSupabaseClient(signInData.session.access_token) ?? sb;

      const { error: acctErr } = await db.from('ff_accounts').upsert(
        {
          id: userId,
          email: cleanEmail,
          full_name: cleanName,
          role_title: cleanRole,
          avatar_url: defaultAvatar,
          created_at: nowIso,
          last_login_at: nowIso,
        },
        { onConflict: 'id' }
      );
      if (acctErr && !isMissingSchemaError(acctErr)) {
        res.status(500).json({ error: acctErr.message });
        return;
      }

      setSessionCookie(req, res, signInData.session.access_token);
      res.status(201).json({
        accessToken: signInData.session.access_token,
        schemaWarning: isMissingSchemaError(acctErr)
          ? 'Account created in Supabase Auth, but ff_accounts table is missing. Run supabase/schema.sql.'
          : undefined,
        user: {
          id: userId,
          email: cleanEmail,
          fullName: cleanName,
          roleTitle: cleanRole,
          avatarUrl: defaultAvatar,
          createdAt: nowIso,
          lastLoginAt: nowIso,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to create account.' });
    }
  });

  // Supabase Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.status(503).json({
        code: 'KEY_MISSING',
        error: 'Supabase key is not configured in server secrets yet.',
      });
      return;
    }

    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.session || !data.user) {
        res.status(401).json({ error: error?.message || 'Invalid email or password.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const fallbackName = String(meta.full_name || cleanEmail.split('@')[0] || 'User');
      const fallbackRole = String(meta.role_title || 'Personal Workspace');
      const defaultAvatar = '/src/assets/images/avatar_focusflow_user_1795666568668.jpg';
      const db = getSupabaseClient(data.session.access_token) ?? sb;

      const { data: existingAcct } = await db
        .from('ff_accounts')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const fullName = existingAcct?.full_name || fallbackName;
      const roleTitle = existingAcct?.role_title || fallbackRole;
      const avatarUrl = existingAcct?.avatar_url || defaultAvatar;
      const createdAt = existingAcct?.created_at || data.user.created_at || nowIso;

      await db.from('ff_accounts').upsert(
        {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: fullName,
          role_title: roleTitle,
          avatar_url: avatarUrl,
          created_at: createdAt,
          last_login_at: nowIso,
        },
        { onConflict: 'id' }
      );

      setSessionCookie(req, res, data.session.access_token);
      res.json({
        accessToken: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          fullName,
          roleTitle,
          avatarUrl,
          createdAt,
          lastLoginAt: nowIso,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed.' });
    }
  });

  // Supabase Auth: Current Session User
  app.get('/api/auth/me', async (req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.json({ authenticated: false, user: null, configured: false });
      return;
    }

    const { user, token } = await resolveAuthUser(req, sb);
    if (!user) {
      res.json({ authenticated: false, user: null, configured: true });
      return;
    }

    const db = getSupabaseClient(token) ?? sb;
    const { data: acct } = await db.from('ff_accounts').select('*').eq('id', user.id).maybeSingle();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    res.json({
      authenticated: true,
      configured: true,
      user: {
        id: user.id,
        email: acct?.email || user.email || '',
        fullName: acct?.full_name || String(meta.full_name || user.email?.split('@')[0] || 'User'),
        roleTitle: acct?.role_title || String(meta.role_title || 'Personal Workspace'),
        avatarUrl: acct?.avatar_url || '/src/assets/images/avatar_focusflow_user_1795666568668.jpg',
        createdAt: acct?.created_at || user.created_at || new Date().toISOString(),
        lastLoginAt: acct?.last_login_at || new Date().toISOString(),
      },
    });
  });

  // Supabase Auth: Update Account Profile
  app.patch('/api/auth/profile', async (req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.status(503).json({ error: 'Supabase key not configured.' });
      return;
    }
    const { user, token, viaCookie } = await resolveAuthUser(req, sb);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (viaCookie && !verifyCsrf(req)) {
      res.status(403).json({ error: 'CSRF check failed.' });
      return;
    }

    const { fullName, roleTitle, avatarUrl } = req.body ?? {};
    const updates: Record<string, string> = {};
    if (typeof fullName === 'string' && fullName.trim()) updates.full_name = fullName.trim().slice(0, 100);
    if (typeof roleTitle === 'string') updates.role_title = roleTitle.trim().slice(0, 80);
    if (typeof avatarUrl === 'string') updates.avatar_url = avatarUrl.trim().slice(0, 500);

    const db = getSupabaseClient(token) ?? sb;
    const { data, error } = await db
      .from('ff_accounts')
      .upsert(
        {
          id: user.id,
          email: user.email || '',
          full_name: updates.full_name || String(user.user_metadata?.full_name || 'User'),
          role_title: updates.role_title ?? String(user.user_metadata?.role_title || 'Personal Workspace'),
          avatar_url: updates.avatar_url ?? '/src/assets/images/avatar_focusflow_user_1795666568668.jpg',
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      user: {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        roleTitle: data.role_title,
        avatarUrl: data.avatar_url,
        createdAt: data.created_at,
        lastLoginAt: data.last_login_at,
      },
    });
  });

  // Supabase Auth: Logout
  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Load full workspace from Supabase (scoped to authenticated user if logged in)
  app.get('/api/workspace', async (req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.status(503).json({
        configured: false,
        code: 'KEY_MISSING',
        error: 'Supabase key is not configured in server secrets.',
      });
      return;
    }

    try {
      const { user, token } = await resolveAuthUser(req, sb);
      const workspaceId = user?.id ?? DEFAULT_WORKSPACE_ID;
      const db = getSupabaseClient(token) ?? sb;

      const [catRes, projRes, taskRes, habitRes, focusRes, prefRes] = await Promise.all([
        db.from('ff_categories').select('*').eq('workspace_id', workspaceId),
        db.from('ff_projects').select('*').eq('workspace_id', workspaceId),
        db.from('ff_tasks').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
        db.from('ff_habits').select('*').eq('workspace_id', workspaceId),
        db.from('ff_focus_sessions').select('*').eq('workspace_id', workspaceId).order('completed_at', { ascending: false }),
        db.from('ff_preferences').select('*').eq('workspace_id', workspaceId).maybeSingle(),
      ]);

      const firstErr = catRes.error || projRes.error || taskRes.error || habitRes.error || focusRes.error || prefRes.error;
      if (firstErr) {
        if (isMissingSchemaError(firstErr)) {
          res.status(424).json({
            configured: true,
            code: 'SCHEMA_MISSING',
            error: 'Supabase tables not initialized. Run supabase/schema.sql in your Supabase SQL Editor.',
          });
          return;
        }
        res.status(500).json({ error: firstErr.message });
        return;
      }

      const hasAnyData =
        Boolean(prefRes.data) ||
        (catRes.data?.length ?? 0) > 0 ||
        (taskRes.data?.length ?? 0) > 0 ||
        (projRes.data?.length ?? 0) > 0 ||
        (habitRes.data?.length ?? 0) > 0;

      if (!hasAnyData) {
        res.json({ empty: true, workspace: null, workspaceId });
        return;
      }

      const workspace = {
        version: 1,
        categories: (catRes.data ?? []).map((r) => ({
          id: unscopeId(workspaceId, r.id),
          name: r.name,
          color: r.color,
          icon: r.icon,
          isDefault: Boolean(r.is_default),
        })),
        projects: (projRes.data ?? []).map((r) => ({
          id: unscopeId(workspaceId, r.id),
          name: r.name,
          description: r.description ?? '',
          deadline: r.deadline ?? '',
          color: r.color,
          status: r.status,
          createdAt: r.created_at,
        })),
        tasks: (taskRes.data ?? []).map((r) => ({
          id: unscopeId(workspaceId, r.id),
          title: r.title,
          description: r.description ?? '',
          dueDate: r.due_date ?? '',
          dueTime: r.due_time ?? '',
          priority: r.priority,
          categoryId: unscopeId(workspaceId, r.category_id),
          projectId: r.project_id ? unscopeId(workspaceId, r.project_id) : null,
          status: r.status,
          subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
          tags: Array.isArray(r.tags) ? r.tags : [],
          estimatedMinutes: Number(r.estimated_minutes) || 30,
          recurring: r.recurring ?? 'none',
          notes: r.notes ?? '',
          order: Number(r.sort_order) || 0,
          createdAt: r.created_at,
          completedAt: r.completed_at ?? null,
        })),
        habits: (habitRes.data ?? []).map((r) => ({
          id: unscopeId(workspaceId, r.id),
          name: r.name,
          description: r.description ?? '',
          color: r.color,
          icon: r.icon,
          scheduleType: r.schedule_type,
          targetDays: Array.isArray(r.target_days) ? r.target_days : [0, 1, 2, 3, 4, 5, 6],
          completedDates: Array.isArray(r.completed_dates) ? r.completed_dates : [],
          createdAt: r.created_at,
        })),
        focusSessions: (focusRes.data ?? []).map((r) => ({
          id: unscopeId(workspaceId, r.id),
          taskId: r.task_id ? unscopeId(workspaceId, r.task_id) : null,
          taskTitle: r.task_title ?? null,
          mode: r.mode,
          durationMinutes: Number(r.duration_minutes) || 25,
          completedAt: r.completed_at,
          date: r.session_date,
        })),
        preferences: prefRes.data?.preferences ?? undefined,
        focusTimer: prefRes.data?.focus_timer ?? undefined,
        dismissedNotificationIds: Array.isArray(prefRes.data?.dismissed_notification_ids)
          ? prefRes.data.dismissed_notification_ids
          : [],
      };

      res.json({ empty: false, workspace, workspaceId });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Supabase workspace.' });
    }
  });

  // Sync full workspace to Supabase (scoped to authenticated user if logged in)
  app.put('/api/workspace', async (req, res) => {
    const sb = getSupabaseClient();
    if (!sb) {
      res.status(503).json({
        configured: false,
        code: 'KEY_MISSING',
        error: 'Supabase key is not configured in server secrets.',
      });
      return;
    }

    const { user, token, viaCookie } = await resolveAuthUser(req, sb);
    if (viaCookie && !verifyCsrf(req)) {
      res.status(403).json({ error: 'CSRF check failed.' });
      return;
    }
    const workspaceId = user?.id ?? DEFAULT_WORKSPACE_ID;
    const db = getSupabaseClient(token) ?? sb;

    const body = req.body;
    if (!body || typeof body !== 'object' || !Array.isArray(body.tasks)) {
      res.status(400).json({ error: 'Invalid workspace payload.' });
      return;
    }

    const syncTable = async (table: string, rows: Array<Record<string, unknown>>) => {
      if (rows.length > 0) {
        const { error: upsertErr } = await db.from(table).upsert(rows, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;
      }
      const { data: existing, error: listErr } = await db.from(table).select('id').eq('workspace_id', workspaceId);
      if (listErr) throw listErr;
      const keepIds = new Set(rows.map((r) => String(r.id)));
      const toDelete = (existing ?? []).map((e) => String(e.id)).filter((id) => !keepIds.has(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await db.from(table).delete().eq('workspace_id', workspaceId).in('id', toDelete);
        if (delErr) throw delErr;
      }
    };

    try {
      const categories = (Array.isArray(body.categories) ? body.categories : []).map((c: Record<string, unknown>) => ({
        id: scopeId(workspaceId, String(c.id)),
        workspace_id: workspaceId,
        name: String(c.name ?? 'Category'),
        color: String(c.color ?? '#5E6AD2'),
        icon: String(c.icon ?? 'Layers'),
        is_default: Boolean(c.isDefault),
      }));

      const projects = (Array.isArray(body.projects) ? body.projects : []).map((p: Record<string, unknown>) => ({
        id: scopeId(workspaceId, String(p.id)),
        workspace_id: workspaceId,
        name: String(p.name ?? 'Project'),
        description: String(p.description ?? ''),
        deadline: String(p.deadline ?? ''),
        color: String(p.color ?? '#5E6AD2'),
        status: String(p.status ?? 'active'),
        created_at: String(p.createdAt ?? new Date().toISOString()),
      }));

      const tasks = (Array.isArray(body.tasks) ? body.tasks : []).map((t: Record<string, unknown>) => ({
        id: scopeId(workspaceId, String(t.id)),
        workspace_id: workspaceId,
        title: String(t.title ?? ''),
        description: String(t.description ?? ''),
        due_date: String(t.dueDate ?? ''),
        due_time: String(t.dueTime ?? ''),
        priority: String(t.priority ?? 'medium'),
        category_id: scopeId(workspaceId, String(t.categoryId ?? 'cat-personal')),
        project_id: t.projectId ? scopeId(workspaceId, String(t.projectId)) : null,
        status: String(t.status ?? 'todo'),
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        tags: Array.isArray(t.tags) ? t.tags : [],
        estimated_minutes: Number(t.estimatedMinutes) || 30,
        recurring: String(t.recurring ?? 'none'),
        notes: String(t.notes ?? ''),
        sort_order: Number(t.order) || 0,
        created_at: String(t.createdAt ?? new Date().toISOString()),
        completed_at: t.completedAt ? String(t.completedAt) : null,
      }));

      const habits = (Array.isArray(body.habits) ? body.habits : []).map((h: Record<string, unknown>) => ({
        id: scopeId(workspaceId, String(h.id)),
        workspace_id: workspaceId,
        name: String(h.name ?? ''),
        description: String(h.description ?? ''),
        color: String(h.color ?? '#0D9488'),
        icon: String(h.icon ?? 'Flame'),
        schedule_type: String(h.scheduleType ?? 'daily'),
        target_days: Array.isArray(h.targetDays) ? h.targetDays : [0, 1, 2, 3, 4, 5, 6],
        completed_dates: Array.isArray(h.completedDates) ? h.completedDates : [],
        created_at: String(h.createdAt ?? new Date().toISOString()),
      }));

      const focusSessions = (Array.isArray(body.focusSessions) ? body.focusSessions : []).map(
        (s: Record<string, unknown>) => ({
          id: scopeId(workspaceId, String(s.id)),
          workspace_id: workspaceId,
          task_id: s.taskId ? scopeId(workspaceId, String(s.taskId)) : null,
          task_title: s.taskTitle ? String(s.taskTitle) : null,
          mode: String(s.mode ?? 'focus'),
          duration_minutes: Number(s.durationMinutes) || 25,
          completed_at: String(s.completedAt ?? new Date().toISOString()),
          session_date: String(s.date ?? new Date().toISOString().slice(0, 10)),
        })
      );

      await Promise.all([
        syncTable('ff_categories', categories),
        syncTable('ff_projects', projects),
        syncTable('ff_tasks', tasks),
        syncTable('ff_habits', habits),
        syncTable('ff_focus_sessions', focusSessions),
      ]);

      const { error: prefErr } = await db.from('ff_preferences').upsert(
        {
          workspace_id: workspaceId,
          preferences: body.preferences ?? {},
          focus_timer: body.focusTimer ?? {},
          dismissed_notification_ids: Array.isArray(body.dismissedNotificationIds)
            ? body.dismissedNotificationIds
            : [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      );
      if (prefErr) throw prefErr;

      res.json({ ok: true, syncedAt: new Date().toISOString(), workspaceId });
    } catch (err) {
      const typed = err as { code?: string; message?: string };
      if (isMissingSchemaError(typed)) {
        res.status(424).json({
          configured: true,
          code: 'SCHEMA_MISSING',
          error: 'Supabase tables not initialized. Run supabase/schema.sql in your Supabase SQL Editor.',
        });
        return;
      }
      res.status(500).json({ error: typed?.message || 'Failed to sync workspace to Supabase.' });
    }
  });

  // 1. Convert natural-language instruction / goal into structured tasks
  app.post('/api/ai/plan', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI Assistant is unavailable because GEMINI_API_KEY is not configured. Core task management works normally.',
      });
      return;
    }

    const { prompt, todayDate, categories, projects } = req.body ?? {};
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) {
      res.status(400).json({ error: 'Please provide a concise planning prompt (1-2000 characters).' });
      return;
    }

    const safeCategories = Array.isArray(categories)
      ? categories.filter((c): c is string => typeof c === 'string').slice(0, 20)
      : ['Personal', 'Academics', 'Business', 'Fitness', 'Finance', 'Work'];
    const safeProjects = Array.isArray(projects)
      ? projects.filter((p): p is string => typeof p === 'string').slice(0, 20)
      : [];
    const safeToday = typeof todayDate === 'string' ? todayDate.slice(0, 20) : new Date().toISOString().slice(0, 10);

    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_ID,
          contents: `Current local date: ${safeToday}
Available categories: ${safeCategories.join(', ')}
Available projects: ${safeProjects.length ? safeProjects.join(', ') : 'None'}

User request:
"""
${prompt.trim()}
"""

Generate a realistic, actionable plan of concrete tasks for the user to review before adding. Spread deadlines sensibly before any mentioned target date.`,
          config: {
            systemInstruction:
              'You are Focus Flow AI, a calm, pragmatic productivity planner. Convert the user request into structured, concrete tasks with realistic due dates (YYYY-MM-DD), optional times (HH:MM in 24h format), appropriate priority (urgent, high, medium, low), matching category from the available list, estimatedMinutes, and clear subtasks.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: 'Brief 1-2 sentence overview of the suggested plan.',
                },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      dueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
                      dueTime: { type: Type.STRING, description: 'Optional HH:MM 24h format or empty string' },
                      priority: { type: Type.STRING, description: 'One of: urgent, high, medium, low' },
                      category: { type: Type.STRING },
                      estimatedMinutes: { type: Type.INTEGER },
                      subtasks: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ['title', 'dueDate', 'priority', 'category', 'estimatedMinutes', 'subtasks'],
                  },
                },
              },
              required: ['summary', 'tasks'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleAiError(res, err);
    }
  });

  // 2. Break down an existing task into actionable subtasks + suggested priority & duration
  app.post('/api/ai/breakdown', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI Assistant is unavailable because GEMINI_API_KEY is not configured.',
      });
      return;
    }

    const { title, description, dueDate, priority } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || title.length > 300) {
      res.status(400).json({ error: 'Valid task title is required.' });
      return;
    }

    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_ID,
          contents: `Break down this task into 3-6 small, actionable subtasks, suggest an updated priority and realistic total duration in minutes.
Title: ${title.trim()}
Description: ${typeof description === 'string' ? description.slice(0, 800) : ''}
Due Date: ${typeof dueDate === 'string' ? dueDate.slice(0, 20) : 'None'}
Current Priority: ${typeof priority === 'string' ? priority : 'medium'}`,
          config: {
            systemInstruction:
              'You are Focus Flow AI. Return concrete, verb-led subtasks that take 10-45 minutes each, plus a realistic estimatedMinutes and priority (urgent, high, medium, low).',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rationale: { type: Type.STRING },
                suggestedPriority: { type: Type.STRING },
                estimatedMinutes: { type: Type.INTEGER },
                subtasks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['rationale', 'suggestedPriority', 'estimatedMinutes', 'subtasks'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleAiError(res, err);
    }
  });

  // 3. Daily Schedule, Overload Detection & Realistic Deadline Suggestions
  app.post('/api/ai/schedule', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI Assistant is unavailable because GEMINI_API_KEY is not configured.',
      });
      return;
    }

    const { tasks, todayDate, workHoursStart, workHoursEnd } = req.body ?? {};
    if (!Array.isArray(tasks)) {
      res.status(400).json({ error: 'Tasks list is required.' });
      return;
    }

    const compactTasks = tasks.slice(0, 40).map((t) => ({
      id: String(t?.id ?? ''),
      title: String(t?.title ?? '').slice(0, 140),
      dueDate: String(t?.dueDate ?? ''),
      dueTime: String(t?.dueTime ?? ''),
      priority: String(t?.priority ?? 'medium'),
      estimatedMinutes: Number(t?.estimatedMinutes) || 30,
      status: String(t?.status ?? 'todo'),
    }));

    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_ID,
          contents: `Current date: ${typeof todayDate === 'string' ? todayDate.slice(0, 20) : new Date().toISOString().slice(0, 10)}
Preferred focus window: ${typeof workHoursStart === 'string' ? workHoursStart : '09:00'} to ${typeof workHoursEnd === 'string' ? workHoursEnd : '18:00'}

Pending Tasks:
${JSON.stringify(compactTasks, null, 2)}

1. Create a personalized time-blocked daily schedule for today (prioritizing urgent/overdue/due-today tasks with realistic breaks).
2. Identify any overloaded days (e.g., > 5 hours or >= 5 heavy tasks on one date).
3. Suggest realistic deadline or priority adjustments for tasks where helpful.`,
          config: {
            systemInstruction:
              'You are Focus Flow AI. Be practical, calm, and realistic. Only reference taskIds that exist in the input list.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overview: { type: Type.STRING },
                scheduleBlocks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING },
                      title: { type: Type.STRING },
                      startTime: { type: Type.STRING, description: 'HH:MM' },
                      endTime: { type: Type.STRING, description: 'HH:MM' },
                      note: { type: Type.STRING },
                    },
                    required: ['taskId', 'title', 'startTime', 'endTime'],
                  },
                },
                overloadedDays: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING },
                      taskCount: { type: Type.INTEGER },
                      totalMinutes: { type: Type.INTEGER },
                      advice: { type: Type.STRING },
                    },
                    required: ['date', 'taskCount', 'totalMinutes', 'advice'],
                  },
                },
                adjustments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING },
                      title: { type: Type.STRING },
                      suggestedDueDate: { type: Type.STRING },
                      suggestedPriority: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['taskId', 'title', 'reason'],
                  },
                },
              },
              required: ['overview', 'scheduleBlocks', 'overloadedDays', 'adjustments'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleAiError(res, err);
    }
  });

  // 4. Weekly Productivity Summary
  app.post('/api/ai/weekly-summary', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI Assistant is unavailable because GEMINI_API_KEY is not configured.',
      });
      return;
    }

    const { stats } = req.body ?? {};
    if (!stats || typeof stats !== 'object') {
      res.status(400).json({ error: 'Activity statistics are required.' });
      return;
    }

    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_ID,
          contents: `Analyze these real user productivity statistics for the past 7 days and produce a concise, encouraging, insightful weekly review with specific observations and 3 actionable next-week recommendations:
${JSON.stringify(stats).slice(0, 4000)}`,
          config: {
            systemInstruction:
              'You are Focus Flow AI. Base every observation strictly on the provided numbers. Do not invent numbers.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                summary: { type: Type.STRING },
                highlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['headline', 'summary', 'highlights', 'recommendations'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleAiError(res, err);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*all', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Focus Flow server listening on http://localhost:${PORT}`);
  });
}

startServer();
