"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "@/app/docs/_components/language";
import { Button } from "@/app/_components/button";
import { LANGUAGES, type Language } from "@/app/docs/_lib/snippets";
import { cn } from "@/lib/utils";

export interface ExampleView {
  id: string;
  title: string;
  as: string | null;
  status: number;
  code?: string;
  snippets: Record<Language, string>;
}

export function ExampleBlock({ example }: { example: ExampleView }) {
  const [language, setLanguage] = useLanguage();
  const [copied, setCopied] = useState(false);
  const snippet = example.snippets[language];

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused; the snippet is still selectable.
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1">
        <div role="tablist" aria-label="Language" className="flex gap-1">
          {LANGUAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${example.id}-${id}-tab`}
              aria-selected={language === id}
              aria-controls={`${example.id}-panel`}
              onClick={() => setLanguage(id)}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                language === id
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => void copy()}
          aria-label="Copy to clipboard"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        role="tabpanel"
        id={`${example.id}-panel`}
        aria-labelledby={`${example.id}-${language}-tab`}
        tabIndex={0}
        className="overflow-x-auto p-3 font-mono text-[13px] leading-6"
      >
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
