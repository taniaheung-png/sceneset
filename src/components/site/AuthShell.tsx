export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      {intro && <p className="mt-2 text-ink-2">{intro}</p>}
      <div className="mt-6 rounded-lg border border-rule bg-surface p-5">{children}</div>
    </div>
  );
}

export function Banner({ tone, children }: { tone: "info" | "danger"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={`mb-4 rounded-md p-3 text-sm font-medium ${tone === "danger" ? "bg-danger-tint text-danger" : "bg-info-tint text-info"}`}
    >
      {children}
    </p>
  );
}
