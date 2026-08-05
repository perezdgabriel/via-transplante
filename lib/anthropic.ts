import Anthropic from "@anthropic-ai/sdk";

// haiku for development, switch to claude-sonnet-5 in production via ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

// Lazy singleton — avoids constructing (and requiring the API key) at import/build time.
let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
