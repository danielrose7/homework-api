"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GITHUB_URL } from "@/app/_components/github";
import { cn } from "@/lib/utils";

export function SiteNav({
  section,
  sandbox,
}: {
  section?: string;
  sandbox: boolean;
}) {
  const pathname = usePathname();
  const links = [
    ["/docs", "Docs"],
    ...(sandbox ? [["/sandbox", "Sandbox"]] : []),
  ] as const;
  return (
    <div className="flex items-baseline gap-x-5 gap-y-1">
      <Link href="/" className="flex items-baseline gap-2 font-bold">
        homework-api
        {section && (
          <span className="text-muted-foreground font-normal">/ {section}</span>
        )}
      </Link>
      <nav aria-label="Site" className="flex items-baseline gap-4">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
            className={cn(
              pathname.startsWith(href)
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
        <a
          href={GITHUB_URL}
          className="text-muted-foreground hover:text-foreground"
        >
          GitHub
        </a>
      </nav>
    </div>
  );
}
