import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listUsers, getUser } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { LuckPermsUser } from '../../types';
import Spinner from '../common/Spinner';

const PAGE_SIZE = 25;

interface Props {
  onSelectUser: (uniqueId: string, username?: string) => void;
}

interface Row {
  uniqueId: string;
  user: LuckPermsUser | null;
}

/**
 * GET /user only returns bare UUIDs - no usernames, no pagination. Rather
 * than resolving all of them up front (one GET /user/:id per account,
 * which could be hundreds of requests on a real server), this fetches the
 * full id list once for the count/paging math, then only resolves
 * usernames for whichever page is actually being looked at.
 */
export default function UsersBrowserPanel({ onSelectUser }: Props) {
  const { t } = useTranslation();
  const [allIds, setAllIds] = useState<string[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    listUsers()
      .then(setAllIds)
      .catch((err) => setListError(getErrorMessage(err, t('luckperms.failedToLoadUsers'))));
  }, [t]);

  const loadPage = useCallback(
    async (ids: string[], pageIndex: number) => {
      const pageIds = ids.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
      setResolving(true);
      const results = await Promise.all(
        pageIds.map(async (uniqueId) => {
          try {
            return { uniqueId, user: await getUser(uniqueId) };
          } catch {
            // A listed id whose own record 404s/errors - rare, but shouldn't take the whole page down.
            return { uniqueId, user: null };
          }
        }),
      );
      setRows(results);
      setResolving(false);
    },
    [],
  );

  useEffect(() => {
    if (allIds) loadPage(allIds, page);
  }, [allIds, page, loadPage]);

  if (listError) {
    return <p className="p-4 text-sm text-panel-danger">{listError}</p>;
  }
  if (!allIds) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
        <Spinner /> {t('luckperms.loading')}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(allIds.length / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-panel-text">{t('luckperms.allUsersTitle')}</h2>
        <p className="mt-1 text-xs text-panel-muted">{t('luckperms.allUsersHint', { count: allIds.length })}</p>
      </div>

      <div className="rounded-xl border border-panel-border bg-panel-surface">
        {resolving ? (
          <div className="flex items-center justify-center gap-2 py-12 text-panel-muted">
            <Spinner /> {t('luckperms.loading')}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-panel-muted">{t('luckperms.noUsers')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('luckperms.columnUsername')}</th>
                <th className="px-4 py-2 font-medium">{t('luckperms.primaryGroup')}</th>
                <th className="px-4 py-2 font-medium">{t('luckperms.columnUniqueId')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.uniqueId}
                  onClick={() => onSelectUser(row.uniqueId, row.user?.username)}
                  className="cursor-pointer border-t border-panel-border transition hover:bg-panel-surface2"
                >
                  <td className="px-4 py-2 text-panel-text">{row.user?.username ?? t('luckperms.unknownUser')}</td>
                  <td className="px-4 py-2 font-mono text-xs text-panel-muted">{row.user?.metadata.primaryGroup ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-panel-muted">{row.uniqueId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || resolving}
          className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
        >
          {t('luckperms.prevPage')}
        </button>
        <span className="text-xs text-panel-muted">{t('luckperms.pageOf', { page: page + 1, total: totalPages })}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1 || resolving}
          className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
        >
          {t('luckperms.nextPage')}
        </button>
      </div>
    </div>
  );
}
