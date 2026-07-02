import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/tabs/Dashboard';
import RconConsole from './components/tabs/RconConsole';
import Plugins from './components/tabs/Plugins';

// Lazy-loaded: these pull in xterm.js / Monaco, which are large and only
// needed once the user actually visits the SSH or file manager tab.
const SshTerminal = lazy(() => import('./components/tabs/SshTerminal'));
const SftpManager = lazy(() => import('./components/tabs/SftpManager'));

function TabFallback() {
  return <div className="flex h-full items-center justify-center text-panel-muted">Loading...</div>;
}

export default function App() {
  return (
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
          <Route path="plugins" element={<Plugins />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
