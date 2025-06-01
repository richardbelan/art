import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";

// Mock only external dependencies
vi.mock("../raw-therapee-wrap.js", () => ({
  convertDngToImageWithPP3: vi.fn(),
}));

vi.mock("../agent.js", () => ({
  generatePP3FromRawImage: vi.fn(),
  generateMultiPP3FromRawImage: vi.fn(),
}));

// Mock fs.promises.writeFile and copyFile to prevent actual file operations
vi.spyOn(fs.promises, "writeFile").mockImplementation(() => {
  return Promise.resolve(undefined);
});
vi.spyOn(fs.promises, "copyFile").mockImplementation(() => {
  return Promise.resolve(undefined);
});

// Mock process.exit to prevent it from actually exiting during tests
vi.stubGlobal("process", {
  ...process,
  exit: vi.fn(),
});

// Import after mocking
const { processImage } = await import("../bin.js");

const { convertDngToImageWithPP3 } = await import("../raw-therapee-wrap.js");
const { generatePP3FromRawImage, generateMultiPP3FromRawImage } = await import(
  "../agent.js"
);

// Use real test files
const TEST_INPUT_FILE = path.resolve("examples/1/IMG_0080.CR2");
const TEST_OUTPUT_DIR = path.resolve("test-temp");

beforeEach(() => {
  vi.resetAllMocks();

  // Mock generatePP3FromRawImage to return sample PP3 content
  vi.mocked(generatePP3FromRawImage).mockResolvedValue("sample pp3 content");

  // Mock convertDngToImageWithPP3 to succeed
  vi.mocked(convertDngToImageWithPP3).mockResolvedValue();

  // Reset the file operation mocks
  vi.mocked(fs.promises.writeFile).mockImplementation(() => {
    return Promise.resolve(undefined);
  });
  vi.mocked(fs.promises.copyFile).mockImplementation(() => {
    return Promise.resolve(undefined);
  });
});

afterEach(() => {
  // Clean up any files that might have been created in the examples folder
  const potentialFile = path.resolve("examples/1/IMG_0080.pp3");
  try {
    if (fs.existsSync(potentialFile)) {
      fs.unlinkSync(potentialFile);
    }
  } catch {
    // Ignore cleanup errors
  }
});

describe("processImage", () => {
  it("should throw error for empty input path", async () => {
    await expect(processImage("")).rejects.toThrow(
      "Input path cannot be empty",
    );
  });

  it("should throw error when input file not found", async () => {
    await expect(processImage("/nonexistent/file.dng")).rejects.toThrow(
      "Input file not found: /nonexistent/file.dng",
    );
  });

  it("should process image in single generation mode", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "output.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith({
      inputPath: TEST_INPUT_FILE,
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

    expect(convertDngToImageWithPP3).toHaveBeenCalled();

    // Check that the PP3 file write was attempted
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      outputPath,
      "sample pp3 content",
    );
  });

  it("should handle PP3-only mode", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "pp3-only.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      pp3Only: true,
    });

    expect(generatePP3FromRawImage).toHaveBeenCalled();
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

    const outputPath = path.join(TEST_OUTPUT_DIR, "multi-gen.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      generations: 2,
      verbose: true,
    });

    expect(generateMultiPP3FromRawImage).toHaveBeenCalledWith({
      inputPath: TEST_INPUT_FILE,
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
      bitDepth: Number.NaN,
    });
  });

  it("should handle multi-generation PP3-only mode", async () => {
    const mockMultiResult = {
      bestResult: {
        generationIndex: 0,
        pp3Content: "best pp3 content",
        pp3Path: path.join(TEST_OUTPUT_DIR, "best.pp3"),
        processedImagePath: path.join(TEST_OUTPUT_DIR, "best_processed.jpg"),
      },
      allResults: [],
      evaluationReason: "Only one generation",
    };

    vi.mocked(generateMultiPP3FromRawImage).mockResolvedValue(mockMultiResult);

    const outputPath = path.join(TEST_OUTPUT_DIR, "multi-gen-pp3-only.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      generations: 2,
      pp3Only: true,
    });

    expect(generateMultiPP3FromRawImage).toHaveBeenCalled();
  });

  it("should handle different output formats", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "tiff-format.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      tiff: true,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "tiff",
      }),
    );
  });

  it("should handle PNG format", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "png-format.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      png: true,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "png",
      }),
    );
  });

  it("should default to JPEG format", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "jpeg-format.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "jpeg",
      }),
    );
  });

  it("should handle sections parameter", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "sections.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      sections: "Exposure,ColorToning,Detail",
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: ["Exposure", "ColorToning", "Detail"],
      }),
    );
  });

  it("should filter empty sections", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "filtered-sections.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      sections: "Exposure, ,ColorToning, ",
    });

    expect(generatePP3FromRawImage).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: ["Exposure", "ColorToning"],
      }),
    );
  });

  it("should throw error when PP3 generation fails", async () => {
    vi.mocked(generatePP3FromRawImage).mockRejectedValue(
      new Error("PP3 generation failed"),
    );

    const outputPath = path.join(TEST_OUTPUT_DIR, "error-test.pp3");

    await expect(
      processImage(TEST_INPUT_FILE, { output: outputPath }),
    ).rejects.toThrow("PP3 generation failed");
  });

  it("should handle custom provider and model options", async () => {
    const outputPath = path.join(TEST_OUTPUT_DIR, "custom-provider.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
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
    const outputPath = path.join(TEST_OUTPUT_DIR, "bit-depth.pp3");

    await processImage(TEST_INPUT_FILE, {
      output: outputPath,
      bitDepth: 8,
    });

    expect(convertDngToImageWithPP3).toHaveBeenCalledWith(
      expect.objectContaining({
        bitDepth: 8,
      }),
    );
  });
});
