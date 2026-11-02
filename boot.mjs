import http from "node:http";

const lines = ["boot"];
let appFetch = null;

function redact(text) {
  return String(text)
    .replace(/postgresql:\/\/\S+/gi, "postgresql://***")
    .replace(/Bot\s+[A-Za-z0-9._-]{20,}/g, "Bot ***")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}/g, "***");
}

function push(line) {
  lines.push(`${new Date().toISOString()} ${redact(line).slice(0, 800)}`);
  if (lines.length > 80) {
    lines.shift();
  }
}

function authorized(req) {
  const apiKey = process.env.API_KEY || "";
  if (!apiKey) return true;
  return req.headers["x-api-key"] === apiKey;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const port = Number(process.env.API_PORT || 3000);
const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res.statusCode = 401;
      res.end('{"error":"Invalid or missing API key"}');
      return;
    }

    if (!appFetch || req.url === "/boot") {
      res.writeHead(appFetch ? 200 : 503, {
        "content-type": "text/plain; charset=utf-8",
      });
      res.end(lines.join("\n") + "\n");
      return;
    }

    const host = req.headers.host ?? "127.0.0.1";
    const method = req.method ?? "GET";
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const hasBody = method !== "GET" && method !== "HEAD";
    const body = hasBody ? await readBody(req) : undefined;
    const response = await appFetch(new Request(`http://${host}${req.url ?? "/"}`, { method, headers, body }));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    push(`request failed ${error?.stack || error}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(lines.join("\n"));
    }
  }
});

server.listen(port, "0.0.0.0", () => push(`listening ${port}`));

process.on("uncaughtException", (error) => {
  push(`uncaught ${error?.stack || error}`);
});

process.on("unhandledRejection", (error) => {
  const text = error instanceof Error ? error.stack : String(error);
  push(`reject ${text}`);
});

process.env.LOFI_BOOT = "1";

try {
  const mod = await import("./dist/index.js");
  push("imported");
  if (typeof mod.getApiFetch === "function") {
    appFetch = mod.getApiFetch();
    push(appFetch ? "api attached" : "api disabled");
  }
  if (typeof mod.main === "function") {
    await mod.main();
    push("discord login returned");
  }
} catch (error) {
  push(`startup failed ${error?.stack || error}`);
}
