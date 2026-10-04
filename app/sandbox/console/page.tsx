import { ConsoleView } from "@/app/sandbox/console/_components/console-view";
import { readCatalog } from "@/app/sandbox/_server/queries/read-catalog";
import { readSandboxOptions } from "@/app/sandbox/_server/queries/read-options";

export default async function ConsolePage() {
  return (
    <ConsoleView catalog={readCatalog()} options={await readSandboxOptions()} />
  );
}
