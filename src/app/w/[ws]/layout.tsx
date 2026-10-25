import { signOut } from "@/app/(site)/auth-actions";
import { WorkspaceSwitcher } from "@/components/events/EventNav";
import { SideNav } from "@/components/shell/SideNav";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[ws]">) {
  const { ws } = await params;
  const { user, workspace, role } = await getWorkspace(ws);
  const { data: mine } = await (await createClient()).from("workspaces").select("id, name").order("created_at");
  const items = [
    { href: `/w/${ws}/events`, label: "Events", prefix: true },
    { href: `/w/${ws}/settings`, label: "Settings" },
  ];
  return (
    <div className="min-h-screen lg:flex">
      <SideNav
        items={items}
        label="Workspace"
        eventTitle={workspace.name}
        note={`Signed in as ${user.email} (${role}).`}
        footer={
          <>
            <WorkspaceSwitcher current={ws} workspaces={mine ?? []} />
            <form action={signOut}>
              <Button type="submit" variant="secondary" className="w-full">Sign out</Button>
            </form>
          </>
        }
      />
      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
