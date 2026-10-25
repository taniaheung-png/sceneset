import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Banner } from "@/components/site/AuthShell";
import { CollectionNotice } from "@/components/ui/CollectionNotice";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField, TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { addMember, changeRole, deleteAccount, deleteWorkspace, removeMember, renameWorkspace, updateProfile } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  renamed: ["info", "Workspace renamed."],
  "profile-saved": ["info", "Your name was saved."],
  "confirm-mismatch": ["danger", "What you typed does not match, so nothing was deleted."],
  "delete-blocked": ["danger", "You are the only owner of a workspace that other people use. Make someone else an owner, or delete that workspace, then try again. Nothing was deleted."],
  "delete-unavailable": ["danger", "Account deletion is not available on this server (it needs the server-side admin key). Nothing was deleted."],
  added: ["info", "Member added."],
  "role-changed": ["info", "Role updated."],
  removed: ["info", "Member removed."],
  "last-owner": ["danger", "A workspace must keep at least one owner. Make someone else an owner first."],
  "not-found": ["danger", "No registered account has that email, or that member no longer exists. Ask them to sign up first."],
  exists: ["danger", "That person is already a member."],
  forbidden: ["danger", "Only workspace owners can do that."],
  invalid: ["danger", "Check the details and try again."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};

const ROLE_NOTES: [string, string][] = [
  ["Owner", "Everything, including members, roles, workspace settings, plan changes and deleting the workspace."],
  ["Organiser", "Create and edit events and all planning records, and assign tasks. No member, billing or ownership changes."],
  ["Collaborator", "Read the shared plan, update the status of tasks assigned to them, and add or edit their own notes."],
];

export default async function Settings({ params, searchParams }: PageProps<"/w/[ws]/settings">) {
  const { ws } = await params;
  const sp = await searchParams;
  const { workspace, role, user } = await getWorkspace(ws);
  const isOwner = role === "owner";
  const supabase = await createClient();
  // No generated DB types yet (needs the live project), so the RPC row shape is declared by hand.
  const { data } = await supabase.rpc("list_workspace_members", { ws });
  const members = (data ?? []) as { user_id: string; display_name: string; role: string; email: string | null }[];
  const { data: blockerData } = await supabase.rpc("account_deletion_blockers");
  const blockers = (blockerData ?? []) as { workspace_id: string; name: string; other_members: number }[];
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const msg = typeof sp.m === "string" ? MESSAGES[sp.m] : undefined;

  return (
    <>
      <PageHeader event={workspace.name} title="Settings" />
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}

      <section aria-labelledby="s-ws" className="max-w-xl rounded-lg border border-rule bg-surface p-5">
        <h2 id="s-ws" className="text-lg font-bold">Workspace</h2>
        <p className="mt-1 text-sm text-ink-2">
          Plan: <strong>{workspace.plan === "organiser" ? "Organiser" : "Free Personal"}</strong>. Your role: <strong>{role}</strong>.
        </p>
        {isOwner ? (
          <form action={renameWorkspace} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="ws" value={ws} />
            <div className="flex-1"><TextField name="name" label="Workspace name" defaultValue={workspace.name} maxLength={80} required /></div>
            <SubmitButton>Rename</SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink-2">Only owners can rename the workspace.</p>
        )}
      </section>

      <section aria-labelledby="s-mem" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="s-mem" className="text-lg font-bold">Members</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Workspace members and their roles</caption>
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className="px-3 py-2">Name</th>
                {isOwner && <th scope="col" className="px-3 py-2">Email</th>}
                <th scope="col" className="px-3 py-2">Role</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const me = m.user_id === user.id;
                return (
                  <tr key={m.user_id} className="border-t border-rule align-middle">
                    <td className="px-3 py-2 font-semibold">{m.display_name || "Unnamed"} {me && <StatusChip>you</StatusChip>}</td>
                    {isOwner && <td className="px-3 py-2">{m.email}</td>}
                    <td className="px-3 py-2">
                      {isOwner ? (
                        <form action={changeRole} className="flex items-center gap-2">
                          <input type="hidden" name="ws" value={ws} />
                          <input type="hidden" name="user" value={m.user_id} />
                          <SelectField label="Role" name="role" defaultValue={m.role}>
                            <option value="owner">Owner</option>
                            <option value="organiser">Organiser</option>
                            <option value="collaborator">Collaborator</option>
                          </SelectField>
                          <SubmitButton pendingText="…">Update</SubmitButton>
                        </form>
                      ) : (
                        <span className="capitalize">{m.role}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(isOwner || me) && (
                        <ConfirmAction
                          action={removeMember}
                          fields={{ ws, user: m.user_id }}
                          label={me ? "Leave" : "Remove"}
                          title={me ? "Leave this workspace?" : `Remove ${m.display_name || "this member"}?`}
                          message={me ? "You will lose access to every event in this workspace." : "They will lose access to every event in this workspace. Tasks assigned to them become unassigned."}
                          confirmLabel={me ? "Leave workspace" : "Remove member"}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isOwner ? (
          <form action={addMember} className="mt-5 grid gap-3 border-t border-rule pt-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <input type="hidden" name="ws" value={ws} />
            <TextField name="email" type="email" label="Add a member by email" hint="They must already have a SceneSet account." required />
            <SelectField label="Role" name="role" defaultValue="collaborator">
              <option value="collaborator">Collaborator</option>
              <option value="organiser">Organiser</option>
              <option value="owner">Owner</option>
            </SelectField>
            <SubmitButton pendingText="Adding…">Add member</SubmitButton>
            <div className="sm:col-span-3">
              <CollectionNotice>Adding someone lets them see this workspace&apos;s events and your members&apos; names.</CollectionNotice>
            </div>
          </form>
        ) : (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-2">Only owners can add members or change roles.</p>
        )}
      </section>

      <section aria-labelledby="s-roles" className="max-w-3xl rounded-lg border border-rule bg-surface p-5">
        <h2 id="s-roles" className="text-lg font-bold">What each role can do</h2>
        <dl className="mt-3 grid gap-3 text-sm">
          {ROLE_NOTES.map(([r, t]) => (
            <div key={r}><dt className="font-semibold">{r}</dt><dd className="text-ink-2">{t}</dd></div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="s-profile" className="max-w-xl rounded-lg border border-rule bg-surface p-5">
        <h2 id="s-profile" className="text-lg font-bold">Your profile</h2>
        <p className="mt-1 text-sm text-ink-2">Signed in as <strong>{user.email}</strong>. Teammates see your name; only workspace owners see member email addresses.</p>
        <form action={updateProfile} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="ws" value={ws} />
          <div className="flex-1"><TextField name="display_name" label="Your name" defaultValue={profile?.display_name ?? ""} maxLength={80} required /></div>
          <SubmitButton>Save name</SubmitButton>
        </form>
        <div className="mt-4"><CollectionNotice>Your name is shown to everyone in your workspaces.</CollectionNotice></div>
      </section>

      <section aria-labelledby="s-privacy" className="max-w-3xl rounded-lg border border-rule bg-surface p-5">
        <h2 id="s-privacy" className="text-lg font-bold">Privacy and your data</h2>
        <p className="mt-1 text-sm text-ink-2">
          Read what SceneSet stores and why in the <Link href="/privacy" className="font-semibold text-primary underline">privacy notice</Link>. You can correct your name above,
          and delete your account and data below.
        </p>
      </section>

      {isOwner && (
        <section aria-labelledby="s-delws" className="max-w-3xl rounded-lg border border-danger bg-surface p-5">
          <h2 id="s-delws" className="text-lg font-bold">Delete this workspace</h2>
          <p className="mt-1 text-sm text-ink-2">Permanently deletes the workspace and everything in it for every member: events, tasks, budgets, suppliers, guests, schedules, layouts and notes. This cannot be undone.</p>
          <form action={deleteWorkspace} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" aria-label="Delete this workspace">
            <input type="hidden" name="ws" value={ws} />
            <div className="flex-1"><TextField name="confirm" label={`Type the workspace name (${workspace.name}) to confirm`} autoComplete="off" required /></div>
            <SubmitButton variant="danger" pendingText="Deleting…">Delete workspace</SubmitButton>
          </form>
        </section>
      )}

      <section aria-labelledby="s-delacct" className="max-w-3xl rounded-lg border border-danger bg-surface p-5">
        <h2 id="s-delacct" className="text-lg font-bold">Delete your account</h2>
        <p className="mt-1 text-sm text-ink-2">
          This permanently deletes your sign-in, your profile and your membership of every workspace. Workspaces where you are the only member are deleted with
          you. In workspaces shared with others, the plan stays; notes you wrote remain with the author shown as &ldquo;Former member&rdquo;, and tasks you created
          keep no creator. This cannot be undone.
        </p>
        {blockers.length > 0 && (
          <div role="alert" className="mt-3 rounded-md bg-warn-tint p-3 text-sm text-warn-ink">
            <p className="font-semibold">Deletion is blocked until you hand over {blockers.length === 1 ? "this workspace" : "these workspaces"}:</p>
            <ul className="mt-1 list-disc pl-5">
              {blockers.map((b) => (
                <li key={b.workspace_id}>{b.name}: you are the only owner and {Number(b.other_members)} other member{Number(b.other_members) === 1 ? " uses" : "s use"} it.{" "}
                  <Link href={`/w/${b.workspace_id}/settings`} className="font-semibold underline">Open its settings</Link></li>
              ))}
            </ul>
            <p className="mt-1">Make another member an owner (Members, above), or delete the workspace.</p>
          </div>
        )}
        <form action={deleteAccount} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" aria-label="Delete your account">
          <input type="hidden" name="ws" value={ws} />
          <div className="flex-1"><TextField name="confirm" type="email" label="Type your email address to confirm" autoComplete="off" required /></div>
          <SubmitButton variant="danger" pendingText="Deleting…">Delete my account</SubmitButton>
        </form>
      </section>
    </>
  );
}