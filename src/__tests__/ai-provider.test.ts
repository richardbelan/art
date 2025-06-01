import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleProviderSetup } from "../utils/ai-provider.js";

// Mock the provider module
vi.mock("../provider.js", () => ({
  provider: vi.fn(),
}));

const { provider } = await import("../provider.js");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("handleProviderSetup", () => {
  it("should successfully setup provider", () => {
    const mockModel = { name: "test-model" };
    const mockProviderFunction = vi.fn().mockReturnValue(mockModel);
    vi.mocked(provider).mockReturnValue(mockProviderFunction);

    const result = handleProviderSetup("openai", "gpt-4");

    expect(provider).toHaveBeenCalledWith("openai");
    expect(mockProviderFunction).toHaveBeenCalledWith("gpt-4");
    expect(result).toBe(mockModel);
  });

  it("should handle provider setup error", () => {
    const error = new Error("Invalid provider");
    vi.mocked(provider).mockImplementation(() => {
      throw error;
    });

    expect(() => handleProviderSetup("invalid-provider", "model")).toThrow(
      "AI configuration error: Invalid provider",
    );
  });

  it("should handle unknown error during provider setup", () => {
    vi.mocked(provider).mockImplementation(() => {
      throw new Error("string error");
    });

    expect(() => handleProviderSetup("provider", "model")).toThrow(
      "AI configuration error: string error",
    );
  });

  it("should handle error from provider function call", () => {
    const mockProviderFunction = vi.fn().mockImplementation(() => {
      throw new Error("Model not found");
    });
    vi.mocked(provider).mockReturnValue(mockProviderFunction);

    expect(() => handleProviderSetup("openai", "invalid-model")).toThrow(
      "AI configuration error: Model not found",
    );
  });
});
