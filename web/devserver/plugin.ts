/**
 * Desktop companion endpoints for `npm run dev`.
 *
 * In a desktop browser the page cannot talk to the Roku TV (no CORS on ECP) or send UDP to
 * the PS5, so the Vite dev server does it on the page's behalf. On the Fire TV the native
 * Android bridge does the same jobs, so the page code is identical in both places.
 *
 *   GET  /api/health    -> { ok, ai: { envKey, baseUrl, model } }
 *   POST /api/http      -> HTTP request to a private-network host (Roku ECP, local LLM)
 *   POST /api/udp       -> one UDP datagram to a private-network host (PS5 discovery/wake)
 *   POST /api/ai/chat   -> OpenAI-compatible chat using OPENAI_API_KEY from the environment
 *
 * The API key never reaches the browser.
 */
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import dgram from "node:dgram";
import { isPrivateHost } from "./net";

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<any> =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

const aiConfig = () => ({
  key: process.env.OPENAI_API_KEY || "",
  baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
});

async function httpProxy(body: any) {
  const url = new URL(String(body.url));
  if (!["http:", "https:"].includes(url.protocol) || !isPrivateHost(url.hostname)) {
    return { status: 0, error: "Only private-network hosts are allowed through the dev proxy." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(body.timeoutMs) || 5000);
  try {
    const res = await fetch(url, {
      method: body.method || "GET",
      headers: body.headers || {},
      body: body.body ?? undefined,
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text() };
  } catch (e: any) {
    return { status: 0, error: e?.name === "AbortError" ? "timeout" : String(e?.cause?.code || e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

function udpSend(body: any): Promise<{ reply: string | null; error?: string }> {
  const host = String(body.host || "");
  if (!isPrivateHost(host)) return Promise.resolve({ reply: null, error: "Only private-network hosts are allowed." });
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    let done = false;
    const finish = (r: { reply: string | null; error?: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      resolve(r);
    };
    const timer = setTimeout(() => finish({ reply: null }), body.expectReply ? Number(body.timeoutMs) || 2000 : 300);
    socket.on("error", (e) => finish({ reply: null, error: String(e.message) }));
    socket.on("message", (msg) => finish({ reply: msg.toString("utf8") }));
    socket.bind(Number(body.localPort) || 0, () => {
      socket.send(Buffer.from(String(body.message), "utf8"), Number(body.port), host, (err) => {
        if (err) finish({ reply: null, error: String(err.message) });
      });
    });
  });
}

async function aiChat(body: any) {
  const cfg = aiConfig();
  if (!cfg.key) return { status: 400, body: { error: "OPENAI_API_KEY is not set for the dev server." } };
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: body.model || cfg.model, messages: body.messages, temperature: 0.6 }),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { error: text.slice(0, 500) } };
  }
}

export function grantosDevServer(): Plugin {
  return {
    name: "grantos-dev-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          if (req.method === "GET" && req.url === "/api/health") {
            const cfg = aiConfig();
            return json(res, 200, { ok: true, ai: { envKey: Boolean(cfg.key), baseUrl: cfg.baseUrl, model: cfg.model } });
          }
          if (req.method !== "POST") return json(res, 405, { error: "POST only" });
          const body = await readBody(req);
          if (req.url === "/api/http") return json(res, 200, await httpProxy(body));
          if (req.url === "/api/udp") return json(res, 200, await udpSend(body));
          if (req.url === "/api/ai/chat") {
            const r = await aiChat(body);
            return json(res, r.status, r.body);
          }
          return json(res, 404, { error: "unknown endpoint" });
        } catch (e: any) {
          return json(res, 500, { error: String(e?.message || e) });
        }
      });
    },
  };
}
