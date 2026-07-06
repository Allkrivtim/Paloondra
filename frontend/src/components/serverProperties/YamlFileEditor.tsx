import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import '../../monacoSetup';
import { load as loadYaml } from 'js-yaml';
import { useTranslation } from 'react-i18next';
import { getServerFile, saveServerFileFields, saveServerFileRaw } from '../../api/serverFiles';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { ServerFileKey } from '../../types';
import Spinner from '../common/Spinner';
import RestartBanner from '../common/RestartBanner';
import { fieldKeySegment, SERVER_FILE_SECTIONS, ServerFieldMeta } from './knownServerFileFields';

interface Props {
  fileKey: ServerFileKey;
}

type Mode = 'form' | 'raw';

const DEFAULT_FILENAMES: Record<ServerFileKey, string> = {
  bukkit: 'bukkit.yml',
  spigot: 'spigot.yml',
};

export default function YamlFileEditor({ fileKey }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('form');
  const [filename, setFilename] = useState(DEFAULT_FILENAMES[fileKey]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Form mode state
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Raw mode state
  const [raw, setRaw] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const doc = await getServerFile(fileKey);
      setFilename(doc.filename);
      setRaw(doc.raw);
      setValues(doc.values);
      setTouched(new Set());
      setRawDirty(false);
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

  function setFieldValue(path: string, value: unknown) {
    setValues((prev) => ({ ...prev, [path]: value }));
    setTouched((prev) => new Set(prev).add(path));
  }

  function handleRawChange(value: string | undefined) {
    const next = value ?? '';
    setRaw(next);
    setRawDirty(true);
    try {
      loadYaml(next);
      setYamlError(null);
    } catch (err) {
      setYamlError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const doc =
        mode === 'raw'
          ? await saveServerFileRaw(fileKey, raw)
          : await saveServerFileFields(fileKey, Object.fromEntries([...touched].map((p) => [p, values[p]])));
      setFilename(doc.filename);
      setRaw(doc.raw);
      setValues(doc.values);
      setTouched(new Set());
      setRawDirty(false);
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

  function renderField(meta: ServerFieldMeta) {
    const key = fieldKeySegment(meta.path);
    const labelKey = `serverConfig.fields.${fileKey}.${key}.label`;
    const descriptionKey = `serverConfig.fields.${fileKey}.${key}.description`;
    const current = values[meta.path];
    const isSet = current !== undefined;

    return (
      <div key={meta.path} className="rounded-xl border border-panel-border bg-panel-surface p-3">
        <label className="mb-1 block text-xs font-medium text-panel-muted">{t(labelKey)}</label>
        {meta.type === 'boolean' ? (
          <label className="flex items-center gap-2 text-sm text-panel-text">
            <input
              type="checkbox"
              checked={Boolean(isSet ? current : meta.default)}
              onChange={(e) => setFieldValue(meta.path, e.target.checked)}
              className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
            />
            {isSet ? (current ? t('common.enabled') : t('common.disabled')) : t('serverConfig.usingDefault')}
          </label>
        ) : meta.type === 'enum' ? (
          <select
            value={isSet ? String(current) : String(meta.default)}
            onChange={(e) => setFieldValue(meta.path, e.target.value)}
            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
          >
            {meta.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={meta.type === 'number' ? 'number' : 'text'}
            value={isSet ? String(current) : ''}
            placeholder={String(meta.default)}
            onChange={(e) => {
              if (meta.type === 'number') {
                const n = e.target.valueAsNumber;
                if (!Number.isNaN(n)) setFieldValue(meta.path, n);
              } else {
                setFieldValue(meta.path, e.target.value);
              }
            }}
            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
        )}
        <div className="mt-1 text-[11px] text-panel-muted">{t(descriptionKey)}</div>
        <div className="mt-1 font-mono text-[10px] text-panel-muted">{meta.path}</div>
      </div>
    );
  }

  const dirty = mode === 'raw' ? rawDirty : touched.size > 0;
  const saveDisabled = saving || loading || !dirty || (mode === 'raw' && !!yamlError);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold text-panel-text">{filename}</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-panel-border p-0.5 text-xs">
            {(['form', 'raw'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 transition ${
                  mode === m ? 'bg-panel-accent2 text-black' : 'text-panel-muted hover:text-panel-text'
                }`}
              >
                {m === 'form' ? t('serverProperties.form') : t('serverProperties.raw')}
              </button>
            ))}
          </div>
          {mode === 'raw' && yamlError && (
            <span className="max-w-md truncate text-xs text-panel-danger" title={yamlError}>
              {t('serverConfig.invalidYaml', { error: yamlError })}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saveDisabled}
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

      {!loading && !loadError && mode === 'raw' && (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-panel-border">
          <Editor
            language="yaml"
            theme="vs-dark"
            value={raw}
            onChange={handleRawChange}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        </div>
      )}

      {!loading && !loadError && mode === 'form' && (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {SERVER_FILE_SECTIONS[fileKey].map((section) => (
            <div key={section.id} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-panel-text">
                {t(`serverConfig.sections.${fileKey}.${section.id}`)}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{section.fields.map(renderField)}</div>
            </div>
          ))}
          <p className="mt-2 text-xs text-panel-muted">{t('serverConfig.otherKeysNotice')}</p>
        </div>
      )}
    </div>
  );
}
