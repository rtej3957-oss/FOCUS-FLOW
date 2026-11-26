import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirm } = useFocusFlow();

  return (
    <AnimatePresence>
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeConfirm}
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 dark:border-[#262832] bg-white dark:bg-[#18191F] p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  confirmDialog.destructive
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                }`}
              >
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="confirm-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {confirmDialog.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {confirmDialog.message}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 ${
                  confirmDialog.destructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                }`}
              >
                {confirmDialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
