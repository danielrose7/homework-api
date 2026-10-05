import { SiteHeader } from "@/app/_components/site-header";
import { DocsTree } from "@/app/docs/_components/docs-tree";
import { LanguageProvider } from "@/app/docs/_components/language";
import { treeSections } from "@/app/docs/_lib/nav";

export const dynamic = "force-dynamic";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <LanguageProvider>
      <div className="flex min-h-dvh flex-col font-(family-name:--font-app) text-[12.5px] leading-normal">
        <SiteHeader section="docs" />
        <div className="flex flex-1 flex-col lg:flex-row">
          <DocsTree sections={treeSections()} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </LanguageProvider>
  );
}
