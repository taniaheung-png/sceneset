import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold">Privacy</h1>
      <p role="note" className="mt-4 rounded-md bg-warn-tint p-3 text-sm text-warn-ink">
        <strong>Interim notice.</strong> The full privacy notice, with collection statements at each form and a working
        account and data deletion path, arrives in implementation phase 6. Account deletion is not available yet. This
        prototype has not been legally reviewed or certified under GDPR or the Hong Kong PDPO.
      </p>
      <h2 className="mt-8 text-xl font-bold">What we collect now</h2>
      <p className="mt-2 text-ink-2">
        <strong>Public pages and the read-only demo</strong> collect nothing. The demo shows invented sample data.
      </p>
      <p className="mt-2 text-ink-2">
        <strong>If you create an account</strong> we store your name, your email address and your password (the password
        only as a salted hash, managed by our sign-in provider, Supabase). We store the workspaces you create and the
        members you add. Teammates in a workspace can see your name; only workspace owners can see members&apos; email
        addresses.
      </p>
      <h2 className="mt-6 text-xl font-bold">Why</h2>
      <p className="mt-2 text-ink-2">To sign you in, keep your plans separate from other people&apos;s, and let teammates work on the same plan.</p>
      <h2 className="mt-6 text-xl font-bold">Cookies and tracking</h2>
      <p className="mt-2 text-ink-2">
        No advertising or analytics cookies are used. When you sign in, essential session cookies keep you signed in; they
        are removed when you sign out. Fonts are served from this site.
      </p>
      <h2 className="mt-6 text-xl font-bold">Please use fictional information while testing</h2>
      <p className="mt-2 text-ink-2">
        This is a prototype. Do not enter real guests&apos; personal details or anything sensitive.
      </p>
    </div>
  );
}
