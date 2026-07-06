import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import '../../monacoSetup';
import { load as loadYaml } from 'js-yaml';
import { useTranslation } from 'react-i18next';
import { getServerFile, saveServerFile } from '../../api/serverFiles';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { ServerFileKey } from '../../types';
import Spinner from '../common/Spinner';
import RestartBanner from '../common/RestartBanner';

interface Props {
  fileKey: ServerFileKey;
}

const DEFAULT_FILENAMES: Record<ServerFileKey, string> = {
  bukkit: 'bukkit.yml',
  spigot: 'spigot.yml',
};

export default function YamlFileEditor({ fileKey }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [filename, setFilename] = useState(DEFAULT_FILENAMES[fileKey]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const doc = await getServerFile(fileKey);
      setFilename(doc.filename);
      setContent(doc.raw);
      setDirty(false);
      setYamlError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, t('serverConfig.failedToLoadFile')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    setNeedsRestart(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  function handleChange(value: string | undefined) {
    const next = value ?? '';
    setContent(next);
    setDirty(true);
    try {
      loadYaml(next);
      setYamlError(null);
    } catch (err) {
      setYamlError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSave() {
    if (yamlError) return;
    setSaving(true);
    try {
      const doc = await saveServerFile(fileKey, content);
      setContent(doc.raw);
      setDirty(false);
      setNeedsRestart(true);
      toast.success(t('serverConfig.saved', { filename: doc.filename }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('serverConfig.failedToSaveFile')));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      await api.post('/server/restart');
      toast.success(t('serverConfig.restartTriggered'));
      setNeedsRestart(false);
    } catch (err) {
      toast.error(getErrorMessage(err, t('serverConfig.failedToTriggerRestart')));
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold text-panel-text">{filename}</h2>
        <div className="flex items-center gap-3">
          {yamlError && (
            <span className="max-w-md truncate text-xs text-panel-danger" title={yamlError}>
              {t('serverConfig.invalidYaml', { error: yamlError })}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty || !!yamlError}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {saving && <Spinner className="h-3 w-3 text-black" />}
            {t('serverConfig.save')}
          </button>
        </div>
      </div>

      {needsRestart && (
        <RestartBanner
          message={t('serverConfig.restartRequiredMessage')}
          onRestart={handleRestart}
          restarting={restarting}
          onDismiss={() => setNeedsRestart(false)}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
          <Spinner /> {t('serverConfig.loading')}
        </div>
      )}

      {!loading && loadError && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="max-w-sm text-sm text-panel-danger">{loadError}</p>
          <button
            onClick={load}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
          >
            {t('serverConfig.retry')}
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-panel-border">
          <Editor
            language="yaml"
            theme="vs-dark"
            value={content}
            onChange={handleChange}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        </div>
      )}
    </div>
  );
}
