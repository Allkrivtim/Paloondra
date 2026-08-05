import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { PermissionKey } from '../types';
import LanguageSwitcher from './common/LanguageSwitcher';

export default function Layout() {
  const { t } = useTranslation();
  const { username, isAdmin, hasPermission, logout } = useAuth();

  const ALL_TABS: { to: string; label: string; end?: boolean; permission?: PermissionKey }[] = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/console', label: t('nav.console'), permission: 'console' },
    { to: '/ssh', label: t('nav.ssh'), permission: 'ssh' },
    { to: '/sftp', label: t('nav.sftp'), permission: 'sftp' },
    { to: '/plugins', label: t('nav.plugins'), permission: 'plugins' },
    { to: '/backups', label: t('nav.backups'), permission: 'backups' },
    { to: '/scheduler', label: t('nav.scheduler'), permission: 'scheduler' },
    { to: '/server-properties', label: t('nav.serverProperties'), permission: 'serverConfig' },
    { to: '/whitelist', label: t('nav.whitelist'), permission: 'whitelist' },
    { to: '/ops', label: t('nav.ops'), permission: 'ops' },
    { to: '/motd', label: t('nav.motd'), permission: 'motd' },
    // Only admins can manage other accounts - hidden here for everyone
    // else, but the real enforcement is server-side (requireAdmin on
    // every /api/users route), not this UI-level hiding.
    ...(isAdmin ? [{ to: '/users', label: t('nav.users') }] : []),
  ];
  // Same story as the admin-only Users entry above: hiding a tab here is
  // just UX, the real gate is requirePermission on the backend routes.
  const TABS = ALL_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));

  return (
    <div className="flex h-full flex-col bg-panel-bg">
      <header className="flex items-center justify-between border-b border-panel-border bg-panel-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-panel-text sm:text-base">{t('app.name')}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-panel-muted">
          <LanguageSwitcher />
          <span className="hidden sm:inline">{username}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-danger hover:text-panel-danger"
          >
            {t('header.logout')}
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
