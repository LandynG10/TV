import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createProvider, type ChatMessage } from "../ai";
import { MicIcon, SendIcon, SpeakerIcon, TrashIcon } from "../components/Icons";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useSettings } from "../lib/SettingsContext";
import { focusFirst } from "../lib/spatialNav";
import { devServerAiStatus } from "../platform";
import { usePlatform } from "../platform/PlatformContext";

interface Entry extends ChatMessage {
  id: number;
  error?: boolean;
}

const SUGGESTIONS = ["What time is it?", "How do I open the PS5?", "Tell me a joke", "What is 18 × 24?"];

let nextId = 1;

export function Assistant() {
  const platform = usePlatform();
  const { settings, update } = useSettings();
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [devKey, setDevKey] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (platform.kind === "desktop") devServerAiStatus().then((s) => setDevKey(Boolean(s?.envKey)));
  }, [platform]);

  const provider = useMemo(() => createProvider(platform, settings.ai, devKey), [platform, settings.ai, devKey]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [entries, busy]);

  useEffect(() => () => platform.stopSpeaking(), [platform]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const user: Entry = { id: nextId++, role: "user", content: q };
    const history = [...entries.filter((e) => !e.error), user].map(({ role, content }) => ({ role, content }));
    setEntries((e) => [...e, user]);
    setInput("");
    setBusy(true);
    // A suggestion button that was just pressed disappears; keep the remote's focus on screen.
    requestAnimationFrame(() => {
      const root = rootRef.current;
      if (root && !root.contains(document.activeElement)) focusFirst(root);
    });
    try {
      const answer = await provider.reply(history);
      setEntries((e) => [...e, { id: nextId++, role: "assistant", content: answer }]);
      if (settings.ai.speakReplies) platform.speak(answer);
    } catch (err) {
      setEntries((e) => [...e, { id: nextId++, role: "assistant", content: (err as Error).message || String(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const voice = async () => {
    if (listening) return;
    if (!(await platform.voiceAvailable())) {
      toast(
        platform.kind === "android"
          ? "Voice input isn't available: this Fire TV has no speech recognition service for apps (the remote's mic button belongs to Alexa). Type your message instead."
          : "Voice input isn't available in this browser. Try Chrome or Edge, or type your message.",
        { kind: "warn" },
      );
      return;
    }
    setListening(true);
    const r = await platform.listen();
    setListening(false);
    if (r.text) send(r.text);
    else toast(r.error || "No speech heard.", { kind: "warn" });
  };

  const clear = () => {
    platform.stopSpeaking();
    setEntries([]);
    requestAnimationFrame(() => rootRef.current && focusFirst(rootRef.current));
  };

  const badge = provider.live ? (
    <span className="badge badge--live">
      <span className="badge__dot" />
      Live · {settings.ai.model}
    </span>
  ) : (
    <span className="badge badge--warn" data-testid="ai-demo-badge">
      <span className="badge__dot" />
      Demo mode · offline, scripted
    </span>
  );

  return (
    <main className="screen" data-nav-root ref={rootRef} data-testid="assistant">
      <TopBar title="Assistant" right={badge} showClock />
      <section className="chat">
        <div className="chat__log" ref={logRef} aria-live="polite">
          {entries.length === 0 ? (
            <div className="chat__empty">
              <h2>How can I help?</h2>
              <p>
                {provider.live
                  ? "Ask anything. Answers appear here and can be read aloud."
                  : "Demo mode is free and offline: it knows the time, the date, quick maths and how GrantOS works. Connect a real AI in Settings."}
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} className="pill pill--small" data-nav data-autofocus={i === 0 ? "" : undefined} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className={`msg msg--${e.role}${e.error ? " msg--error" : ""}`}
                tabIndex={-1}
                data-nav
                data-testid={`msg-${e.role}`}
              >
                {e.role === "assistant" && <span className="msg__meta">{e.error ? "Problem" : provider.live ? "Assistant" : "Assistant · demo"}</span>}
                {e.content}
              </div>
            ))
          )}
          {busy && (
            <div className="msg msg--assistant" aria-label="Thinking">
              <span className="typing">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <button
            type="button"
            className={`icon-btn${listening ? " icon-btn--listening" : ""}`}
            data-nav
            data-autofocus={entries.length ? "" : undefined}
            onClick={voice}
            aria-label="Voice input"
            title="Voice input"
          >
            <MicIcon />
          </button>
          <input
            className="composer__input"
            data-nav
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Type a message"}
            aria-label="Message"
            enterKeyHint="send"
            data-testid="chat-input"
          />
          <button type="submit" className="icon-btn" data-nav aria-label="Send" title="Send" aria-disabled={busy}>
            <SendIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            data-nav
            data-active={settings.ai.speakReplies}
            aria-pressed={settings.ai.speakReplies}
            aria-label="Read replies aloud"
            title="Read replies aloud"
            onClick={() => {
              const on = !settings.ai.speakReplies;
              update("ai", { speakReplies: on });
              if (!on) platform.stopSpeaking();
              toast(on ? "Replies will be read aloud." : "Spoken replies off.");
            }}
          >
            <SpeakerIcon />
          </button>
          <button type="button" className="icon-btn" data-nav aria-label="Clear conversation" title="Clear conversation" onClick={clear}>
            <TrashIcon />
          </button>
        </form>
      </section>
    </main>
  );
}
