import { redirect } from "next/navigation";

// The workspace home is its events list.
export default async function WorkspaceHome({ params }: PageProps<"/w/[ws]">) {
  const { ws } = await params;
  redirect(`/w/${ws}/events`);
}
