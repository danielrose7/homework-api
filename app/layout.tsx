import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import { ThemeSync } from "@/app/_components/theme-sync";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Homework API", template: "%s · Homework API" },
  description:
    "A multi-school REST API for submitting and grading homework, with live docs and a sandbox to try it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
