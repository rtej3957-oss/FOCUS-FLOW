import React from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmModal } from './components/ConfirmModal';
import { QuickAddModal } from './components/QuickAddModal';
import { Sidebar } from './components/Sidebar';
import { TaskModal } from './components/TaskModal';
import { TopBar } from './components/TopBar';
import { UndoToast } from './components/UndoToast';
import { FocusFlowProvider, useFocusFlow } from './context/FocusFlowContext';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { FocusPage } from './pages/FocusPage';
import { HabitsPage } from './pages/HabitsPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksViewPage } from './pages/TasksViewPage';

const WorkspaceShell: React.FC = () => {
  const { activePage } = useFocusFlow();

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'today':
        return <TasksViewPage scope="today" />;
      case 'upcoming':
        return <TasksViewPage scope="upcoming" />;
      case 'all-tasks':
        return <TasksViewPage scope="all" />;
      case 'completed':
        return <TasksViewPage scope="completed" />;
      case 'calendar':
        return <CalendarPage />;
      case 'projects':
        return <ProjectsPage />;
      case 'habits':
        return <HabitsPage />;
      case 'focus':
        return <FocusPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FB] dark:bg-[#111216] text-zinc-900 dark:text-zinc-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Overlays */}
      <QuickAddModal />
      <TaskModal />
      <CommandPalette />
      <AiAssistantDrawer />
      <ConfirmModal />
      <UndoToast />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { authChecked, authUser, guestMode } = useFocusFlow();

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB] dark:bg-[#111216] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          <span>Loading Focus Flow...</span>
        </div>
      </div>
    );
  }

  if (!authUser && !guestMode) {
    return <LoginPage />;
  }

  return <WorkspaceShell />;
};

export default function App() {
  return (
    <FocusFlowProvider>
      <AuthGate />
    </FocusFlowProvider>
  );
}
