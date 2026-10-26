import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const h2 = "mt-8 text-xl font-bold";
const p = "mt-2 text-ink-2";

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="page-title">Privacy</h1>
      <p className={p}>
        SceneSet is a prototype for planning events. This page says, in plain words, what it stores, why, who can see it, how long it is
        kept and how to delete it. It is a design for good practice and has <strong>not</strong> been legally reviewed or certified under
        GDPR or the Hong Kong Personal Data (Privacy) Ordinance. Please use fictional information while testing.
      </p>

      <h2 className={h2}>What is collected, and where you are told</h2>
      <p className={p}>
        <strong>Public pages and the read-only demo:</strong> nothing. The demo shows invented data and cannot save anything.
      </p>
      <p className={p}>
        <strong>When you create an account</strong> (a notice appears next to the sign-up form): your name, your email address and your
        password. The password is stored only as a salted hash by our sign-in provider, Supabase.
      </p>
      <p className={p}>
        <strong>When you plan an event</strong> (a notice appears next to the forms for events, notes, members and guests): the content you
        type: events, tasks, notes, budgets, suppliers and quotes, guest names, optional contact details and RSVP status, running orders,
        venues and layouts. Guest names and contact details are other people&apos;s personal data, so enter only what you need and have a
        reason to hold; leave contact details blank when you can.
      </p>
      <p className={p}>We do not ask for payment details. There is no real payment in this prototype.</p>

      <h2 className={h2}>Why</h2>
      <p className={p}>To sign you in, keep your plans separate from other people&apos;s, and let teammates work on the same plan. Nothing is used for advertising or sold.</p>

      <h2 className={h2}>Who can see it</h2>
      <p className={p}>
        Only members of the workspace the content belongs to (and the hosting provider that stores it). Teammates see your name. Only
        workspace owners see member email addresses. The printed summary leaves out guest contact details.
      </p>

      <h2 className={h2}>Cookies and tracking</h2>
      <p className={p}>
        Only essential session cookies that keep you signed in; they are removed when you sign out. There are no analytics or advertising
        cookies, so there is no cookie consent banner. Fonts are served from this site.
      </p>

      <h2 className={h2}>How long it is kept</h2>
      <p className={p}>
        Until you delete it. A workspace&apos;s data stays while the workspace exists. The fictional sample event you can load is ordinary
        workspace data: reset or delete it any time. This prototype has no automatic clean-up, so delete test data you no longer need.
      </p>

      <h2 className={h2}>Deleting your data</h2>
      <p className={p}>
        In <strong>Settings</strong> you can delete a workspace (owners) and delete your account. Deleting your account removes your sign-in,
        profile and memberships, and deletes any workspace where you are the only member. In a workspace shared with others the plan
        stays for them: notes you wrote remain with the author shown as &ldquo;Former member&rdquo;. If you are the only owner of a
        workspace other people use, deletion is blocked until you make someone else an owner or delete the workspace, so nobody is left
        without access to shared records.
      </p>

      <h2 className={h2}>Your choices</h2>
      <p className={p}>You can correct your name in Settings, remove guests and notes you entered, and delete your account. If you need help, use the contact below.</p>

      <h2 className={h2}>Contact</h2>
      <p className={p}>
        Contact details for privacy questions will be listed here before this prototype is offered to real users. Until then, ask the
        person who gave you access.
      </p>

      <p className="mt-8 text-sm text-ink-2">
        Back to <Link href="/" className="font-semibold text-primary underline">the home page</Link>.
      </p>
    </div>
  );
}
