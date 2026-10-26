import { formatDate, formatTime, meridiem } from "../lib/time";
import { greetingFor } from "../lib/greeting";
import { evaluateMath } from "./mathEval";
import type { AiProvider, ChatMessage } from "./types";

const JOKES = [
  "Why did the TV break up with the remote? It felt like it was always being pushed around.",
  "I'd tell you a joke about streaming, but it's still buffering.",
  "Why don't consoles ever get lonely? They always have a controller nearby.",
];

/**
 * Offline demo mode. It is NOT an AI: it matches a few patterns and answers from local data,
 * so it costs nothing and needs no internet. Connect a real provider in Settings → AI Assistant.
 */
export function demoAnswer(text: string, now: Date, jokeIndex = 0): string {
  const q = text.trim().toLowerCase().replace(/[?!.]+$/, "");
  if (!q) return "Ask me something. Try “what time is it?” or “how do I open the PS5?”";

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(q)) {
    return `${greetingFor(now)} I'm the GrantOS assistant in demo mode. I can tell you the time and date, do quick maths and explain how GrantOS works.`;
  }
  if (/\btime\b/.test(q) && !/\btimer\b/.test(q)) {
    return `It's ${formatTime(now, "12h", false)} ${meridiem(now)}.`;
  }
  if (/\b(date|day is it|today)\b/.test(q)) return `Today is ${formatDate(now, "long")}, ${now.getFullYear()}.`;
  if (/\bjoke\b/.test(q)) return JOKES[jokeIndex % JOKES.length];

  const mathPart = q.replace(/^(what('| i)?s|calculate|compute|how much is)\s+/, "");
  const math = evaluateMath(mathPart);
  if (math !== null) return `${mathPart.replace(/\s+/g, " ")} = ${Number(math.toFixed(6))}`;

  if (/\b(ps5|playstation)\b/.test(q)) {
    return "Pick the PS5 tile. GrantOS checks the console, tries to wake it if you've added a Remote Play credential, then switches the TV to the PS5's HDMI input. Set the input number in Settings → PlayStation 5.";
  }
  if (/\bviu\b/.test(q)) return "Pick the VIU tile to open VIU directly. If it isn't set up yet, go to Settings → Applications → Detect installed apps.";
  if (/\byoutube\b/.test(q)) return "Pick the YouTube tile. It opens the Fire TV YouTube app directly, without the Amazon home screen.";
  if (/\b(goodbye|turn off|power off|shut ?down|sleep)\b/.test(q)) {
    return "Choose Goodbye under the tiles. GrantOS plays a short farewell and then asks the Roku TV to go to standby, if you've set the TV's IP address in Settings.";
  }
  if (/\b(setting|wallpaper|background|theme)\b/.test(q)) return "Open Settings below the tiles to change the theme, wallpaper, clock, greeting and Goodbye message.";
  if (/\b(who|what) are you\b|\bwhat can you do\b|\bhelp\b/.test(q)) {
    return "I'm the GrantOS assistant running in free demo mode. I know the time and date, simple maths and how GrantOS works. For real answers, connect an OpenAI-compatible service (or a free local one like Ollama) in Settings → AI Assistant.";
  }
  return "I'm in offline demo mode, so I can only answer a few things: the time, the date, simple maths, a joke, and how to use GrantOS. Connect a real AI provider in Settings → AI Assistant for anything else.";
}

export function createDemoProvider(now: () => Date = () => new Date()): AiProvider {
  let jokes = 0;
  return {
    id: "demo",
    label: "Demo mode (offline, scripted)",
    live: false,
    async reply(history: ChatMessage[]) {
      const last = [...history].reverse().find((m) => m.role === "user");
      const text = last?.content ?? "";
      const answer = demoAnswer(text, now(), jokes);
      if (/\bjoke\b/i.test(text)) jokes++;
      await new Promise((r) => setTimeout(r, 350)); // A short "thinking" pause so the UI flow matches a live provider.
      return answer;
    },
  };
}
