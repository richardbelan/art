import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const lmStudio = createOpenAICompatible({
  baseURL: "http://localhost:1234/v1",
  apiKey: "sk-1234",
  name: "lmStudio",
  headers: {
    "HTTP-Referer": "https://github.com/tychenjiajun/art", // Optional. Site URL for rankings on openrouter.ai.
    "X-Title":
      "Art - AI-driven RAW photo processor that generates optimized PP3 profiles for RawTherapee", // Optional. Site title for rankings on openrouter.ai.
  },
});
