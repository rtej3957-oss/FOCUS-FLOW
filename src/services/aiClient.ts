import { AiSuggestedTask, Task } from '../types';

export interface AiPlanResponse {
  summary: string;
  tasks: AiSuggestedTask[];
}

export interface AiBreakdownResponse {
  rationale: string;
  suggestedPriority: string;
  estimatedMinutes: number;
  subtasks: string[];
}

export interface AiScheduleResponse {
  overview: string;
  scheduleBlocks: Array<{
    taskId: string;
    title: string;
    startTime: string;
    endTime: string;
    note?: string;
  }>;
  overloadedDays: Array<{
    date: string;
    taskCount: number;
    totalMinutes: number;
    advice: string;
  }>;
  adjustments: Array<{
    taskId: string;
    title: string;
    suggestedDueDate?: string;
    suggestedPriority?: string;
    reason: string;
  }>;
}

export interface AiWeeklySummaryResponse {
  headline: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export async function checkAiHealth(): Promise<{ ok: boolean; aiConfigured: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { ok: false, aiConfigured: false };
    return (await res.json()) as { ok: boolean; aiConfigured: boolean };
  } catch {
    return { ok: false, aiConfigured: false };
  }
}

export function requestAiPlan(params: {
  prompt: string;
  todayDate: string;
  categories: string[];
  projects: string[];
}): Promise<AiPlanResponse> {
  return postJson<AiPlanResponse>('/api/ai/plan', params);
}

export function requestAiBreakdown(task: Pick<Task, 'title' | 'description' | 'dueDate' | 'priority'>): Promise<AiBreakdownResponse> {
  return postJson<AiBreakdownResponse>('/api/ai/breakdown', task);
}

export function requestAiSchedule(params: {
  tasks: Task[];
  todayDate: string;
  workHoursStart?: string;
  workHoursEnd?: string;
}): Promise<AiScheduleResponse> {
  return postJson<AiScheduleResponse>('/api/ai/schedule', params);
}

export function requestAiWeeklySummary(stats: Record<string, unknown>): Promise<AiWeeklySummaryResponse> {
  return postJson<AiWeeklySummaryResponse>('/api/ai/weekly-summary', { stats });
}
