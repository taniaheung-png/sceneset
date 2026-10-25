import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-ink-2">That page does not exist, or you do not have access to it.</p>
      <div className="mt-5"><ButtonLink href="/">Back to home</ButtonLink></div>
    </main>
  );
}
