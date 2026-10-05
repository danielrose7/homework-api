import { SiteNav } from "@/app/_components/site-nav";
import { sandboxEnabled } from "@/app/sandbox/_server/guard";

export function SiteHeader({ section }: { section?: string }) {
  return (
    <header className="bg-card sticky top-0 z-10 border-b px-4 py-2.5">
      <SiteNav section={section} sandbox={sandboxEnabled()} />
    </header>
  );
}
