import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../api/errors';
import { api } from '../../api/client';
import InstalledPlugins from '../plugins/InstalledPlugins';
import PluginStore from '../plugins/PluginStore';
import RestartBanner from '../plugins/RestartBanner';

type SubTab = 'installed' | 'store';

export default function Plugins() {
  const toast = useToast();
  const [subTab, setSubTab] = useState<SubTab>('installed');
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);

  async function handleRestart() {
    setRestarting(true);
    try {
      await api.post('/server/restart');
      toast.success('Restart triggered - see Dashboard for live output');
      setNeedsRestart(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to trigger restart'));
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      {needsRestart && (
        <RestartBanner onRestart={handleRestart} restarting={restarting} onDismiss={() => setNeedsRestart(false)} />
      )}

      <div className="flex gap-1 border-b border-panel-border">
        {(['installed', 'store'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              subTab === tab
                ? 'border-panel-accent text-panel-accent'
                : 'border-transparent text-panel-muted hover:text-panel-text'
            }`}
          >
            {tab === 'installed' ? 'Installed' : 'Store'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {subTab === 'installed' ? (
          <InstalledPlugins onChanged={() => setNeedsRestart(true)} />
        ) : (
          <PluginStore onInstalled={() => setNeedsRestart(true)} />
        )}
      </div>
    </div>
  );
}
