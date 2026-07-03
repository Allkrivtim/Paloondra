import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../api/errors';
import Spinner from '../common/Spinner';
import { monacoLanguageFor } from './format';

interface Props {
  path: string;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export default function FileEditor({ path, initialContent, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
      setDirty(false);
    } catch (err) {
      setError(getErrorMessage(err, t('fileEditor.failedToSave')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-full max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-panel-border bg-panel-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
          <div className="truncate font-mono text-sm text-panel-text">
            {path}
            {dirty && <span className="ml-2 text-panel-warn">●</span>}
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-panel-danger">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
            >
              {saving && <Spinner className="h-3 w-3 text-black" />}
              {saving ? t('fileEditor.saving') : t('fileEditor.save')}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-panel-border px-3 py-1.5 text-xs text-panel-text transition hover:border-panel-danger hover:text-panel-danger"
            >
              {t('fileEditor.close')}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Editor
            path={path}
            defaultLanguage={monacoLanguageFor(path)}
            value={content}
            theme="vs-dark"
            onChange={(value) => {
              setContent(value ?? '');
              setDirty(true);
            }}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        </div>
      </div>
    </div>
  );
}
