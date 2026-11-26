import React, { useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { FocusModeType } from '../types';
import { formatDisplayDate } from '../utils/date';

export const FocusPage: React.FC = () => {
  const {
    state,
    focusTimer,
    startFocusTimer,
    pauseFocusTimer,
    resetFocusTimer,
    switchFocusMode,
    setFocusTask,
    updatePreferences,
  } = useFocusFlow();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreenOverlay, setIsFullscreenOverlay] = useState(false);
  const [customInput, setCustomInput] = useState(String(focusTimer.customMinutes));

  const pendingTasks = useMemo(() => state.tasks.filter((t) => t.status !== 'completed'), [state.tasks]);
  const selectedTask = state.tasks.find((t) => t.id === focusTimer.selectedTaskId) ?? null;

  const mins = Math.floor(focusTimer.remainingSeconds / 60);
  const secs = focusTimer.remainingSeconds % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progress =
    focusTimer.totalSeconds > 0
      ? (focusTimer.totalSeconds - focusTimer.remainingSeconds) / focusTimer.totalSeconds
      : 0;
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const totalFocusMinutes = useMemo(
    () => state.focusSessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    [state.focusSessions]
  );

  const toggleFullscreen = async () => {
    const next = !isFullscreenOverlay;
    setIsFullscreenOverlay(next);
    try {
      if (next && containerRef.current && document.fullscreenElement !== containerRef.current) {
        await containerRef.current.requestFullscreen?.();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fallback gracefully to distraction-free fixed overlay when Fullscreen API is restricted inside iframe
    }
  };

  const modes: Array<{ id: FocusModeType; label: string; minsLabel: string }> = [
    { id: 'focus', label: 'Focus', minsLabel: `${state.preferences.focusMinutes}m` },
    { id: 'short_break', label: 'Short Break', minsLabel: `${state.preferences.shortBreakMinutes}m` },
    { id: 'long_break', label: 'Long Break', minsLabel: `${state.preferences.longBreakMinutes}m` },
    { id: 'custom', label: 'Custom', minsLabel: `${focusTimer.customMinutes}m` },
  ];

  const timerStage = (
    <div
      ref={containerRef}
      className={
        isFullscreenOverlay
          ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#0E0F13] p-6 overflow-y-auto'
          : 'rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 sm:p-8'
      }
    >
      {/* Top Toolbar */}
      <div className="flex w-full max-w-xl items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 dark:bg-[#1E2028] p-1">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => switchFocusMode(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                focusTimer.mode === m.id
                  ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {m.label} ({m.minsLabel})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => updatePreferences({ soundEnabled: !state.preferences.soundEnabled })}
            title={state.preferences.soundEnabled ? 'Mute end chime' : 'Enable end chime'}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Toggle timer sound"
          >
            {state.preferences.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreenOverlay ? 'Exit distraction-free view' : 'Enter distraction-free fullscreen'}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Toggle fullscreen focus mode"
          >
            {isFullscreenOverlay ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Custom Duration Input when Custom selected */}
      {focusTimer.mode === 'custom' && focusTimer.status === 'idle' && (
        <div className="mb-5 flex items-center justify-center gap-2">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Duration (min):</label>
          <input
            type="number"
            min={1}
            max={180}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="w-20 rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-2.5 py-1 text-center font-mono text-sm text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              const val = Math.min(180, Math.max(1, Number(customInput) || 25));
              setCustomInput(String(val));
              switchFocusMode('custom', val);
            }}
            className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)]"
          >
            Set
          </button>
        </div>
      )}

      {/* Circular Countdown Ring */}
      <div className="mx-auto flex flex-col items-center">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <svg className="h-64 w-64 -rotate-90" viewBox="0 0 260 260">
            <circle
              cx="130"
              cy="130"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-zinc-100 dark:text-[#232530]"
            />
            <circle
              cx="130"
              cy="130"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">
              {formattedClock}
            </span>
            <span className="mt-2 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {focusTimer.mode.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Task Selection */}
        <div className="mt-6 w-full max-w-md">
          <label className="block text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
            Focusing on
          </label>
          <select
            value={focusTimer.selectedTaskId ?? ''}
            onChange={(e) => setFocusTask(e.target.value || null)}
            className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="">General Deep Work (No specific task)</option>
            {pendingTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {selectedTask && (
            <p className="mt-1.5 text-center text-xs text-zinc-500 dark:text-zinc-400 truncate">
              Selected: {selectedTask.title}
            </p>
          )}
        </div>

        {/* Timer Controls */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {focusTimer.status === 'running' ? (
            <button
              type="button"
              onClick={pauseFocusTimer}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={startFocusTimer}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Play className="h-4 w-4" />
              {focusTimer.status === 'paused' ? 'Resume' : 'Start Session'}
            </button>
          )}

          <button
            type="button"
            onClick={resetFocusTimer}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-[#2A2D39] px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">Focus Mode</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Timer stays accurate even as you navigate across pages in Focus Flow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">{timerStage}</div>

        {/* Session History & Total Focus Time */}
        <aside className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Focus Time Logged</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {(totalFocusMinutes / 60).toFixed(1)}h
              </span>
              <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                ({totalFocusMinutes} min · {state.focusSessions.length} sessions)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-5">
            <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Completed Focus History
            </h3>
            {state.focusSessions.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-6 text-center">
                Complete your first focus session to build your history.
              </p>
            ) : (
              <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-100 dark:divide-[#232530]">
                {state.focusSessions.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {s.taskTitle || 'Deep Work Session'}
                      </p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {formatDisplayDate(s.date)}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-[var(--accent)] shrink-0">
                      {s.durationMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
