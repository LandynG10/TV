import { sanitizeSettings } from "../lib/settings";
import { fakePlatform } from "../test/fakePlatform";
import { demoAnswer, createDemoProvider } from "./demoProvider";
import { evaluateMath } from "./mathEval";
import { buildChatRequest, createOpenAiProvider, extractReply } from "./openaiProvider";

const now = new Date(2026, 9, 26, 19, 5);

describe("evaluateMath", () => {
  it.each([
    ["18 x 24", 432],
    ["2+3*4", 14],
    ["(2+3)*4", 20],
    ["2^10", 1024],
    ["-5 + 2", -3],
    ["10 / 4", 2.5],
  ])("%s = %d", (q, v) => expect(evaluateMath(q)).toBe(v));
  it("rejects anything that isn't arithmetic", () => {
    expect(evaluateMath("alert(1)")).toBeNull();
    expect(evaluateMath("2 +")).toBeNull();
    expect(evaluateMath("hello")).toBeNull();
  });
});

describe("demo mode", () => {
  it("answers time, date and maths locally", () => {
    expect(demoAnswer("What time is it?", now)).toBe("It's 7:05 PM.");
    expect(demoAnswer("what's the date today", now)).toBe("Today is Monday, October 26, 2026.");
    expect(demoAnswer("what is 18 x 24", now)).toMatch(/= 432$/);
  });
  it("is honest that it is not a real AI", () => {
    expect(demoAnswer("Explain quantum physics", now)).toMatch(/offline demo mode/);
  });
  it("provider replies to the last user message", async () => {
    const p = createDemoProvider(() => now);
    expect(p.live).toBe(false);
    expect(await p.reply([{ role: "user", content: "hello" }])).toMatch(/^Good evening\./);
  });
});

describe("OpenAI-compatible provider", () => {
  const ai = sanitizeSettings({ ai: { provider: "openai", baseUrl: "http://192.168.1.50:11434/v1/", model: "llama3.2" } }).ai;

  it("builds a chat request with the TV system prompt", () => {
    const req = buildChatRequest(ai, [{ role: "user", content: "hi" }]);
    expect(req.model).toBe("llama3.2");
    expect(req.messages[0].role).toBe("system");
    expect(req.messages[1]).toEqual({ role: "user", content: "hi" });
  });

  it("reads replies and surfaces API errors", () => {
    expect(extractReply({ choices: [{ message: { content: " Hi! " } }] })).toBe("Hi!");
    expect(() => extractReply({ error: { message: "Incorrect API key" } })).toThrow("Incorrect API key");
  });

  it("on the Fire TV, sends through the native bridge without a key for a local server", async () => {
    const { platform, calls } = fakePlatform({ http: () => ({ status: 200, body: JSON.stringify({ choices: [{ message: { content: "Hello" } }] }) }) });
    const reply = await createOpenAiProvider(platform, ai, false).reply([{ role: "user", content: "hi" }]);
    expect(reply).toBe("Hello");
    expect(calls.http[0].url).toBe("http://192.168.1.50:11434/v1/chat/completions");
    expect(calls.http[0].headers?.Authorization).toBeUndefined();
  });

  it("sends the key from Settings as a Bearer token", async () => {
    const { platform, calls } = fakePlatform({ http: () => ({ status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) }) });
    await createOpenAiProvider(platform, { ...ai, baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" }, false).reply([{ role: "user", content: "x" }]);
    expect(calls.http[0].headers?.Authorization).toBe("Bearer sk-test");
  });

  it("refuses in the hardware simulator instead of pretending", async () => {
    const { platform } = fakePlatform({ kind: "simulated", real: false });
    await expect(createOpenAiProvider(platform, ai, false).reply([{ role: "user", content: "x" }])).rejects.toThrow(/simulator/);
  });
});
