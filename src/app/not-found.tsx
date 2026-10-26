import { Brand } from "@/components/site/Brand";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-20">
      <Brand />
      <p className="eyebrow mt-10">404</p>
      <h1 className="page-title">Page not found</h1>
      <p className="page-intro">That page does not exist, or you do not have access to it.</p>
      <div className="mt-5"><ButtonLink href="/">Back to home</ButtonLink></div>
    </main>
  );
}
