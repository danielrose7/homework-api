import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toCurl } from "@/app/sandbox/_lib/curl";
import type { Exchange } from "@/app/sandbox/_lib/exchange-store";

interface Echo {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

const exec = promisify(execFile);

let server: Server;
let origin = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const echo: Echo = {
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(echo));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

function exchange(overrides: Partial<Exchange>): Exchange {
  return {
    id: 1,
    at: Date.now(),
    method: "GET",
    path: "/api/v1/orgs/sandbox/submissions/me",
    persona: "maya",
    requestHeaders: { accept: "application/json" },
    requestBody: null,
    status: 200,
    statusText: "OK",
    responseHeaders: {},
    responseText: "",
    json: null,
    ms: 1,
    ...overrides,
  };
}

/** Runs the generated command through a real shell, as a person pasting it would. */
async function run(source: Exchange): Promise<Echo> {
  const command = toCurl(source, origin);
  const { stdout } = await exec("sh", ["-c", `${command} -s`]);
  return JSON.parse(stdout) as Echo;
}

describe("toCurl", () => {
  it("replays a GET with a query string and bearer token", async () => {
    const echo = await run(
      exchange({
        path: "/api/v1/orgs/sandbox/submissions/me?grade=B&assignment=gatsby%20essay",
        requestHeaders: {
          accept: "application/json",
          authorization: "Bearer abc.def+ghi/jkl=",
        },
      }),
    );
    expect(echo.method).toBe("GET");
    expect(echo.url).toBe(
      "/api/v1/orgs/sandbox/submissions/me?grade=B&assignment=gatsby%20essay",
    );
    expect(echo.headers.authorization).toBe("Bearer abc.def+ghi/jkl=");
    expect(echo.body).toBe("");
  });

  it("sends a JSON body byte for byte, including quotes, newlines and unicode", async () => {
    const body = JSON.stringify(
      { text: 'It\'s "quoted"\nnew line – café ✓ $HOME `x`', n: 1 },
      null,
      2,
    );
    const echo = await run(
      exchange({
        method: "PUT",
        path: "/api/v1/orgs/sandbox/submissions/abc/grade",
        requestHeaders: {
          accept: "application/json",
          "content-type": "application/json",
        },
        requestBody: body,
      }),
    );
    expect(echo.method).toBe("PUT");
    expect(echo.headers["content-type"]).toBe("application/json");
    expect(echo.body).toBe(body);
  });

  it("sends a malformed or @-prefixed body as written", async () => {
    const echo = await run(
      exchange({
        method: "POST",
        requestHeaders: { "content-type": "application/json" },
        requestBody: "@not-a-file {oops",
      }),
    );
    expect(echo.body).toBe("@not-a-file {oops");
  });

  it("sends no Authorization header when the exchange had none", async () => {
    const echo = await run(exchange({}));
    expect(echo.headers.authorization).toBeUndefined();
  });
});
