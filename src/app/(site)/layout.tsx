import { PrototypeNotice, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PrototypeNotice />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
