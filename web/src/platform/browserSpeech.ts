// Web Speech API helpers, used on desktop. The Fire TV WebView has no speech recognition,
// so the Android platform uses the native bridge instead.

export function browserSpeak(text: string): Promise<boolean> {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return Promise.resolve(false);
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  synth.speak(u);
  return Promise.resolve(true);
}

export function browserStopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

type Recognizer = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
};

function recognizerClass(): (new () => Recognizer) | undefined {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export const browserVoiceAvailable = () => Promise.resolve(typeof window !== "undefined" && Boolean(recognizerClass()));

export function browserListen(): Promise<{ text?: string; error?: string }> {
  const R = recognizerClass();
  if (!R) return Promise.resolve({ error: "This browser has no speech recognition. Type your message instead." });
  return new Promise((resolve) => {
    const r = new R();
    let done = false;
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      done = true;
      resolve({ text: String(e.results?.[0]?.[0]?.transcript || "") });
    };
    r.onerror = (e) => {
      done = true;
      resolve({ error: `Voice input failed (${e?.error || "unknown"}).` });
    };
    r.onend = () => !done && resolve({ error: "No speech heard." });
    r.start();
  });
}
