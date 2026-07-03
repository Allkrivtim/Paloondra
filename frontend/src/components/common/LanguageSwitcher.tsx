import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';

const LABELS: Record<string, string> = {
  en: 'EN',
  ru: 'RU',
};

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-panel-border p-0.5 text-xs" aria-label={t('header.language')}>
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`rounded-md px-2 py-1 font-medium transition ${
            current?.startsWith(lng) ? 'bg-panel-accent2 text-black' : 'text-panel-muted hover:text-panel-text'
          }`}
        >
          {LABELS[lng]}
        </button>
      ))}
    </div>
  );
}
