export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProvider {
  id: "demo" | "openai";
  label: string;
  /** False for the offline demo, which only follows scripted rules. */
  live: boolean;
  reply(history: ChatMessage[]): Promise<string>;
}

export const SYSTEM_PROMPT =
  "You are the assistant built into GrantOS, a TV dashboard. Answers are read on a TV from across the room: " +
  "keep them short (at most 4 sentences or 5 bullet points), plain text, no markdown tables or code blocks unless asked.";
