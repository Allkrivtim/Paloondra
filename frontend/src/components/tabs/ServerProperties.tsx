import { useEffect, useState } from 'react';
import {
  getServerProperties,
  saveServerProperties,
  saveServerPropertiesRaw,
} from '../../api/serverProperties';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import Spinner from '../common/Spinner';
import { KNOWN_KEYS, KNOWN_PROPERTIES } from '../serverProperties/knownProperties';

type Mode = 'form' | 'raw';

export default function ServerProperties() {
  const toast = useToast();
  const dialog = useDialog();
  const [mode, setMode] = useState<Mode>('form');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState('');
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const doc = await getServerProperties();
      setProperties(doc.properties);
      setRaw(doc.raw);
      setDirty(false);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load server.properties'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setValue(key: string, value: string) {
    setProperties((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function removeOther(key: string) {
    setProperties((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDirty(true);
  }

  async function handleAddProperty() {
    const key = await dialog.prompt({ title: 'Add property', placeholder: 'property-key' });
    if (!key) return;
    if (key in properties) {
      toast.error(`"${key}" already exists`);
      return;
    }
    setValue(key, '');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const doc = mode === 'raw' ? await saveServerPropertiesRaw(raw) : await saveServerProperties(properties);
      setProperties(doc.properties);
      setRaw(doc.raw);
      setDirty(false);
      toast.success('server.properties saved');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save server.properties'));
    } finally {
      setSaving(false);
    }
  }

  const otherKeys = Object.keys(properties)
    .filter((k) => !KNOWN_KEYS.has(k))
    .sort();

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-panel-text">server.properties</h1>
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
                {m === 'form' ? 'Form' : 'Raw'}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {saving && <Spinner className="h-3 w-3 text-black" />}
            Save
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
          <Spinner /> Loading...
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
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && mode === 'raw' && (
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setDirty(true);
          }}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none rounded-xl border border-panel-border bg-black/40 p-4 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
        />
      )}

      {!loading && !loadError && mode === 'form' && (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {KNOWN_PROPERTIES.map((meta) => (
              <div key={meta.key} className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="mb-1 block text-xs font-medium text-panel-muted">{meta.label}</label>
                {meta.type === 'boolean' ? (
                  <select
                    value={properties[meta.key] ?? 'false'}
                    onChange={(e) => setValue(meta.key, e.target.value)}
                    className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : meta.type === 'select' ? (
                  <select
                    value={properties[meta.key] ?? meta.options?.[0] ?? ''}
                    onChange={(e) => setValue(meta.key, e.target.value)}
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
                    value={properties[meta.key] ?? ''}
                    onChange={(e) => setValue(meta.key, e.target.value)}
                    className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                  />
                )}
                <div className="mt-1 font-mono text-[10px] text-panel-muted">{meta.key}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-panel-border bg-panel-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-panel-text">Other properties</h2>
              <button onClick={handleAddProperty} className="text-xs text-panel-accent hover:underline">
                + Add property
              </button>
            </div>
            {otherKeys.length === 0 ? (
              <p className="text-xs text-panel-muted">No other properties in this file.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {otherKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-48 flex-shrink-0 truncate font-mono text-xs text-panel-muted">{key}</span>
                    <input
                      value={properties[key] ?? ''}
                      onChange={(e) => setValue(key, e.target.value)}
                      className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                    />
                    <button
                      onClick={() => removeOther(key)}
                      className="text-xs text-panel-muted hover:text-panel-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
