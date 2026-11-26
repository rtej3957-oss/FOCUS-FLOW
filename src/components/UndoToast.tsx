import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusFlow } from '../context/FocusFlowContext';

export const UndoToast: React.FC = () => {
  const { undoToast, dismissUndoToast } = useFocusFlow();

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {undoToast && (
          <motion.div
            key={undoToast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-[#2A2D39] bg-zinc-900 text-zinc-100 dark:bg-[#1E2029] px-4 py-3 shadow-lg"
          >
            <span className="text-sm font-medium max-w-[260px] truncate">{undoToast.message}</span>
            <button
              type="button"
              onClick={() => {
                undoToast.onUndo();
                dismissUndoToast();
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={dismissUndoToast}
              className="rounded-md p-1 text-zinc-400 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
