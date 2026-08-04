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
import Console from './components/tabs/Console';

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
const Motd = lazy(() => import('./components/tabs/Motd'));
const Users = lazy(() => import('./components/tabs/Users'));

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
              <Route
                path="console"
                element={
                  <ProtectedRoute permission="console">
                    <Console />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ssh"
                element={
                  <ProtectedRoute permission="ssh">
                    <Suspense fallback={<TabFallback />}>
                      <SshTerminal />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="sftp"
                element={
                  <ProtectedRoute permission="sftp">
                    <Suspense fallback={<TabFallback />}>
                      <SftpManager />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="plugins"
                element={
                  <ProtectedRoute permission="plugins">
                    <Suspense fallback={<TabFallback />}>
                      <Plugins />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="backups"
                element={
                  <ProtectedRoute permission="backups">
                    <Suspense fallback={<TabFallback />}>
                      <Backups />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="scheduler"
                element={
                  <ProtectedRoute permission="scheduler">
                    <Suspense fallback={<TabFallback />}>
                      <ScheduledTasks />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="server-properties"
                element={
                  <ProtectedRoute permission="serverConfig">
                    <Suspense fallback={<TabFallback />}>
                      <ServerProperties />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="whitelist"
                element={
                  <ProtectedRoute permission="whitelist">
                    <Suspense fallback={<TabFallback />}>
                      <Whitelist />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="ops"
                element={
                  <ProtectedRoute permission="ops">
                    <Suspense fallback={<TabFallback />}>
                      <Ops />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="motd"
                element={
                  <ProtectedRoute permission="motd">
                    <Suspense fallback={<TabFallback />}>
                      <Motd />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute adminOnly>
                    <Suspense fallback={<TabFallback />}>
                      <Users />
                    </Suspense>
                  </ProtectedRoute>
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
