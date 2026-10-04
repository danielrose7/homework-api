import { ConsoleView } from "@/app/sandbox/console/_components/console-view";
import { readDemoOptions } from "@/modules/demo/queries/read-options";

export default async function ConsolePage() {
  return <ConsoleView options={await readDemoOptions()} />;
}
