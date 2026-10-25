/** Consistent content header: current event, view title, primary action. */
export function PageHeader({ event, title, children }: { event?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
      <div>
        {event && <p className="text-sm text-ink-2">{event}</p>}
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
