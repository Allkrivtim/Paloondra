import { useTranslation } from 'react-i18next';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
  onDropMove?: (targetDir: string) => void;
  /** When set (a restricted user's sftpRootPath), crumbs only render from this directory downward instead of always starting at "/" - navigating above it would just 403 anyway. */
  rootPath?: string | null;
}

export default function Breadcrumbs({ path, onNavigate, onDropMove, rootPath }: Props) {
  const { t } = useTranslation();
  const parts = path.split('/').filter(Boolean);
  const rootDepth = rootPath ? rootPath.split('/').filter(Boolean).length : 0;
  const visibleParts = parts.slice(rootDepth);
  const rootLabel = rootPath ? (parts[rootDepth - 1] ?? rootPath) : t('sftp.rootBreadcrumb');
  const crumbs = [{ label: rootLabel, path: rootPath || '/' }, ...visibleParts.map((part, i) => ({
    label: part,
    path: '/' + parts.slice(0, rootDepth + i + 1).join('/'),
  }))];

  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          {i > 0 && <span className="text-panel-muted">/</span>}
          <button
            onClick={() => onNavigate(crumb.path)}
            onDragOver={(e) => onDropMove && e.preventDefault()}
            onDrop={(e) => {
              if (!onDropMove) return;
              e.preventDefault();
              e.stopPropagation();
              onDropMove(crumb.path);
            }}
            className={`rounded px-1.5 py-0.5 transition hover:bg-panel-surface2 ${
              crumb.path === path ? 'font-semibold text-panel-accent' : 'text-panel-muted'
            }`}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  );
}
