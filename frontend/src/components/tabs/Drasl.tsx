import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getHealth,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listInvites,
  createInvite,
  deleteInvite,
} from '../../api/drasl';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { DraslInvite, DraslUser } from '../../types';
import Spinner from '../common/Spinner';

type SubTab = 'users' | 'invites';
type HealthState = { configured: boolean; ok: boolean } | null;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Drasl() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();

  const [health, setHealth] = useState<HealthState>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [tab, setTab] = useState<SubTab>('users');

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      setHealth(await getHealth());
    } catch {
      setHealth({ configured: true, ok: false });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  if (checkingHealth) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-panel-muted">
        <Spinner /> {t('drasl.loading')}
      </div>
    );
  }

  if (!health?.configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-panel-muted">
        <span className="text-3xl">🔒</span>
        <p className="text-sm font-medium text-panel-text">{t('drasl.notConfiguredTitle')}</p>
        <p className="max-w-md text-xs">{t('drasl.notConfiguredHint')}</p>
      </div>
    );
  }

  if (!health.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-panel-muted">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm font-medium text-panel-text">{t('drasl.unreachableTitle')}</p>
        <p className="max-w-md text-xs">{t('drasl.unreachableHint')}</p>
        <button
          onClick={checkHealth}
          className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex gap-1 border-b border-panel-border">
        <button
          onClick={() => setTab('users')}
          className={`px-3 py-2 text-sm font-medium transition ${
            tab === 'users' ? 'border-b-2 border-panel-accent text-panel-accent' : 'text-panel-muted hover:text-panel-text'
          }`}
        >
          {t('drasl.tabUsers')}
        </button>
        <button
          onClick={() => setTab('invites')}
          className={`px-3 py-2 text-sm font-medium transition ${
            tab === 'invites' ? 'border-b-2 border-panel-accent text-panel-accent' : 'text-panel-muted hover:text-panel-text'
          }`}
        >
          {t('drasl.tabInvites')}
        </button>
      </div>

      {tab === 'users' && <UsersTab toast={toast} dialog={dialog} t={t} />}
      {tab === 'invites' && <InvitesTab toast={toast} dialog={dialog} t={t} />}
    </div>
  );
}

// The toast/dialog/t types below come straight from the hooks above -
// letting TS infer them here rather than importing three separate context
// types just to name these two small sub-components' props.
type Toast = ReturnType<typeof useToast>;
type Dialog = ReturnType<typeof useDialog>;
type T = ReturnType<typeof useTranslation>['t'];

function UsersTab({ toast, dialog, t }: { toast: Toast; dialog: Dialog; t: T }) {
  const [users, setUsers] = useState<DraslUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAdminInput, setIsAdminInput] = useState(false);
  const [isLockedInput, setIsLockedInput] = useState(false);
  const [adding, setAdding] = useState(false);

  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editIsLocked, setEditIsLocked] = useState(false);
  const [editMaxPlayerCount, setEditMaxPlayerCount] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('drasl.failedToLoadUsers')));
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = usernameInput.trim();
    if (!name) return;
    setAdding(true);
    try {
      const user = await createUser({
        username: name,
        password: passwordInput || undefined,
        isAdmin: isAdminInput,
        isLocked: isLockedInput,
      });
      setUsers((prev) => [...prev, user]);
      setUsernameInput('');
      setPasswordInput('');
      setIsAdminInput(false);
      setIsLockedInput(false);
      toast.success(t('drasl.userCreatedToast', { username: user.username }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('drasl.failedToCreateUser')));
    } finally {
      setAdding(false);
    }
  }

  function startEditing(user: DraslUser) {
    setEditingUuid(user.uuid);
    setEditIsAdmin(user.isAdmin);
    setEditIsLocked(user.isLocked);
    setEditMaxPlayerCount(String(user.maxPlayerCount));
  }

  async function handleSaveEdit(user: DraslUser) {
    await withBusy(user.uuid, async () => {
      try {
        const maxPlayerCount = Number(editMaxPlayerCount);
        const updated = await updateUser(user.uuid, {
          isAdmin: editIsAdmin,
          isLocked: editIsLocked,
          maxPlayerCount: Number.isFinite(maxPlayerCount) ? maxPlayerCount : undefined,
        });
        setUsers((prev) => prev.map((u) => (u.uuid === updated.uuid ? updated : u)));
        setEditingUuid(null);
        toast.success(t('drasl.userUpdatedToast', { username: updated.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('drasl.failedToUpdateUser')));
      }
    });
  }

  async function handleResetPassword(user: DraslUser) {
    const password = await dialog.prompt({
      title: t('drasl.resetPasswordTitle', { username: user.username }),
      placeholder: t('drasl.resetPasswordPlaceholder'),
      confirmLabel: t('drasl.resetPasswordConfirm'),
      type: 'password',
    });
    if (!password) return;
    await withBusy(user.uuid, async () => {
      try {
        await updateUser(user.uuid, { password });
        toast.success(t('drasl.passwordResetToast', { username: user.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('drasl.failedToResetPassword')));
      }
    });
  }

  async function handleDelete(user: DraslUser) {
    const confirmed = await dialog.confirm({
      title: t('drasl.deleteUserTitle', { username: user.username }),
      message: t('drasl.deleteUserMessage'),
      confirmLabel: t('drasl.delete'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(user.uuid, async () => {
      try {
        await deleteUser(user.uuid);
        setUsers((prev) => prev.filter((u) => u.uuid !== user.uuid));
        toast.success(t('drasl.userDeletedToast', { username: user.username }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('drasl.failedToDeleteUser')));
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel-surface p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder={t('drasl.addUsernamePlaceholder')}
            className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={t('drasl.addPasswordPlaceholder')}
            className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <button
            type="submit"
            disabled={adding || !usernameInput.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {adding && <Spinner className="h-3.5 w-3.5 text-black" />}
            {t('drasl.add')}
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-panel-text">
            <input
              type="checkbox"
              checked={isAdminInput}
              onChange={(e) => setIsAdminInput(e.target.checked)}
              className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
            />
            {t('drasl.isAdmin')}
          </label>
          <label className="flex items-center gap-2 text-sm text-panel-text">
            <input
              type="checkbox"
              checked={isLockedInput}
              onChange={(e) => setIsLockedInput(e.target.checked)}
              className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
            />
            {t('drasl.isLocked')}
          </label>
        </div>
        <p className="text-xs text-panel-muted">{t('drasl.addPasswordHint')}</p>
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('drasl.loading')}
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
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && users.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">👤</span>
            <p className="text-sm">{t('drasl.noUsers')}</p>
          </div>
        )}

        {!loading && !loadError && users.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('drasl.columnUsername')}</th>
                <th className="px-4 py-2 font-medium">{t('drasl.columnAdmin')}</th>
                <th className="px-4 py-2 font-medium">{t('drasl.columnLocked')}</th>
                <th className="px-4 py-2 font-medium">{t('drasl.columnPlayers')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('drasl.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isBusy = busy.has(user.uuid);
                const isEditing = editingUuid === user.uuid;
                return (
                  <Fragment key={user.uuid}>
                    <tr
                      className={`border-t border-panel-border transition hover:bg-panel-surface2 ${isBusy ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-2 text-panel-text">
                        <div className="flex items-center gap-2">
                          {user.username}
                          {isBusy && <Spinner className="h-3 w-3" />}
                        </div>
                        <div className="font-mono text-xs text-panel-muted">{user.uuid}</div>
                      </td>
                      <td className="px-4 py-2 text-xs text-panel-text">{user.isAdmin ? t('drasl.yes') : t('drasl.no')}</td>
                      <td className="px-4 py-2 text-xs text-panel-text">{user.isLocked ? t('drasl.yes') : t('drasl.no')}</td>
                      <td className="px-4 py-2 text-xs text-panel-muted">
                        {t('drasl.playersCount', { count: user.players.length, max: user.maxPlayerCount })}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-3 text-xs">
                          <button
                            onClick={() => (isEditing ? setEditingUuid(null) : startEditing(user))}
                            disabled={isBusy}
                            className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                          >
                            {t('drasl.edit')}
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={isBusy}
                            className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                          >
                            {t('drasl.resetPassword')}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isBusy}
                            className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                          >
                            {t('drasl.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="border-t border-panel-border bg-panel-surface2/50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex flex-wrap items-end gap-4">
                            <label className="flex items-center gap-2 text-sm text-panel-text">
                              <input
                                type="checkbox"
                                checked={editIsAdmin}
                                onChange={(e) => setEditIsAdmin(e.target.checked)}
                                className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                              />
                              {t('drasl.isAdmin')}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-panel-text">
                              <input
                                type="checkbox"
                                checked={editIsLocked}
                                onChange={(e) => setEditIsLocked(e.target.checked)}
                                className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                              />
                              {t('drasl.isLocked')}
                            </label>
                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-panel-muted">
                                {t('drasl.maxPlayerCount')}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={editMaxPlayerCount}
                                onChange={(e) => setEditMaxPlayerCount(e.target.value)}
                                className="w-24 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              onClick={() => setEditingUuid(null)}
                              disabled={isBusy}
                              className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent disabled:opacity-50"
                            >
                              {t('drasl.cancel')}
                            </button>
                            <button
                              onClick={() => handleSaveEdit(user)}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
                            >
                              {isBusy && <Spinner className="h-3 w-3 text-black" />}
                              {t('drasl.save')}
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

function InvitesTab({ toast, dialog, t }: { toast: Toast; dialog: Dialog; t: T }) {
  const [invites, setInvites] = useState<DraslInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setInvites(await listInvites());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('drasl.failedToLoadInvites')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    setCreating(true);
    try {
      const invite = await createInvite();
      setInvites((prev) => [...prev, invite]);
      toast.success(t('drasl.inviteCreatedToast'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('drasl.failedToCreateInvite')));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(invite: DraslInvite) {
    const confirmed = await dialog.confirm({
      title: t('drasl.revokeInviteTitle'),
      confirmLabel: t('drasl.revoke'),
      danger: true,
    });
    if (!confirmed) return;
    setBusy((prev) => new Set(prev).add(invite.code));
    try {
      await deleteInvite(invite.code);
      setInvites((prev) => prev.filter((i) => i.code !== invite.code));
      toast.success(t('drasl.inviteRevokedToast'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('drasl.failedToRevokeInvite')));
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(invite.code);
        return next;
      });
    }
  }

  async function handleCopy(invite: DraslInvite) {
    try {
      await navigator.clipboard.writeText(invite.url);
      toast.success(t('drasl.inviteCopiedToast'));
    } catch {
      // Clipboard access can be denied by the browser - the URL is still
      // right there in the table to copy by hand, so this isn't fatal.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-panel-border bg-panel-surface p-4">
        <p className="text-xs text-panel-muted">{t('drasl.invitesHint')}</p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {creating && <Spinner className="h-3.5 w-3.5 text-black" />}
          {t('drasl.createInvite')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('drasl.loading')}
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
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && invites.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">✉️</span>
            <p className="text-sm">{t('drasl.noInvites')}</p>
          </div>
        )}

        {!loading && !loadError && invites.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('drasl.columnCode')}</th>
                <th className="px-4 py-2 font-medium">{t('drasl.columnCreated')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('drasl.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const isBusy = busy.has(invite.code);
                return (
                  <tr
                    key={invite.code}
                    className={`border-t border-panel-border transition hover:bg-panel-surface2 ${isBusy ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2 font-mono text-panel-text">{invite.code}</td>
                    <td className="px-4 py-2 text-xs text-panel-muted">{formatDate(invite.createdAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-3 text-xs">
                        <button
                          onClick={() => handleCopy(invite)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {t('drasl.copyLink')}
                        </button>
                        <button
                          onClick={() => handleRevoke(invite)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          {t('drasl.revoke')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
