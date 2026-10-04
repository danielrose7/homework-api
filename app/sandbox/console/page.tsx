import { ConsoleView } from "@/app/sandbox/console/_components/console-view";
import { readSandboxOptions } from "@/app/sandbox/_server/queries/read-options";

export default async function ConsolePage() {
  return <ConsoleView options={await readSandboxOptions()} />;
}
