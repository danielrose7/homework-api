import { cn } from "@/lib/utils";

export function MethodTag({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const color =
    method === "GET"
      ? "text-method-get"
      : method === "POST"
        ? "text-method-post"
        : method === "DELETE"
          ? "text-destructive"
          : "text-method-put";
  return (
    <span className={cn("text-[11px] font-bold", color, className)}>
      {method}
    </span>
  );
}
