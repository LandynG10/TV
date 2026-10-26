import type { Settings } from "../lib/settings";
import type { Platform } from "../platform/types";
import { SYSTEM_PROMPT, type AiProvider, type ChatMessage } from "./types";

type AiSettings = Settings["ai"];

export function buildChatRequest(cfg: AiSettings, history: ChatMessage[]) {
  return {
    model: cfg.model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history.slice(-20)],
    temperature: 0.6,
  };
}

export function extractReply(json: any): string {
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text.trim();
  const err = json?.error?.message || json?.error;
  throw new Error(typeof err === "string" ? err : "The AI service returned no answer.");
}

const isPrivateUrl = (url: string) => {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || /^(10|127)\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(h);
  } catch {
    return false;
  }
};

/**
 * Any OpenAI-compatible Chat Completions endpoint: OpenAI (paid), or free local servers such as
 * Ollama (http://<pc-ip>:11434/v1) or LM Studio. The API key is entered on the TV in Settings
 * (stored only on the device) or, for the desktop preview, read by the dev server from
 * OPENAI_API_KEY. It is never in the source code.
 */
export function createOpenAiProvider(platform: Platform, cfg: AiSettings, devServerHasKey: boolean): AiProvider {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  return {
    id: "openai",
    label: `${cfg.model} via ${base}`,
    live: true,
    async reply(history) {
      const payload = buildChatRequest(cfg, history);

      // Desktop preview with the key in the dev server's environment.
      if (platform.kind === "desktop" && !cfg.apiKey && devServerHasKey) {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return extractReply(await res.json());
      }
      if (platform.kind === "simulated") throw new Error("The hardware simulator can't reach AI services. Switch Hardware mode to Auto.");

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      const url = `${base}/chat/completions`;

      // The Fire TV app sends it natively (no CORS limits); the desktop proxy handles LAN servers.
      if (platform.kind === "android" || isPrivateUrl(url)) {
        const r = await platform.http({ method: "POST", url, headers, body: JSON.stringify(payload), timeoutMs: 45000 });
        if (r.status === 0) throw new Error(r.error || "Couldn't reach the AI service.");
        let json: unknown;
        try {
          json = JSON.parse(r.body);
        } catch {
          throw new Error(`AI service answered HTTP ${r.status}.`);
        }
        return extractReply(json);
      }
      if (!cfg.apiKey) throw new Error("No API key. Add one in Settings → AI Assistant, or run the dev server with OPENAI_API_KEY set.");
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      return extractReply(await res.json());
    },
  };
}
