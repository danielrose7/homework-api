"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MethodTag } from "@/app/_components/method-tag";
import type { TreeSection } from "@/app/docs/_lib/nav";
import { cn } from "@/lib/utils";

function Tree({ sections }: { sections: TreeSection[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-muted-foreground mb-1.5 px-2 text-[11px] tracking-wider uppercase">
            {section.title}
          </p>
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-baseline gap-2 rounded-md px-2 py-1",
                      active
                        ? "bg-muted text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.method ? (
                      <MethodTag
                        method={item.method}
                        className="w-9 shrink-0"
                      />
                    ) : null}
                    <span className="min-w-0">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsTree({ sections }: { sections: TreeSection[] }) {
  return (
    <>
      <details className="bg-card border-b px-4 py-2 lg:hidden">
        <summary className="cursor-pointer font-bold">Documentation</summary>
        <div className="pt-3 pb-2">
          <Tree sections={sections} />
        </div>
      </details>
      <aside className="hidden w-60 shrink-0 border-r lg:block">
        <div className="sticky top-[41px] max-h-[calc(100dvh-41px)] overflow-y-auto px-3 py-6">
          <Tree sections={sections} />
        </div>
      </aside>
    </>
  );
}
