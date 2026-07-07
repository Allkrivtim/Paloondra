import { useTranslation } from 'react-i18next';

const PREVIEW_URL = 'https://webui.adventure.kyori.net/';

/**
 * A short legend for MiniMessage tags plus a link to Kyori's own web
 * preview - deliberately NOT a live in-app render of Minecraft-accurate
 * formatting, just a pointer to the real thing and a reminder of the
 * common tags so users aren't left guessing at the raw string they typed.
 */
export default function MiniMessageHint() {
  const { t } = useTranslation();
  return (
    <p className="text-[11px] text-panel-muted">
      {t('motd.miniMessageHint')}{' '}
      <code className="rounded bg-panel-surface2 px-1 py-0.5">{'<green>'}</code>{' '}
      <code className="rounded bg-panel-surface2 px-1 py-0.5">{'<gradient:#aaa:#bbb>'}</code>{' '}
      <code className="rounded bg-panel-surface2 px-1 py-0.5">{'<bold>'}</code>{' '}
      <code className="rounded bg-panel-surface2 px-1 py-0.5">{'&#RRGGBB'}</code> -{' '}
      <a
        href={PREVIEW_URL}
        target="_blank"
        rel="noreferrer"
        className="text-panel-accent underline hover:text-panel-accent2"
      >
        {t('motd.miniMessagePreviewLink')}
      </a>
    </p>
  );
}
