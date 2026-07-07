import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './common/LanguageSwitcher';

export default function Layout() {
  const { t } = useTranslation();
  const { username, logout } = useAuth();

  const TABS = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/console', label: t('nav.console') },
    { to: '/ssh', label: t('nav.ssh') },
    { to: '/sftp', label: t('nav.sftp') },
    { to: '/plugins', label: t('nav.plugins') },
    { to: '/backups', label: t('nav.backups') },
    { to: '/scheduler', label: t('nav.scheduler') },
    { to: '/server-properties', label: t('nav.serverProperties') },
    { to: '/whitelist', label: t('nav.whitelist') },
    { to: '/ops', label: t('nav.ops') },
    { to: '/motd', label: t('nav.motd') },
  ];

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
