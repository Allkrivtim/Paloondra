interface Props {
  path: string;
  onNavigate: (path: string) => void;
  onDropMove?: (targetDir: string) => void;
}

export default function Breadcrumbs({ path, onNavigate, onDropMove }: Props) {
  const parts = path.split('/').filter(Boolean);
  const crumbs = [{ label: 'root', path: '/' }, ...parts.map((part, i) => ({
    label: part,
    path: '/' + parts.slice(0, i + 1).join('/'),
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
