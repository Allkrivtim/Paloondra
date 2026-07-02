export default function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-panel-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-panel-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-panel-muted">{sub}</div>}
    </div>
  );
}
