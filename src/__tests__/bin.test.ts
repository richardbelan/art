import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock process.exit to prevent it from actually exiting during tests
vi.stubGlobal("process", {
  ...process,
  exit: vi.fn(),
});

// Import after mocking process
const { processImage } = await import("../bin.js");

// Mock dependencies
vi.mock("../raw-therapee-wrap.js", () => ({
  convertDngToImageWithPP3: vi.fn(),
}));

vi.mock("../agent.js", () => ({
  generatePP3FromRawImage: vi.fn(),
  generateMultiPP3FromRawImage: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    constants: { R_OK: 4 },
    promises: {
      access: vi.fn(),
      writeFile: vi.fn(),
      copyFile: vi.fn(),
      unlink: vi.fn(),
    },
  };
});

const { convertDngToImageWithPP3 } = await import("../raw-therapee-wrap.js");
const { generatePP3FromRawImage, generateMultiPP3FromRawImage } = await import(
  "../agent.js"
);
const fs = await import("node:fs");

beforeEach(() => {
  vi.resetAllMocks();

  // Mock fs.promises.access to succeed by default
  vi.mocked(fs.promises.access).mockResolvedValue();

  // Mock generatePP3FromRawImage to return sample PP3 content
  vi.mocked(generatePP3FromRawImage).mockResolvedValue("sample pp3 content");

  // Mock convertDngToImageWithPP3 to succeed
  vi.mocked(convertDngToImageWithPP3).mockResolvedValue();

  // Mock file operations to succeed
  vi.mocked(fs.promises.writeFile).mockResolvedValue();
  vi.mocked(fs.promises.copyFile).mockResolvedValue();
  vi.mocked(fs.promises.unlink).mockResolvedValue();
});

describe("processImage", () => {
  it("should throw error for empty input path", async () => {
    await expect(processImage("")).rejects.toThrow(
      "Input path cannot be empty",
    );
  });

  it("should throw error when input file not found", async () => {
    const error = new Error("File not found");
    Object.defineProperty(error, "code", { value: "ENOENT" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(processImage("/nonexistent/file.dng")).rejects.toThrow(
      "Input file not found: /nonexistent/file.dng",
    );
  });

  it("should throw error when permission denied reading input file", async () => {
    const error = new Error("Permission denied");
    Object.defineProperty(error, "code", { value: "EACCES" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(processImage("/restricted/file.dng")).rejects.toThrow(
      "Permission denied reading input file: /restricted/file.dng",
    );
  });

  it("should handle generic file access error", async () => {
    const error = new Error("Generic error");
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(processImage("/path/to/file.dng")).rejects.toThrow(
      "Generic error",
    );
  });

  it("should process image in single generation mode", async () => {
    await processImage("/path/to/input.dng", {
      output: "/path/to/output.pp3",
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith({
      inputPath: "/path/to/input.dng",
      basePP3Path: undefined,
      providerName: "openai",
      visionModel: "gpt-4-vision-preview",
      verbose: undefined,
      keepPreview: undefined,
      prompt: undefined,
      preset: undefined,
      sections: undefined,
      previewQuality: undefined,
      previewFormat: undefined,
      maxRetries: undefined,
      generations: undefined,
    });

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      "/path/to/output.pp3",
      "sample pp3 content",
    );
    expect(convertDngToImageWithPP3).toHaveBeenCalled();
  });

  it("should handle PP3-only mode", async () => {
    await processImage("/path/to/input.dng", {
      pp3Only: true,
    });

    expect(generatePP3FromRawImage).toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(convertDngToImageWithPP3).not.toHaveBeenCalled();
  });

  it("should handle multi-generation mode", async () => {
    const mockMultiResult = {
      bestResult: {
        generationIndex: 1,
        pp3Content: "best pp3 content",
        pp3Path: "/path/to/best.pp3",
        processedImagePath: "/path/to/best_processed.jpg",
      },
      allResults: [
        {
          generationIndex: 0,
          pp3Content: "pp3 content 1",
          pp3Path: "/path/to/gen1.pp3",
          processedImagePath: "/path/to/gen1_processed.jpg",
        },
        {
          generationIndex: 1,
          pp3Content: "best pp3 content",
          pp3Path: "/path/to/best.pp3",
          processedImagePath: "/path/to/best_processed.jpg",
        },
      ],
      evaluationReason: "Generation 2 has better exposure and color balance",
    };

    vi.mocked(generateMultiPP3FromRawImage).mockResolvedValue(mockMultiResult);

    await processImage("/path/to/input.dng", {
      generations: 2,
      verbose: true,
    });

    expect(generateMultiPP3FromRawImage).toHaveBeenCalledWith({
      inputPath: "/path/to/input.dng",
      basePP3Path: undefined,
      providerName: "openai",
      visionModel: "gpt-4-vision-preview",
      verbose: true,
      keepPreview: undefined,
      prompt: undefined,
      preset: undefined,
      sections: undefined,
      previewQuality: undefined,
      previewFormat: undefined,
      maxRetries: undefined,
      generations: 2,
      outputFormat: "jpeg",
      outputQuality: undefined,
      tiffCompression: undefined,
      bitDepth: 16,
    });

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      "/path/to/input.pp3",
      "best pp3 content",
    );
  });

  it("should handle multi-generation PP3-only mode", async () => {
    const mockMultiResult = {
      bestResult: {
        generationIndex: 0,
        pp3Content: "best pp3 content",
        pp3Path: "/path/to/best.pp3",
        processedImagePath: "/path/to/best_processed.jpg",
      },
      allResults: [],
      evaluationReason: "Only one generation",
    };

    vi.mocked(generateMultiPP3FromRawImage).mockResolvedValue(mockMultiResult);

    await processImage("/path/to/input.dng", {
      generations: 2,
      pp3Only: true,
    });

    expect(generateMultiPP3FromRawImage).toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(fs.promises.copyFile).not.toHaveBeenCalled();
  });

  it("should handle different output formats", async () => {
    await processImage("/path/to/input.dng", {
      tiff: true,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "tiff",
      }),
    );
  });

  it("should handle PNG format", async () => {
    await processImage("/path/to/input.dng", {
      png: true,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "png",
      }),
    );
  });

  it("should default to JPEG format", async () => {
    await processImage("/path/to/input.dng");

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "jpeg",
      }),
    );
  });

  it("should handle sections parameter", async () => {
    await processImage("/path/to/input.dng", {
      sections: "Exposure,ColorToning,Detail",
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: ["Exposure", "ColorToning", "Detail"],
      }),
    );
  });

  it("should filter empty sections", async () => {
    await processImage("/path/to/input.dng", {
      sections: "Exposure, ,ColorToning, ",
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: ["Exposure", "ColorToning"],
      }),
    );
  });

  it("should throw error when PP3 generation fails", async () => {
    vi.mocked(generatePP3FromRawImage).mockResolvedValue(null);

    await expect(processImage("/path/to/input.dng")).rejects.toThrow(
      "Failed to generate PP3 content",
    );
  });

  it("should handle multi-generation cleanup when not verbose", async () => {
    const mockMultiResult = {
      bestResult: {
        generationIndex: 1,
        pp3Content: "best pp3 content",
        pp3Path: "/path/to/best.pp3",
        processedImagePath: "/path/to/best_processed.jpg",
      },
      allResults: [
        {
          generationIndex: 0,
          pp3Content: "pp3 content 1",
          pp3Path: "/path/to/gen1.pp3",
          processedImagePath: "/path/to/gen1_processed.jpg",
        },
        {
          generationIndex: 1,
          pp3Content: "best pp3 content",
          pp3Path: "/path/to/best.pp3",
          processedImagePath: "/path/to/best_processed.jpg",
        },
      ],
      evaluationReason: "Generation 2 is better",
    };

    vi.mocked(generateMultiPP3FromRawImage).mockResolvedValue(mockMultiResult);

    await processImage("/path/to/input.dng", {
      generations: 2,
      verbose: false,
      keepPreview: false,
    });

    // Should clean up non-best results
    expect(fs.promises.unlink).toHaveBeenCalledWith("/path/to/gen1.pp3");
    expect(fs.promises.unlink).toHaveBeenCalledWith(
      "/path/to/gen1_processed.jpg",
    );
  });

  it("should handle cleanup errors gracefully", async () => {
    const mockMultiResult = {
      bestResult: {
        generationIndex: 1,
        pp3Content: "best pp3 content",
        pp3Path: "/path/to/best.pp3",
        processedImagePath: "/path/to/best_processed.jpg",
      },
      allResults: [
        {
          generationIndex: 0,
          pp3Content: "pp3 content 1",
          pp3Path: "/path/to/gen1.pp3",
          processedImagePath: "/path/to/gen1_processed.jpg",
        },
        {
          generationIndex: 1,
          pp3Content: "best pp3 content",
          pp3Path: "/path/to/best.pp3",
          processedImagePath: "/path/to/best_processed.jpg",
        },
      ],
      evaluationReason: "Generation 2 is better",
    };

    vi.mocked(generateMultiPP3FromRawImage).mockResolvedValue(mockMultiResult);
    vi.mocked(fs.promises.unlink).mockRejectedValue(
      new Error("Cleanup failed"),
    );

    // Should not throw error even if cleanup fails
    await expect(
      processImage("/path/to/input.dng", {
        generations: 2,
        verbose: false,
      }),
    ).resolves.toBeUndefined();
  });

  it("should copy best result to final output when paths differ", async () => {
    const mockMultiResult = {
      bestResult: {
        generationIndex: 0,
        pp3Content: "best pp3 content",
        pp3Path: "/path/to/best.pp3",
        processedImagePath: "/path/to/temp_processed.jpg",
      },
      allResults: [],
      evaluationReason: "Only one generation",
    };

    vi.mocked(generateMultiPP3FromRawImage).mockResolvedValue(mockMultiResult);

    await processImage("/path/to/input.dng", {
      generations: 2,
      output: "/path/to/final_output.jpg",
    });

    expect(fs.promises.copyFile).toHaveBeenCalledWith(
      "/path/to/temp_processed.jpg",
      "/path/to/final_output.jpg",
    );
  });

  it("should handle custom provider and model options", async () => {
    await processImage("/path/to/input.dng", {
      provider: "anthropic",
      model: "claude-3-opus",
      preset: "creative",
      maxRetries: 5,
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "anthropic",
        visionModel: "claude-3-opus",
        preset: "creative",
        maxRetries: 5,
      }),
    );
  });

  it("should handle bit depth conversion", async () => {
    await processImage("/path/to/input.dng", {
      bitDepth: 8,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        bitDepth: 8,
      }),
    );
  });
});
