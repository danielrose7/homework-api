import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Workbench } from "@/app/sandbox/_components/workbench";
import { sandboxEnabled } from "@/app/sandbox/_server/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sandbox · Homework API" };

export default function SandboxLayout({ children }: LayoutProps<"/sandbox">) {
  if (!sandboxEnabled()) notFound();
  return <Workbench>{children}</Workbench>;
}
