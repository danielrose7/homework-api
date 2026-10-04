import { InlineMarkdown } from "@/app/docs/_components/markdown";
import type { FieldDoc } from "@/lib/docs/fields";

export function FieldTable({ fields }: { fields: FieldDoc[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="border-b px-3 py-2 font-medium">Field</th>
            <th className="border-b px-3 py-2 font-medium">Type</th>
            <th className="border-b px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name}>
              <td className="border-b px-3 py-2 align-top whitespace-nowrap last:border-b-0">
                <code className="font-mono text-[13px]">{field.name}</code>
                {field.required ? (
                  <span className="text-warn ml-1.5 text-[11px]">required</span>
                ) : null}
              </td>
              <td className="text-muted-foreground border-b px-3 py-2 align-top font-mono text-[12.5px] last:border-b-0">
                {field.type}
              </td>
              <td className="border-b px-3 py-2 align-top last:border-b-0">
                <InlineMarkdown>{field.description}</InlineMarkdown>
                {field.default !== null || field.constraints.length > 0 ? (
                  <span className="text-muted-foreground block text-xs">
                    {[
                      field.default !== null
                        ? `default ${field.default}`
                        : null,
                      ...field.constraints,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
