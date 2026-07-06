import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DialogProvider } from './context/DialogContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Spinner from './components/common/Spinner';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/tabs/Dashboard';
import RconConsole from './components/tabs/RconConsole';

// Lazy-loaded: none of these are needed for the initial Dashboard render,
// so they're split into their own chunks and fetched on first visit.
const SshTerminal = lazy(() => import('./components/tabs/SshTerminal'));
const SftpManager = lazy(() => import('./components/tabs/SftpManager'));
const Plugins = lazy(() => import('./components/tabs/Plugins'));
const Backups = lazy(() => import('./components/tabs/Backups'));
const ScheduledTasks = lazy(() => import('./components/tabs/ScheduledTasks'));
const ServerProperties = lazy(() => import('./components/tabs/ServerProperties'));
const Whitelist = lazy(() => import('./components/tabs/Whitelist'));
const Ops = lazy(() => import('./components/tabs/Ops'));

function TabFallback() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-panel-muted">
      <Spinner /> Loading...
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="rcon" element={<RconConsole />} />
              <Route
                path="ssh"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <SshTerminal />
                  </Suspense>
                }
              />
              <Route
                path="sftp"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <SftpManager />
                  </Suspense>
                }
              />
              <Route
                path="plugins"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <Plugins />
                  </Suspense>
                }
              />
              <Route
                path="backups"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <Backups />
                  </Suspense>
                }
              />
              <Route
                path="scheduler"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <ScheduledTasks />
                  </Suspense>
                }
              />
              <Route
                path="server-properties"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <ServerProperties />
                  </Suspense>
                }
              />
              <Route
                path="whitelist"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <Whitelist />
                  </Suspense>
                }
              />
              <Route
                path="ops"
                element={
                  <Suspense fallback={<TabFallback />}>
                    <Ops />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
