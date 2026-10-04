import { SANDBOX_SCHOOL } from "@/app/sandbox/_server/seed-data";
import { variableName, type RouteExample } from "@/lib/docs/examples";
import type { RouteDoc } from "@/lib/docs/types";

export type Language = "curl" | "python" | "node";

export const LANGUAGES: ReadonlyArray<{ id: Language; label: string }> = [
  { id: "curl", label: "curl" },
  { id: "python", label: "Python" },
  { id: "node", label: "Node" },
];

type Part = string | { variable: string };

/** The path as literal text and environment variables, with the school filled in as Sandbox. */
function pathParts(doc: RouteDoc, example: RouteExample): Part[] {
  const parts: Part[] = [];
  for (const piece of doc.path.split(/(\{\w+\})/)) {
    const placeholder = /^\{(\w+)\}$/.exec(piece)?.[1];
    if (placeholder === undefined) parts.push(piece);
    else if (placeholder === "org_slug") parts.push(SANDBOX_SCHOOL.slug);
    else parts.push({ variable: variableName(example, placeholder) });
  }
  return parts;
}

const variablesIn = (parts: Part[]) =>
  parts.flatMap((part) => (typeof part === "string" ? [] : [part.variable]));

const queryEntries = (example: RouteExample) =>
  Object.entries(example.query ?? {});

const indentTail = (text: string, spaces: number) =>
  text.split("\n").join(`\n${" ".repeat(spaces)}`);

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

function curlSnippet(doc: RouteDoc, example: RouteExample): string {
  const parts = pathParts(doc, example);
  const path = parts
    .map((part) => (typeof part === "string" ? part : `$${part.variable}`))
    .join("");
  const query = queryEntries(example)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
  const url = `"$HOST${path}${query ? `?${query}` : ""}"`;

  const prelude: string[] = [];
  const args = [
    `curl ${example.keeps_token ? "-s " : ""}-X ${doc.method} ${url}`,
  ];
  if (example.as !== null) args.push(`-H "Authorization: Bearer $TOKEN"`);
  const { body } = example;
  if (body?.kind === "json") {
    args.push(`-H 'Content-Type: application/json'`);
    args.push(`--data-raw ${shellQuote(JSON.stringify(body.value, null, 2))}`);
  } else if (body?.kind === "multipart") {
    for (const [name, value] of Object.entries(body.fields)) {
      args.push(`-F ${shellQuote(`${name}=${value}`)}`);
    }
    for (const file of body.files) {
      prelude.push(
        `printf '%s' ${shellQuote(file.content)} > ${file.filename}`,
      );
      args.push(
        `-F ${shellQuote(`${file.field}=@${file.filename};type=${file.content_type}`)}`,
      );
    }
  }
  if (example.save_as) args.push(`-o ${example.save_as}`);

  const command = args.join(" \\\n  ");
  return [
    ...prelude,
    example.keeps_token ? `export TOKEN=$(${command} | jq -r .token)` : command,
  ].join("\n");
}

function pythonLiteral(value: unknown, depth = 0): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  const pad = "    ".repeat(depth + 1);
  const close = "    ".repeat(depth);
  if (Array.isArray(value)) {
    const items = value.map(
      (item) => `${pad}${pythonLiteral(item, depth + 1)},`,
    );
    return `[\n${items.join("\n")}\n${close}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, item]) =>
      `${pad}${JSON.stringify(key)}: ${pythonLiteral(item, depth + 1)},`,
  );
  return `{\n${entries.join("\n")}\n${close}}`;
}

function pythonSnippet(doc: RouteDoc, example: RouteExample): string {
  const parts = pathParts(doc, example);
  const path = parts
    .map((part) =>
      typeof part === "string" ? part : `{${part.variable.toLowerCase()}}`,
    )
    .join("");
  const lines = [
    "import os",
    "import requests",
    "",
    `host = os.environ["HOST"]`,
  ];
  if (example.as !== null) lines.push(`token = os.environ["TOKEN"]`);
  for (const variable of variablesIn(parts)) {
    lines.push(`${variable.toLowerCase()} = os.environ["${variable}"]`);
  }
  lines.push("", `response = requests.${doc.method.toLowerCase()}(`);
  lines.push(`    f"{host}${path}",`);
  if (example.as !== null) {
    lines.push(`    headers={"Authorization": f"Bearer {token}"},`);
  }
  const query = queryEntries(example);
  if (query.length > 0) {
    lines.push(
      `    params=${indentTail(pythonLiteral(Object.fromEntries(query)), 4)},`,
    );
  }
  const { body } = example;
  if (body?.kind === "json") {
    lines.push(`    json=${indentTail(pythonLiteral(body.value), 4)},`);
  } else if (body?.kind === "multipart") {
    lines.push(`    data=${indentTail(pythonLiteral(body.fields), 4)},`);
    lines.push(`    files=[`);
    for (const file of body.files) {
      lines.push(
        `        (${JSON.stringify(file.field)}, (${JSON.stringify(file.filename)}, ${JSON.stringify(file.content)}, ${JSON.stringify(file.content_type)})),`,
      );
    }
    lines.push(`    ],`);
  }
  lines.push(")");

  if (example.save_as) {
    lines.push(
      `with open(${JSON.stringify(example.save_as)}, "wb") as saved:`,
      "    saved.write(response.content)",
      "print(response.status_code)",
    );
  } else if (example.keeps_token) {
    lines.push(
      `token = response.json()["token"]`,
      "print(response.status_code, token)",
    );
  } else {
    lines.push("print(response.status_code)", "print(response.json())");
  }
  return lines.join("\n");
}

const camelCase = (variable: string) =>
  variable
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

function nodeSnippet(doc: RouteDoc, example: RouteExample): string {
  const parts = pathParts(doc, example);
  const path = parts
    .map((part) =>
      typeof part === "string" ? part : `\${${camelCase(part.variable)}}`,
    )
    .join("");
  const lines: string[] = [];
  if (example.save_as)
    lines.push(`import { writeFile } from "node:fs/promises";`, "");
  lines.push("const host = process.env.HOST;");
  if (example.as !== null) lines.push("const token = process.env.TOKEN;");
  for (const variable of variablesIn(parts)) {
    lines.push(`const ${camelCase(variable)} = process.env.${variable};`);
  }
  lines.push("");

  const query = queryEntries(example);
  let target = `\`\${host}${path}\``;
  if (query.length > 0) {
    lines.push(
      `const query = new URLSearchParams(${indentTail(JSON.stringify(Object.fromEntries(query), null, 2), 0)});`,
      "",
    );
    target = `\`\${host}${path}?\${query}\``;
  }

  const init: string[] = [`  method: "${doc.method}",`];
  const headers: string[] = [];
  if (example.as !== null) headers.push("Authorization: `Bearer ${token}`");
  const { body } = example;
  if (body?.kind === "json") headers.push(`"Content-Type": "application/json"`);
  if (headers.length > 0) {
    init.push(
      "  headers: {",
      ...headers.map((header) => `    ${header},`),
      "  },",
    );
  }
  if (body?.kind === "json") {
    init.push(
      `  body: JSON.stringify(${indentTail(JSON.stringify(body.value, null, 2), 2)}),`,
    );
  } else if (body?.kind === "multipart") {
    lines.push("const form = new FormData();");
    for (const [name, value] of Object.entries(body.fields)) {
      lines.push(
        `form.append(${JSON.stringify(name)}, ${JSON.stringify(value)});`,
      );
    }
    for (const file of body.files) {
      lines.push(
        `form.append(${JSON.stringify(file.field)}, new Blob([${JSON.stringify(file.content)}], { type: ${JSON.stringify(file.content_type)} }), ${JSON.stringify(file.filename)});`,
      );
    }
    lines.push("");
    init.push("  body: form,");
  }
  lines.push(`const response = await fetch(${target}, {`, ...init, "});");

  if (example.save_as) {
    lines.push(
      `await writeFile(${JSON.stringify(example.save_as)}, Buffer.from(await response.arrayBuffer()));`,
      "console.log(response.status);",
    );
  } else if (example.keeps_token) {
    lines.push(
      "const { token } = await response.json();",
      "console.log(response.status, token);",
    );
  } else {
    lines.push("console.log(response.status, await response.json());");
  }
  return lines.join("\n");
}

export function renderSnippet(
  doc: RouteDoc,
  example: RouteExample,
  language: Language,
): string {
  switch (language) {
    case "curl":
      return curlSnippet(doc, example);
    case "python":
      return pythonSnippet(doc, example);
    case "node":
      return nodeSnippet(doc, example);
  }
}
