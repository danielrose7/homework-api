import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
  500: "Internal Server Error",
};

export function StatusChip({ status }: { status: number }) {
  const tone =
    status < 300
      ? "bg-good/15 text-good"
      : status < 500
        ? "bg-warn/15 text-warn"
        : "bg-destructive/15 text-destructive";
  return (
    <span
      className={cn("rounded px-1.5 text-[11.5px] whitespace-nowrap", tone)}
    >
      {status} {STATUS_TEXT[status] ?? ""}
    </span>
  );
}

export interface GradeLike {
  label: string;
  group: string | null;
}

export function GradeChip({ grade }: { grade: GradeLike | null }) {
  if (!grade) {
    return (
      <span className="text-muted-foreground rounded border border-dashed px-1.5 text-[11.5px]">
        ungraded
      </span>
    );
  }
  const group = grade.group ?? grade.label;
  const tone = ["A", "B", "Pass"].includes(group)
    ? "bg-good/15 text-good"
    : group === "C"
      ? "bg-warn/15 text-warn"
      : ["D", "F", "Fail"].includes(group)
        ? "bg-destructive/15 text-destructive"
        : "bg-info/15 text-info";
  return (
    <span className={cn("rounded px-1.5 text-[11.5px]", tone)}>
      {grade.label}
    </span>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "good" | "bad";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-2 rounded-md px-3 py-2",
        tone === "good"
          ? "bg-good/15 text-good"
          : "bg-destructive/15 text-destructive",
      )}
    >
      {children}
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card rounded-lg border", className)}>
      <h3 className="text-muted-foreground flex items-center gap-2 border-b px-3.5 py-2.5 text-xs font-medium tracking-wider uppercase">
        {title}
        {aside ? (
          <span className="ml-auto tracking-normal normal-case">{aside}</span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

export const inputClass =
  "bg-background border-input rounded border px-2 py-1 text-[12.5px] focus-visible:ring-2 focus-visible:ring-ring/60 outline-none";

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
