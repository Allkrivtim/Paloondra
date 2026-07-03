import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/errors';
import Spinner from './common/Spinner';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, t('login.loginFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-panel-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-panel-border bg-panel-surface p-8 shadow-xl"
      >
        <h1 className="mb-1 text-xl font-semibold text-panel-text">{t('app.name')}</h1>
        <p className="mb-6 text-sm text-panel-muted">{t('login.subtitle')}</p>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">
          {t('login.username')}
        </label>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          type="text"
          autoComplete="username"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">
          {t('login.password')}
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          type="password"
          autoComplete="current-password"
        />

        {error && (
          <div className="mb-4 rounded-lg border border-panel-danger/40 bg-panel-danger/10 px-3 py-2 text-sm text-panel-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4 text-black" />}
          {submitting ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>
    </div>
  );
}
