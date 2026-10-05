import { InlineMarkdown } from "@/app/docs/_components/markdown";
import { EXAMPLE_VARIABLES } from "@/app/docs/_lib/examples";

export function RunExamplesVariables() {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-[12.5px]">
        <tbody>
          {EXAMPLE_VARIABLES.map((variable) => (
            <tr key={variable.name}>
              <td className="border-b px-3 py-2 align-top font-bold last:border-b-0">
                {variable.name}
              </td>
              <td className="border-b px-3 py-2 align-top last:border-b-0">
                <InlineMarkdown>{variable.description}</InlineMarkdown>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
