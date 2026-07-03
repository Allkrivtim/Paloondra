import { useTranslation } from 'react-i18next';
import Spinner from '../common/Spinner';

interface Props {
  onRestart: () => void;
  restarting: boolean;
  onDismiss: () => void;
}

export default function RestartBanner({ onRestart, restarting, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-panel-warn/40 bg-panel-warn/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-panel-warn">
        <span>⚠️</span>
        <span>{t('plugins.restartBannerMessage')}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRestart}
          disabled={restarting}
          className="flex items-center gap-1.5 rounded-lg bg-panel-warn px-3 py-1.5 text-xs font-medium text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {restarting && <Spinner className="h-3 w-3 text-black" />}
          {restarting ? t('plugins.restarting') : t('plugins.restartNow')}
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-panel-muted underline hover:text-panel-text"
        >
          {t('common.dismiss')}
        </button>
      </div>
    </div>
  );
}
