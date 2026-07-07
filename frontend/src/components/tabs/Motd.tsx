import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import '../../monacoSetup';
import { load as loadYaml } from 'js-yaml';
import { useTranslation } from 'react-i18next';
import { getMotdConfig, reloadMotd, saveMotdConfigFields, saveMotdConfigRaw } from '../../api/motd';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import {
  MotdFakePlayers,
  MotdJustXMore,
  MotdMaintenance,
  MotdMaxPlayersOverride,
  MotdPlayerCount,
  MotdPreset,
  MotdProfile,
  MotdSelectionMode,
  MotdValues,
} from '../../types';
import Spinner from '../common/Spinner';
import MotdLinesEditor from '../motd/MotdLinesEditor';
import MiniMessageHint from '../motd/MiniMessageHint';

type Mode = 'form' | 'raw';
type TopLevelKey = keyof MotdValues;

const COLOR_FORMATS = ['AUTO', 'AUTO_STRICT', 'MINI_MESSAGE', 'LEGACY_AMPERSAND', 'LEGACY_SECTION', 'HEX_AMPERSAND', 'JSON'];
const SELECTION_MODES: MotdSelectionMode[] = ['RANDOM', 'STICKY_PER_IP', 'HASHED_PER_IP', 'ROTATE'];
const FAKE_PLAYERS_MODES: MotdFakePlayers['mode'][] = ['static', 'random', 'percent'];

const DEFAULT_MAINTENANCE: MotdMaintenance = {
  enabled: false,
  profile: 'maintenance',
  bypassPermission: 'bettermotd.maintenance.bypass',
  kickMessage: '<red>Server is in maintenance mode.</red>',
};
const DEFAULT_DEBUG = { selfTest: false, verbose: false };
const DEFAULT_PLAYER_COUNT: MotdPlayerCount = {};
const DEFAULT_FAKE_PLAYERS: MotdFakePlayers = { enabled: false, mode: 'static', value: '0' };
const DEFAULT_JUST_X_MORE: MotdJustXMore = { enabled: false, x: 3 };
const DEFAULT_MAX_PLAYERS: MotdMaxPlayersOverride = { enabled: false, value: 100 };

function newPreset(index: number): MotdPreset {
  return { id: `preset-${index}`, icon: 'default.png', motd: [''] };
}

function newProfile(): MotdProfile {
  return { selectionMode: 'RANDOM', presets: [newPreset(1)] };
}

export default function Motd() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();

  const [mode, setMode] = useState<Mode>('form');
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [values, setValues] = useState<MotdValues>({});
  const [touched, setTouched] = useState<Set<TopLevelKey>>(new Set());
  const [newProfileName, setNewProfileName] = useState('');

  const [raw, setRaw] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const doc = await getMotdConfig();
      setFilePath(doc.path);
      setRaw(doc.raw);
      setValues(doc.values);
      setTouched(new Set());
      setRawDirty(false);
      setYamlError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, t('motd.failedToLoad')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateTopLevel<K extends TopLevelKey>(key: K, value: MotdValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => new Set(prev).add(key));
  }

  function updateMaintenance(patch: Partial<MotdMaintenance>) {
    updateTopLevel('maintenance', { ...DEFAULT_MAINTENANCE, ...values.maintenance, ...patch });
  }

  function updateDebug(patch: Partial<typeof DEFAULT_DEBUG>) {
    updateTopLevel('debug', { ...DEFAULT_DEBUG, ...values.debug, ...patch });
  }

  function profiles(): Record<string, MotdProfile> {
    return values.profiles ?? {};
  }

  function updateProfile(name: string, patch: Partial<MotdProfile>) {
    const next = { ...profiles() };
    next[name] = { ...next[name], ...patch };
    updateTopLevel('profiles', next);
  }

  function updatePlayerCount(name: string, patch: Partial<MotdPlayerCount>) {
    const profile = profiles()[name];
    if (!profile) return;
    updateProfile(name, { playerCount: { ...DEFAULT_PLAYER_COUNT, ...profile.playerCount, ...patch } });
  }

  function updatePreset(name: string, index: number, patch: Partial<MotdPreset>) {
    const profile = profiles()[name];
    if (!profile) return;
    updateProfile(name, { presets: profile.presets.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  }

  function addPreset(name: string) {
    const profile = profiles()[name];
    if (!profile) return;
    updateProfile(name, { presets: [...profile.presets, newPreset(profile.presets.length + 1)] });
  }

  function removePreset(name: string, index: number) {
    const profile = profiles()[name];
    if (!profile) return;
    updateProfile(name, { presets: profile.presets.filter((_, i) => i !== index) });
  }

  function handleAddProfile(e: React.FormEvent) {
    e.preventDefault();
    const name = newProfileName.trim();
    if (!name || profiles()[name]) return;
    updateTopLevel('profiles', { ...profiles(), [name]: newProfile() });
    setNewProfileName('');
  }

  async function handleRemoveProfile(name: string) {
    const confirmed = await dialog.confirm({
      title: t('motd.removeProfileTitle', { name }),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    const next = { ...profiles() };
    delete next[name];
    updateTopLevel('profiles', next);
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
          ? await saveMotdConfigRaw(raw)
          : await saveMotdConfigFields(Object.fromEntries([...touched].map((key) => [key, values[key]])));
      setFilePath(doc.path);
      setRaw(doc.raw);
      setValues(doc.values);
      setTouched(new Set());
      setRawDirty(false);
      toast.success(t('motd.saved'));
      if (doc.reload?.response) {
        toast.success(t('motd.reloadedToast'));
      } else if (doc.reload?.error) {
        toast.error(t('motd.reloadFailedToast', { error: doc.reload.error }));
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('motd.failedToSave')));
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    setReloading(true);
    try {
      await reloadMotd();
      toast.success(t('motd.reloadedToast'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('motd.failedToReload')));
    } finally {
      setReloading(false);
    }
  }

  const dirty = mode === 'raw' ? rawDirty : touched.size > 0;
  const saveDisabled = saving || loading || !!loadError || !dirty || (mode === 'raw' && !!yamlError);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-panel-text">{t('motd.title')}</h1>
          {filePath && <p className="font-mono text-[11px] text-panel-muted">{filePath}</p>}
        </div>
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
            onClick={handleReload}
            disabled={reloading || loading || !!loadError}
            title={t('motd.reloadTooltip')}
            className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
          >
            {reloading && <Spinner className="h-3 w-3" />}
            {t('motd.reload')}
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {saving && <Spinner className="h-3 w-3 text-black" />}
            {t('common.save')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
          <Spinner /> {t('motd.loading')}
        </div>
      )}

      {!loading && loadError && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="max-w-md text-sm text-panel-danger">{loadError}</p>
          <button
            onClick={load}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
          >
            {t('common.retry')}
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
          {/* General */}
          <section className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('motd.sections.general')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.colorFormat.label')}</label>
                <select
                  value={values.colorFormat ?? 'AUTO'}
                  onChange={(e) => updateTopLevel('colorFormat', e.target.value)}
                  className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                >
                  {COLOR_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.colorFormat.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.activeProfile.label')}</label>
                <select
                  value={values.activeProfile ?? 'default'}
                  onChange={(e) => updateTopLevel('activeProfile', e.target.value)}
                  className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                >
                  {Object.keys(profiles()).length === 0 && <option value={values.activeProfile ?? 'default'}>{values.activeProfile ?? 'default'}</option>}
                  {Object.keys(profiles()).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.activeProfile.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="flex items-center gap-2 text-sm text-panel-text">
                  <input
                    type="checkbox"
                    checked={values.placeholders?.enabled ?? true}
                    onChange={(e) => updateTopLevel('placeholders', { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                  />
                  {t('motd.fields.placeholders.label')}
                </label>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.placeholders.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="flex items-center gap-2 text-sm text-panel-text">
                  <input
                    type="checkbox"
                    checked={values.placeholderAPI?.enabled ?? false}
                    onChange={(e) => updateTopLevel('placeholderAPI', { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                  />
                  {t('motd.fields.placeholderAPI.label')}
                </label>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.placeholderAPI.description')}</p>
              </div>
            </div>
          </section>

          {/* Maintenance */}
          <section className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('motd.sections.maintenance')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="flex items-center gap-2 text-sm text-panel-text">
                  <input
                    type="checkbox"
                    checked={values.maintenance?.enabled ?? DEFAULT_MAINTENANCE.enabled}
                    onChange={(e) => updateMaintenance({ enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                  />
                  {t('motd.fields.maintenanceEnabled.label')}
                </label>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.maintenanceEnabled.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.maintenanceProfile.label')}</label>
                <select
                  value={values.maintenance?.profile ?? DEFAULT_MAINTENANCE.profile}
                  onChange={(e) => updateMaintenance({ profile: e.target.value })}
                  className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                >
                  {Object.keys(profiles()).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.maintenanceProfile.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.bypassPermission.label')}</label>
                <input
                  value={values.maintenance?.bypassPermission ?? DEFAULT_MAINTENANCE.bypassPermission}
                  onChange={(e) => updateMaintenance({ bypassPermission: e.target.value })}
                  className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                />
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.bypassPermission.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3 sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.kickMessage.label')}</label>
                <input
                  value={values.maintenance?.kickMessage ?? DEFAULT_MAINTENANCE.kickMessage}
                  onChange={(e) => updateMaintenance({ kickMessage: e.target.value })}
                  className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
                />
                <MiniMessageHint />
              </div>
            </div>
          </section>

          {/* Debug */}
          <section className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('motd.sections.debug')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="flex items-center gap-2 text-sm text-panel-text">
                  <input
                    type="checkbox"
                    checked={values.debug?.selfTest ?? DEFAULT_DEBUG.selfTest}
                    onChange={(e) => updateDebug({ selfTest: e.target.checked })}
                    className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                  />
                  {t('motd.fields.debugSelfTest.label')}
                </label>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.debugSelfTest.description')}</p>
              </div>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <label className="flex items-center gap-2 text-sm text-panel-text">
                  <input
                    type="checkbox"
                    checked={values.debug?.verbose ?? DEFAULT_DEBUG.verbose}
                    onChange={(e) => updateDebug({ verbose: e.target.checked })}
                    className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                  />
                  {t('motd.fields.debugVerbose.label')}
                </label>
                <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.debugVerbose.description')}</p>
              </div>
            </div>
          </section>

          {/* motdFrames - only if present in the file */}
          {values.motdFrames !== undefined && (
            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('motd.sections.motdFrames')}</h3>
              <div className="rounded-xl border border-panel-border bg-panel-surface p-3">
                <MotdLinesEditor
                  lines={values.motdFrames ?? []}
                  onChange={(lines) => updateTopLevel('motdFrames', lines)}
                  addLabel={t('motd.addLine')}
                  linePlaceholder="<green>Welcome!</green>"
                />
                <MiniMessageHint />
              </div>
            </section>
          )}

          {/* Profiles */}
          <section className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('motd.sections.profiles')}</h3>
            <div className="flex flex-col gap-4">
              {Object.entries(profiles()).map(([name, profile]) => (
                <div key={name} className="rounded-xl border border-panel-border bg-panel-surface p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-mono text-sm font-semibold text-panel-text">{name}</h4>
                    <button
                      onClick={() => handleRemoveProfile(name)}
                      className="text-xs text-panel-muted hover:text-panel-danger"
                    >
                      {t('motd.removeProfile')}
                    </button>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.selectionMode.label')}</label>
                      <select
                        value={profile.selectionMode ?? 'RANDOM'}
                        onChange={(e) => updateProfile(name, { selectionMode: e.target.value as MotdSelectionMode })}
                        className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                      >
                        {SELECTION_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-panel-muted">{t('motd.fields.selectionMode.description')}</p>
                    </div>
                    {profile.selectionMode === 'STICKY_PER_IP' && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.stickyTtlSeconds.label')}</label>
                          <input
                            type="number"
                            value={profile.stickyTtlSeconds ?? 10}
                            onChange={(e) => updateProfile(name, { stickyTtlSeconds: e.target.valueAsNumber })}
                            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.stickyMaxEntries.label')}</label>
                          <input
                            type="number"
                            value={profile.stickyMaxEntriesPerProfile ?? 10000}
                            onChange={(e) => updateProfile(name, { stickyMaxEntriesPerProfile: e.target.valueAsNumber })}
                            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.fields.stickyCleanup.label')}</label>
                          <input
                            type="number"
                            value={profile.stickyCleanupEveryNPings ?? 500}
                            onChange={(e) => updateProfile(name, { stickyCleanupEveryNPings: e.target.valueAsNumber })}
                            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Player count options */}
                  <div className="mb-3 rounded-lg border border-panel-border p-3">
                    <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-panel-muted">
                      {t('motd.playerCount.title')}
                    </h5>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-panel-text">
                        <input
                          type="checkbox"
                          checked={profile.playerCount?.disableHover ?? false}
                          onChange={(e) => updatePlayerCount(name, { disableHover: e.target.checked })}
                          className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                        />
                        {t('motd.playerCount.disableHover')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-panel-text">
                        <input
                          type="checkbox"
                          checked={profile.playerCount?.hidePlayerCount ?? false}
                          onChange={(e) => updatePlayerCount(name, { hidePlayerCount: e.target.checked })}
                          className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
                        />
                        {t('motd.playerCount.hidePlayerCount')}
                      </label>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-panel-muted">{t('motd.playerCount.hoverLines')}</label>
                      <MotdLinesEditor
                        lines={profile.playerCount?.hoverLines ?? []}
                        onChange={(lines) => updatePlayerCount(name, { hoverLines: lines })}
                        addLabel={t('motd.addLine')}
                        linePlaceholder="<gray>Online: <white>%online%</white></gray>"
                      />
                      <MiniMessageHint />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-panel-border p-2">
                        <label className="flex items-center gap-2 text-xs text-panel-text">
                          <input
                            type="checkbox"
                            checked={profile.playerCount?.fakePlayers?.enabled ?? DEFAULT_FAKE_PLAYERS.enabled}
                            onChange={(e) =>
                              updatePlayerCount(name, {
                                fakePlayers: { ...DEFAULT_FAKE_PLAYERS, ...profile.playerCount?.fakePlayers, enabled: e.target.checked },
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-panel-border accent-panel-accent2"
                          />
                          {t('motd.playerCount.fakePlayers.label')}
                        </label>
                        <select
                          value={profile.playerCount?.fakePlayers?.mode ?? DEFAULT_FAKE_PLAYERS.mode}
                          onChange={(e) =>
                            updatePlayerCount(name, {
                              fakePlayers: { ...DEFAULT_FAKE_PLAYERS, ...profile.playerCount?.fakePlayers, mode: e.target.value as MotdFakePlayers['mode'] },
                            })
                          }
                          className="mt-1.5 w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                        >
                          {FAKE_PLAYERS_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          value={profile.playerCount?.fakePlayers?.value ?? DEFAULT_FAKE_PLAYERS.value}
                          onChange={(e) =>
                            updatePlayerCount(name, {
                              fakePlayers: { ...DEFAULT_FAKE_PLAYERS, ...profile.playerCount?.fakePlayers, value: e.target.value },
                            })
                          }
                          placeholder={t('motd.playerCount.fakePlayers.valuePlaceholder')}
                          className="mt-1.5 w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                        />
                        <p className="mt-1 text-[10px] text-panel-muted">{t('motd.playerCount.fakePlayers.description')}</p>
                      </div>

                      <div className="rounded-lg border border-panel-border p-2">
                        <label className="flex items-center gap-2 text-xs text-panel-text">
                          <input
                            type="checkbox"
                            checked={profile.playerCount?.justXMore?.enabled ?? DEFAULT_JUST_X_MORE.enabled}
                            onChange={(e) =>
                              updatePlayerCount(name, {
                                justXMore: { ...DEFAULT_JUST_X_MORE, ...profile.playerCount?.justXMore, enabled: e.target.checked },
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-panel-border accent-panel-accent2"
                          />
                          {t('motd.playerCount.justXMore.label')}
                        </label>
                        <input
                          type="number"
                          value={profile.playerCount?.justXMore?.x ?? DEFAULT_JUST_X_MORE.x}
                          onChange={(e) =>
                            updatePlayerCount(name, {
                              justXMore: { ...DEFAULT_JUST_X_MORE, ...profile.playerCount?.justXMore, x: e.target.valueAsNumber },
                            })
                          }
                          className="mt-1.5 w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                        />
                        <p className="mt-1 text-[10px] text-panel-muted">{t('motd.playerCount.justXMore.description')}</p>
                      </div>

                      <div className="rounded-lg border border-panel-border p-2">
                        <label className="flex items-center gap-2 text-xs text-panel-text">
                          <input
                            type="checkbox"
                            checked={profile.playerCount?.maxPlayers?.enabled ?? DEFAULT_MAX_PLAYERS.enabled}
                            onChange={(e) =>
                              updatePlayerCount(name, {
                                maxPlayers: { ...DEFAULT_MAX_PLAYERS, ...profile.playerCount?.maxPlayers, enabled: e.target.checked },
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-panel-border accent-panel-accent2"
                          />
                          {t('motd.playerCount.maxPlayers.label')}
                        </label>
                        <input
                          type="number"
                          value={profile.playerCount?.maxPlayers?.value ?? DEFAULT_MAX_PLAYERS.value}
                          onChange={(e) =>
                            updatePlayerCount(name, {
                              maxPlayers: { ...DEFAULT_MAX_PLAYERS, ...profile.playerCount?.maxPlayers, value: e.target.valueAsNumber },
                            })
                          }
                          className="mt-1.5 w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                        />
                        <p className="mt-1 text-[10px] text-panel-muted">{t('motd.playerCount.maxPlayers.description')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Presets */}
                  <div>
                    <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-panel-muted">{t('motd.preset.title')}</h5>
                    <div className="flex flex-col gap-3">
                      {profile.presets.map((preset, index) => (
                        <div key={index} className="rounded-lg border border-panel-border p-3">
                          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-panel-muted">{t('motd.preset.id')}</label>
                              <input
                                value={preset.id}
                                onChange={(e) => updatePreset(name, index, { id: e.target.value })}
                                className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-panel-muted">{t('motd.preset.icon')}</label>
                              <input
                                value={preset.icon ?? 'default.png'}
                                onChange={(e) => updatePreset(name, index, { icon: e.target.value })}
                                className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-panel-muted">{t('motd.preset.weight')}</label>
                              <input
                                type="number"
                                value={preset.weight ?? 1}
                                onChange={(e) => updatePreset(name, index, { weight: e.target.valueAsNumber })}
                                className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent"
                              />
                            </div>
                          </div>
                          <label className="mb-1 block text-[11px] font-medium text-panel-muted">{t('motd.preset.motdLines')}</label>
                          <MotdLinesEditor
                            lines={preset.motd}
                            onChange={(lines) => updatePreset(name, index, { motd: lines })}
                            addLabel={t('motd.addLine')}
                            linePlaceholder="<gradient:#00D431:#00BF4B><bold>My Server</bold></gradient>"
                          />
                          <MiniMessageHint />
                          <button
                            onClick={() => removePreset(name, index)}
                            className="mt-2 text-xs text-panel-muted hover:text-panel-danger"
                          >
                            {t('motd.preset.remove')}
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addPreset(name)}
                        className="self-start rounded-lg border border-dashed border-panel-border px-2.5 py-1 text-xs text-panel-muted transition hover:border-panel-accent hover:text-panel-accent"
                      >
                        + {t('motd.preset.add')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <form onSubmit={handleAddProfile} className="flex gap-2">
                <input
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder={t('motd.addProfilePlaceholder')}
                  className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
                />
                <button
                  type="submit"
                  disabled={!newProfileName.trim()}
                  className="rounded-lg border border-panel-border px-3 py-2 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
                >
                  {t('motd.addProfile')}
                </button>
              </form>
            </div>
          </section>

          <p className="mt-2 text-xs text-panel-muted">{t('motd.otherKeysNotice')}</p>
        </div>
      )}
    </div>
  );
}
