import type { Heading } from "@/app/docs/_lib/content";
import { cn } from "@/lib/utils";

export function Toc({ headings }: { headings: Heading[] }) {
  if (headings.length < 2) return null;
  return (
    <nav aria-label="On this page" className="text-[12px]">
      <p className="text-muted-foreground mb-2 text-[11px] tracking-wider uppercase">
        On this page
      </p>
      <ul className="border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "text-muted-foreground hover:text-foreground block py-1 pr-2",
                heading.level === 2 ? "pl-3" : "pl-6",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
