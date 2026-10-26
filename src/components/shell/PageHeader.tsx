/** Page heading in the reference's pattern: a small coral label, a large navy title, one line of intro, actions on the right. */
export function PageHeader({ event, title, intro, children }: { event?: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
      <div className="min-w-0">
        {event && <p className="eyebrow">{event}</p>}
        <h1 className="page-title">{title}</h1>
        {intro && <p className="page-intro">{intro}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
