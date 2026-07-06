import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerFileKey } from '../../types';
import PropertiesEditor from '../serverProperties/PropertiesEditor';
import YamlFileEditor from '../serverProperties/YamlFileEditor';

type FileChoice = 'server.properties' | ServerFileKey;

const CHOICES: FileChoice[] = ['server.properties', 'bukkit', 'spigot'];

export default function ServerProperties() {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<FileChoice>('server.properties');

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex gap-1 rounded-lg border border-panel-border p-0.5 text-xs">
        {CHOICES.map((c) => (
          <button
            key={c}
            onClick={() => setChoice(c)}
            className={`rounded-md px-3 py-1.5 font-mono transition ${
              choice === c ? 'bg-panel-accent2 text-black' : 'text-panel-muted hover:text-panel-text'
            }`}
          >
            {c === 'server.properties' ? t('serverConfig.fileServerProperties') : `${c}.yml`}
          </button>
        ))}
      </div>

      {choice === 'server.properties' ? <PropertiesEditor /> : <YamlFileEditor key={choice} fileKey={choice} />}
    </div>
  );
}
