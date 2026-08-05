import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import '../../monacoSetup';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../api/errors';
import Spinner from '../common/Spinner';
import { isMarkdownFile, monacoLanguageFor } from './format';

interface Props {
  path: string;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

type ViewMode = 'read' | 'edit';

export default function FileEditor({ path, initialContent, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isMarkdown = isMarkdownFile(path);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // .md files open read-first - that's the point of this view for anyone
  // who just wants to read a README/changelog rather than edit it. Every
  // other file type has no toggle at all and behaves exactly as before.
  const [mode, setMode] = useState<ViewMode>(isMarkdown ? 'read' : 'edit');

  // marked() parses the CURRENT (possibly unsaved) content, so switching to
  // Read after editing acts as a live preview rather than only reflecting
  // what's on disk. Sanitized with DOMPurify before ever touching the DOM -
  // markdown can embed raw HTML, and this content comes from files on the
  // managed server, not something to trust blindly (a malicious plugin
  // README, or a file dropped in by a restricted user, is enough).
  const renderedHtml = useMemo(() => {
    if (!isMarkdown || mode !== 'read') return '';
    return DOMPurify.sanitize(marked.parse(content, { async: false }));
  }, [isMarkdown, mode, content]);

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
          <div className="flex min-w-0 items-center gap-3">
            <div className="truncate font-mono text-sm text-panel-text">
              {path}
              {dirty && <span className="ml-2 text-panel-warn">●</span>}
            </div>
            {isMarkdown && (
              <div className="flex shrink-0 rounded-lg border border-panel-border p-0.5 text-xs">
                <button
                  onClick={() => setMode('read')}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    mode === 'read' ? 'bg-panel-accent2 text-black' : 'text-panel-muted hover:text-panel-text'
                  }`}
                >
                  {t('fileEditor.readMode')}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    mode === 'edit' ? 'bg-panel-accent2 text-black' : 'text-panel-muted hover:text-panel-text'
                  }`}
                >
                  {t('fileEditor.editMode')}
                </button>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
          {mode === 'read' ? (
            <div
              className="markdown-body h-full overflow-auto px-6 py-4 text-sm text-panel-text"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
