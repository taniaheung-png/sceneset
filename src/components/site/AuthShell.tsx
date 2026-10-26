export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <p className="eyebrow">Your event workspace</p>
      <h1 className="page-title">{title}</h1>
      {intro && <p className="mt-2 text-ink-2">{intro}</p>}
      <div className="mt-6 panel p-5">{children}</div>
    </div>
  );
}

export function Banner({ tone, children }: { tone: "info" | "danger"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={`mb-4 rounded-[0.5625rem] px-4 py-3 text-sm font-medium ${tone === "danger" ? "bg-danger-tint text-danger" : "bg-info-tint text-info"}`}
    >
      {children}
    </p>
  );
}
