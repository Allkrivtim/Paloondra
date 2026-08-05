import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsPermissionCheckResult } from '../../types';
import { getErrorMessage } from '../../api/errors';
import Spinner from '../common/Spinner';

interface Props {
  checkFn: (key: string) => Promise<LuckPermsPermissionCheckResult>;
}

/** Small utility panel using the REST API's own permission-check endpoint - handy for "does this player actually have X" without hunting through inherited groups by hand. */
export default function PermissionCheckPanel({ checkFn }: Props) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<LuckPermsPermissionCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      setResult(await checkFn(key.trim()));
    } catch (err) {
      setError(getErrorMessage(err, t('luckperms.checkFailed')));
    } finally {
      setChecking(false);
    }
  }

  const badge =
    result?.result === 'true'
      ? { label: t('luckperms.checkAllowed'), cls: 'bg-panel-accent2/20 text-panel-accent' }
      : result?.result === 'false'
        ? { label: t('luckperms.checkDenied'), cls: 'bg-panel-danger/20 text-panel-danger' }
        : result
          ? { label: t('luckperms.checkUndefined'), cls: 'bg-panel-surface2 text-panel-muted' }
          : null;

  return (
    <form onSubmit={handleCheck} className="flex flex-wrap items-center gap-2">
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={t('luckperms.checkPlaceholder')}
        className="min-w-[14rem] flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
      />
      <button
        type="submit"
        disabled={checking || !key.trim()}
        className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
      >
        {checking && <Spinner className="h-3 w-3" />}
        {t('luckperms.check')}
      </button>
      {badge && <span className={`rounded px-2 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>}
      {error && <span className="text-xs text-panel-danger">{error}</span>}
    </form>
  );
}
