import { SiteNav } from "@/app/_components/site-nav";
import { sandboxEnabled } from "@/app/sandbox/_server/guard";

export const dynamic = "force-dynamic";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="font-(family-name:--font-app) text-[12.5px] leading-normal">
      <header className="bg-card sticky top-0 z-10 border-b px-4 py-2.5">
        <SiteNav section="docs" sandbox={sandboxEnabled()} />
      </header>
      {children}
    </div>
  );
}
