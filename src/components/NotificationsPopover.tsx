import React from 'react';
import { AlertCircle, BellOff, CalendarClock, Check, Flame, Sparkles, X } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { AppNotification } from '../types';

export const NotificationsPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    state,
    notifications,
    dismissNotification,
    clearAllNotifications,
    setActivePage,
    requestBrowserNotifications,
  } = useFocusFlow();

  const iconFor = (type: AppNotification['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
      case 'deadline':
        return <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'habit':
        return <Flame className="h-4 w-4 text-emerald-500 shrink-0" />;
      default:
        return <Sparkles className="h-4 w-4 text-[var(--accent)] shrink-0" />;
    }
  };

  const browserSupported = typeof window !== 'undefined' && 'Notification' in window;
  const browserPerm = browserSupported ? Notification.permission : 'denied';

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 mt-2 z-40 w-[330px] sm:w-[370px] rounded-xl border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#18191F] shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#262832] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">In-app reminders while Focus Flow is open</p>
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAllNotifications}
              className="text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="max-h-[320px] overflow-y-auto divide-y divide-zinc-100 dark:divide-[#232530]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <BellOff className="h-6 w-6 text-zinc-400 mb-2" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">All caught up</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                No pending deadline or habit alerts right now.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="mt-0.5">{iconFor(n.type)}</div>
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (n.actionPage) setActivePage(n.actionPage);
                    onClose();
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{n.title}</p>
                    <span className="text-[11px] text-zinc-400 shrink-0">{n.timestamp}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{n.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissNotification(n.id)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Dismiss alert"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {browserSupported && (
          <div className="border-t border-zinc-200 dark:border-[#262832] px-4 py-2.5 flex items-center justify-between gap-2 bg-zinc-50/70 dark:bg-[#14151B] rounded-b-xl">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {browserPerm === 'granted' && state.preferences.notifications.browserNotifications
                ? 'Browser notifications enabled'
                : 'Enable browser alerts while tab is open'}
            </span>
            {browserPerm === 'granted' && state.preferences.notifications.browserNotifications ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Active
              </span>
            ) : (
              <button
                type="button"
                onClick={requestBrowserNotifications}
                className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1B1D25] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-[var(--accent)] transition-colors whitespace-nowrap shrink-0"
              >
                Allow alerts
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
