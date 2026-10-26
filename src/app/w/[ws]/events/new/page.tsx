import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EventForm } from "@/components/events/EventForm";
import { ButtonLink } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "New event" };

export default async function NewEvent({ params }: PageProps<"/w/[ws]/events/new">) {
  const { ws } = await params;
  const { workspace, role } = await getWorkspace(ws);
  if (role === "collaborator") {
    return (
      <>
        <PageHeader event={workspace.name} title="New event" intro="A few details now. Everything else can be added as you plan." />
        <section className="max-w-prose panel p-6">
          <h2 className="panel-title">Only organisers and owners can create events</h2>
          <p className="mt-2 text-ink-2">Ask a workspace owner to change your role if you need to.</p>
          <div className="mt-4"><ButtonLink href={`/w/${ws}/events`} variant="secondary">Back to events</ButtonLink></div>
        </section>
      </>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.from("venues").select("id, name").eq("workspace_id", ws).order("name");
  return (
    <>
      <PageHeader event={workspace.name} title="New event" intro="A few details now. Everything else can be added as you plan." />
      <EventForm ws={ws} initial={{}} venues={data ?? []} cancelHref={`/w/${ws}/events`} />
    </>
  );
}
