import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold">Privacy</h1>
      <p role="note" className="mt-4 rounded-md bg-warn-tint p-3 text-sm text-warn-ink">
        <strong>Interim notice.</strong> The full privacy notice, with collection statements at each form, arrives in
        implementation phase 6. This page describes the prototype as it is today.
      </p>
      <h2 className="mt-8 text-xl font-bold">What this build collects</h2>
      <p className="mt-2 text-ink-2">
        Nothing. There are no accounts, forms or databases connected yet. The demo shows invented sample data only.
      </p>
      <h2 className="mt-6 text-xl font-bold">Cookies and tracking</h2>
      <p className="mt-2 text-ink-2">
        No advertising or analytics cookies are used. Fonts are served from this site. When sign-in is added, only
        essential session cookies will be used to keep you signed in.
      </p>
      <h2 className="mt-6 text-xl font-bold">Your data once accounts exist</h2>
      <p className="mt-2 text-ink-2">
        Accounts will include a working way to delete your account and data. This prototype has not been legally
        reviewed or certified under GDPR or the Hong Kong PDPO.
      </p>
    </div>
  );
}
