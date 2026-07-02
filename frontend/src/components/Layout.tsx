import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/rcon', label: 'RCON Console' },
  { to: '/ssh', label: 'SSH Terminal' },
  { to: '/sftp', label: 'File Manager' },
  { to: '/plugins', label: 'Plugins & Mods' },
  { to: '/backups', label: 'Backups' },
  { to: '/scheduler', label: 'Scheduled Tasks' },
  { to: '/server-properties', label: 'Server Config' },
];

export default function Layout() {
  const { username, logout } = useAuth();

  return (
    <div className="flex h-full flex-col bg-panel-bg">
      <header className="flex items-center justify-between border-b border-panel-border bg-panel-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-panel-text sm:text-base">Paloondra</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-panel-muted">
          <span className="hidden sm:inline">{username}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-danger hover:text-panel-danger"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-panel-border bg-panel-surface px-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-panel-accent text-panel-accent'
                  : 'border-transparent text-panel-muted hover:text-panel-text'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
