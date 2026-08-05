import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createUser, deleteUser, getUsers, resetUserPassword, setUserPermissions, setUserRole } from '../../api/users';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import { AppUser, PERMISSION_KEYS, PermissionKey, UserRole } from '../../types';
import Spinner from '../common/Spinner';

const ROLES: UserRole[] = ['admin', 'user'];

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function togglePermission(current: PermissionKey[], key: PermissionKey): PermissionKey[] {
  return current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
}

export default function Users() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const { username: myUsername } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('user');
  // New "user" accounts default to every permission checked - matches what
  // "user" meant before granular permissions existed, so restriction is
  // opt-in (uncheck things), not accidental.
  const [permissionsInput, setPermissionsInput] = useState<PermissionKey[]>([...PERMISSION_KEYS]);
  const [adding, setAdding] = useState(false);

  // Which row's permission editor is expanded - only one at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PermissionKey[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('users.failedToLoad')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function withBusy(key: string, action: () => Promise<void>) {
    setBusy((prev) => new Set(prev).add(key));
    try {
      await action();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = usernameInput.trim();
    if (!name || !passwordInput) return;
    setAdding(true);
    try {
      const user = await createUser(name, passwordInput, roleInput, roleInput === 'user' ? permissionsInput : undefined);
      setUsers((prev) => [...prev, user]);
      setUsernameInput('');
      setPasswordInput('');
      setRoleInput('user');
      setPermissionsInput([...PERMISSION_KEYS]);
      toast.success(t('users.addedToast', { name: user.username }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('users.failedToAdd')));
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(user: AppUser, role: UserRole) {
    if (role === user.role) return;
    await withBusy(user.id, async () => {
      try {
        const updated = await setUserRole(user.id, role);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(t('users.roleChangedToast', { name: updated.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('users.failedToChangeRole')));
      }
    });
  }

  async function handleResetPassword(user: AppUser) {
    const password = await dialog.prompt({
      title: t('users.resetPasswordTitle', { name: user.username }),
      placeholder: t('users.resetPasswordPlaceholder'),
      confirmLabel: t('users.resetPasswordConfirm'),
      type: 'password',
    });
    if (!password) return;
    await withBusy(user.id, async () => {
      try {
        await resetUserPassword(user.id, password);
        toast.success(t('users.passwordResetToast', { name: user.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('users.failedToResetPassword')));
      }
    });
  }

  async function handleRemove(user: AppUser) {
    const confirmed = await dialog.confirm({
      title: t('users.removeTitle', { name: user.username }),
      confirmLabel: t('users.remove'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(user.id, async () => {
      try {
        await deleteUser(user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        toast.success(t('users.removedToast', { name: user.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('users.failedToRemove')));
      }
    });
  }

  function startEditingPermissions(user: AppUser) {
    setEditingId(user.id);
    setEditingPermissions(user.permissions);
  }

  async function handleSavePermissions(user: AppUser) {
    await withBusy(user.id, async () => {
      try {
        const updated = await setUserPermissions(user.id, editingPermissions);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setEditingId(null);
        toast.success(t('users.permissionsChangedToast', { name: updated.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('users.failedToChangePermissions')));
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-sm font-semibold text-panel-text">{t('users.title')}</h1>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel-surface p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder={t('users.addUsernamePlaceholder')}
            className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={t('users.addPasswordPlaceholder')}
            className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <select
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value as UserRole)}
            className="rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`users.role.${role}`)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding || !usernameInput.trim() || !passwordInput}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {adding && <Spinner className="h-3.5 w-3.5 text-black" />}
            {t('users.add')}
          </button>
        </div>

        {/* Permissions only apply to 'user' accounts - admins always have full access, so the grid is pointless (and hidden) for role: 'admin'. */}
        {roleInput === 'user' && (
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-panel-muted">
              {t('users.permissionsLabel')}
            </div>
            <PermissionGrid value={permissionsInput} onChange={setPermissionsInput} />
          </div>
        )}
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('users.loading')}
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="max-w-sm text-sm text-panel-danger">{loadError}</p>
            <button
              onClick={refresh}
              className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
            >
              {t('users.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && users.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">👤</span>
            <p className="text-sm">{t('users.noEntriesTitle')}</p>
            <p className="text-xs">{t('users.noEntriesHint')}</p>
          </div>
        )}

        {!loading && !loadError && users.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('users.columnUsername')}</th>
                <th className="px-4 py-2 font-medium">{t('users.columnRole')}</th>
                <th className="px-4 py-2 font-medium">{t('users.columnPermissions')}</th>
                <th className="px-4 py-2 font-medium">{t('users.columnCreated')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('users.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isBusy = busy.has(user.id);
                const isSelf = user.username === myUsername;
                const isLastAdmin = user.role === 'admin' && adminCount <= 1;
                const isEditing = editingId === user.id;
                return (
                  <Fragment key={user.id}>
                    <tr
                      className={`border-t border-panel-border transition hover:bg-panel-surface2 ${
                        isBusy ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-panel-text">
                        <div className="flex items-center gap-2">
                          {user.username}
                          {isSelf && <span className="text-xs text-panel-muted">{t('users.you')}</span>}
                          {isBusy && <Spinner className="h-3 w-3" />}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          disabled={isBusy || isLastAdmin}
                          title={isLastAdmin ? t('users.lastAdminHint') : undefined}
                          className="rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent disabled:opacity-50"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(`users.role.${role}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {user.role === 'admin' ? (
                          <span className="text-panel-muted">{t('users.fullAccess')}</span>
                        ) : (
                          <button
                            onClick={() => (isEditing ? setEditingId(null) : startEditingPermissions(user))}
                            disabled={isBusy}
                            className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                          >
                            {t('users.permissionsCount', { count: user.permissions.length, total: PERMISSION_KEYS.length })}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-panel-muted">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-3 text-xs">
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={isBusy}
                            className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                          >
                            {t('users.resetPassword')}
                          </button>
                          <button
                            onClick={() => handleRemove(user)}
                            disabled={isBusy || isSelf || isLastAdmin}
                            title={isSelf ? t('users.cantRemoveSelfHint') : isLastAdmin ? t('users.lastAdminHint') : undefined}
                            className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                          >
                            {t('users.remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="border-t border-panel-border bg-panel-surface2/50">
                        <td colSpan={5} className="px-4 py-3">
                          <PermissionGrid value={editingPermissions} onChange={setEditingPermissions} />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={isBusy}
                              className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent disabled:opacity-50"
                            >
                              {t('users.cancel')}
                            </button>
                            <button
                              onClick={() => handleSavePermissions(user)}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
                            >
                              {isBusy && <Spinner className="h-3 w-3 text-black" />}
                              {t('users.savePermissions')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PermissionGrid({ value, onChange }: { value: PermissionKey[]; onChange: (next: PermissionKey[]) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
      {PERMISSION_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-panel-text">
          <input
            type="checkbox"
            checked={value.includes(key)}
            onChange={() => onChange(togglePermission(value, key))}
            className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
          />
          {t(`users.permission.${key}`)}
        </label>
      ))}
    </div>
  );
}
