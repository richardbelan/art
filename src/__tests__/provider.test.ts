import { describe, expect, it, vi } from "vitest";
import { provider } from "../provider.js";

// Mock all the AI SDK providers
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(),
}));

vi.mock("../providers/openai-compatible.js", () => ({
  openaiCompatible: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(),
}));

vi.mock("@ai-sdk/xai", () => ({
  xai: vi.fn(),
}));

vi.mock("@ai-sdk/mistral", () => ({
  mistral: vi.fn(),
}));

vi.mock("@ai-sdk/deepinfra", () => ({
  deepinfra: vi.fn(),
}));

vi.mock("@ai-sdk/amazon-bedrock", () => ({
  bedrock: vi.fn(),
}));

vi.mock("@ai-sdk/azure", () => ({
  azure: vi.fn(),
}));

vi.mock("@ai-sdk/fireworks", () => ({
  fireworks: vi.fn(),
}));

vi.mock("@ai-sdk/togetherai", () => ({
  togetherai: vi.fn(),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  openrouter: vi.fn(),
}));

describe("provider", () => {
  it("should return openai provider", () => {
    const result = provider("openai");
    expect(result).toBeDefined();
  });

  it("should return openai-compatible provider", () => {
    const result = provider("openai-compatible");
    expect(result).toBeDefined();
  });

  it("should return anthropic provider", () => {
    const result = provider("anthropic");
    expect(result).toBeDefined();
  });

  it("should return google provider", () => {
    const result = provider("google");
    expect(result).toBeDefined();
  });

  it("should return xai provider", () => {
    const result = provider("xai");
    expect(result).toBeDefined();
  });

  it("should return mistral provider", () => {
    const result = provider("mistral");
    expect(result).toBeDefined();
  });

  it("should return deepinfra provider", () => {
    const result = provider("deepinfra");
    expect(result).toBeDefined();
  });

  it("should return bedrock provider", () => {
    const result = provider("bedrock");
    expect(result).toBeDefined();
  });

  it("should return azure provider", () => {
    const result = provider("azure");
    expect(result).toBeDefined();
  });

  it("should return fireworks provider", () => {
    const result = provider("fireworks");
    expect(result).toBeDefined();
  });

  it("should return togetherai provider", () => {
    const result = provider("togetherai");
    expect(result).toBeDefined();
  });

  it("should return openrouter provider", () => {
    const result = provider("openrouter");
    expect(result).toBeDefined();
  });

  it("should throw error for unsupported provider", () => {
    expect(() => provider("unsupported-provider")).toThrow(
      "Unsupported provider: unsupported-provider. Available providers: openai, openai-compatible, anthropic, google, xai, mistral, deepinfra, bedrock, azure, fireworks, togetherai, openrouter",
    );
  });

  it("should throw error for empty provider name", () => {
    expect(() => provider("")).toThrow(
      "Unsupported provider: . Available providers: openai, openai-compatible, anthropic, google, xai, mistral, deepinfra, bedrock, azure, fireworks, togetherai, openrouter",
    );
  });
});
