import type { Settings } from "../lib/settings";
import type { Platform } from "../platform/types";
import { createDemoProvider } from "./demoProvider";
import { createOpenAiProvider } from "./openaiProvider";
import type { AiProvider } from "./types";

export type { AiProvider, ChatMessage } from "./types";

export function createProvider(platform: Platform, ai: Settings["ai"], devServerHasKey: boolean): AiProvider {
  return ai.provider === "openai" ? createOpenAiProvider(platform, ai, devServerHasKey) : createDemoProvider();
}
