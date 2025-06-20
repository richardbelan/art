import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  splitContentBySections,
  splitPP3ContentBySections,
  splitContentIntoSections,
} from "../pp3-sections/section-parser.js";
import { generateMultiPP3FromRawImage } from "../agent.js";
import {
  convertDngToImage,
  convertDngToImageWithPP3,
} from "../raw-therapee-wrap.js";
import { generateText } from "ai";
import fs from "node:fs";
import { validateFileAccess } from "../utils/validation.js";

vi.mock("../raw-therapee-wrap.js");
vi.mock("ai");
vi.mock("../utils/validation.js", () => ({
  validateFileAccess: vi.fn(),
  handleFileError: vi.fn(),
}));
vi.mock("node:fs", () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      mkdir: vi.fn(),
    },
  },
}));

describe("Agent Section Parsing", () => {
  describe("splitContentBySections", () => {
    it("should split content into sections correctly", () => {
      const content = `[Section1]
param1=value1
param2=value2

[Section2]
param3=value3
param4=value4`;

      const result = splitContentBySections(content);

      expect(result.sections).toHaveLength(2);
      expect(result.sectionOrders).toEqual(["Section1", "Section2"]);
      expect(result.sections[0]).toBe(
        "[Section1]\nparam1=value1\nparam2=value2",
      );
      expect(result.sections[1]).toBe(
        "[Section2]\nparam3=value3\nparam4=value4",
      );
    });

    it("should handle empty content", () => {
      const result = splitContentBySections("");

      expect(result.sections).toHaveLength(0);
      expect(result.sectionOrders).toHaveLength(0);
    });

    it("should handle content with no sections", () => {
      const content = "param1=value1\nparam2=value2";

      const result = splitContentBySections(content);

      expect(result.sections).toHaveLength(0);
      expect(result.sectionOrders).toHaveLength(0);
    });

    it("should call processSection callback for each section", () => {
      const content = `[Section1]
param1=value1

[Section2]
param2=value2`;

      const processSectionMock = vi.fn();

      splitContentBySections(content, processSectionMock);

      expect(processSectionMock).toHaveBeenCalledTimes(2);
      expect(processSectionMock).toHaveBeenCalledWith(
        "[Section1]\nparam1=value1",
        "Section1",
        0,
      );
      expect(processSectionMock).toHaveBeenCalledWith(
        "[Section2]\nparam2=value2",
        "Section2",
        1,
      );
    });
  });

  describe("splitPP3ContentBySections", () => {
    it("should categorize sections based on provided section names", () => {
      const content = `[Section1]
param1=value1

[Section2]
param2=value2

[Section3]
param3=value3`;

      const sectionNames = ["Section1", "Section3"];

      const result = splitPP3ContentBySections(content, sectionNames);

      expect(result.includedSections).toHaveLength(2);
      expect(result.excludedSections).toHaveLength(1);

      expect(result.includedSections[0]).toBe("[Section1]\nparam1=value1");
      expect(result.includedSections[1]).toBe("[Section3]\nparam3=value3");
      expect(result.excludedSections[0]).toBe("[Section2]\nparam2=value2");

      expect(result.sectionOrders).toEqual([
        "Section1",
        "Section2",
        "Section3",
      ]);
    });

    it("should handle empty content", () => {
      const result = splitPP3ContentBySections("", ["Section1"]);

      expect(result.includedSections).toHaveLength(0);
      expect(result.excludedSections).toHaveLength(0);
      expect(result.sectionOrders).toHaveLength(0);
    });

    it("should handle content with no matching sections", () => {
      const content = `[Section1]
param1=value1

[Section2]
param2=value2`;

      const sectionNames = ["Section3", "Section4"];

      const result = splitPP3ContentBySections(content, sectionNames);

      expect(result.includedSections).toHaveLength(0);
      expect(result.excludedSections).toHaveLength(2);
      expect(result.sectionOrders).toEqual(["Section1", "Section2"]);
    });
  });

  describe("splitContentIntoSections", () => {
    it("should split content into sections", () => {
      const content = `[Section1]
param1=value1

[Section2]
param2=value2`;

      const result = splitContentIntoSections(content);

      expect(result.sections).toHaveLength(2);
      expect(result.sectionOrders).toEqual(["Section1", "Section2"]);
    });

    it("should handle empty content", () => {
      const result = splitContentIntoSections("");

      expect(result.sections).toHaveLength(0);
      expect(result.sectionOrders).toHaveLength(0);
    });

    it("should handle content with no sections", () => {
      const content = "param1=value1\nparam2=value2";

      const result = splitContentIntoSections(content);

      expect(result.sections).toHaveLength(0);
      expect(result.sectionOrders).toHaveLength(0);
    });
  });

  describe("splitContentIntoSections additional tests", () => {
    it("should handle single section", () => {
      const content = `[Section1]
param1=value1
param2=value2`;

      const result = splitContentIntoSections(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sectionOrders).toEqual(["Section1"]);
      expect(result.sections[0]).toBe(
        "[Section1]\nparam1=value1\nparam2=value2",
      );
    });

    it("should handle whitespace-only content", () => {
      const content = "   \n  \t  \n  ";

      const result = splitContentIntoSections(content);

      expect(result.sections).toHaveLength(0);
      expect(result.sectionOrders).toHaveLength(0);
    });

    it("should handle sections with empty lines", () => {
      const content = `[Section1]
param1=value1

param2=value2

[Section2]

param3=value3`;

      const result = splitContentIntoSections(content);

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0]).toContain("param1=value1");
      expect(result.sections[0]).toContain("param2=value2");
      expect(result.sections[1]).toContain("param3=value3");
    });
  });
});

describe("Multi-generation PP3 Processing", () => {
  const TEST_INPUT_FILE = "/path/to/test.dng";

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful file operations
    vi.mocked(fs.promises.readFile).mockImplementation((path, encoding) => {
      return encoding === "utf8"
        ? Promise.resolve(
            "[Exposure]\nExposure=0.5\n[ColorToning]\nEnabled=true",
          )
        : Promise.resolve(Buffer.from("mock image data"));
    });
    vi.mocked(fs.promises.writeFile).mockResolvedValue();
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.unlink).mockResolvedValue();
    vi.mocked(fs.promises.access).mockResolvedValue();

    // Mock successful validation
    vi.mocked(validateFileAccess).mockResolvedValue();

    // Mock successful RawTherapee operations
    vi.mocked(convertDngToImage).mockResolvedValue();
    vi.mocked(convertDngToImageWithPP3).mockResolvedValue();

    // Mock AI responses
    vi.mocked(generateText).mockResolvedValue({
      text: "<<<<<<< SEARCH\n[Exposure]\nExposure=0.5\n=======\n[Exposure]\nExposure=1.0\n>>>>>>> REPLACE",
      reasoning: undefined,
      files: [],
      reasoningDetails: [],
      sources: [],
      experimental_output: undefined,
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      warnings: undefined,
      steps: [],
      request: {},
      response: {
        id: "mock-id",
        timestamp: new Date(),
        modelId: "mock-model",
        messages: [],
      },
      logprobs: undefined,
      providerMetadata: undefined,
      experimental_providerMetadata: undefined,
    });
  });

  it("should make exactly 5 RawTherapee CLI calls for 3 generations (1 preview + 3 eval + 1 final)", async () => {
    // Mock evaluation response
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: "<<<<<<< SEARCH\n[Exposure]\nExposure=0.5\n=======\n[Exposure]\nExposure=1.0\n>>>>>>> REPLACE",
        reasoning: undefined,
        files: [],
        reasoningDetails: [],
        sources: [],
        experimental_output: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: undefined,
        steps: [],
        request: {},
        response: {
          id: "mock-id-1",
          timestamp: new Date(),
          modelId: "mock-model",
          messages: [],
        },
        logprobs: undefined,
        providerMetadata: undefined,
        experimental_providerMetadata: undefined,
      })
      .mockResolvedValueOnce({
        text: "<<<<<<< SEARCH\n[Exposure]\nExposure=0.5\n=======\n[Exposure]\nExposure=1.2\n>>>>>>> REPLACE",
        reasoning: undefined,
        files: [],
        reasoningDetails: [],
        sources: [],
        experimental_output: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: undefined,
        steps: [],
        request: {},
        response: {
          id: "mock-id-2",
          timestamp: new Date(),
          modelId: "mock-model",
          messages: [],
        },
        logprobs: undefined,
        providerMetadata: undefined,
        experimental_providerMetadata: undefined,
      })
      .mockResolvedValueOnce({
        text: "<<<<<<< SEARCH\n[Exposure]\nExposure=0.5\n=======\n[Exposure]\nExposure=0.8\n>>>>>>> REPLACE",
        reasoning: undefined,
        files: [],
        reasoningDetails: [],
        sources: [],
        experimental_output: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: undefined,
        steps: [],
        request: {},
        response: {
          id: "mock-id-3",
          timestamp: new Date(),
          modelId: "mock-model",
          messages: [],
        },
        logprobs: undefined,
        providerMetadata: undefined,
        experimental_providerMetadata: undefined,
      })
      .mockResolvedValueOnce({
        text: "BEST_GENERATION: 2",
        reasoning: undefined,
        files: [],
        reasoningDetails: [],
        sources: [],
        experimental_output: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: undefined,
        steps: [],
        request: {},
        response: {
          id: "mock-id-4",
          timestamp: new Date(),
          modelId: "mock-model",
          messages: [],
        },
        logprobs: undefined,
        providerMetadata: undefined,
        experimental_providerMetadata: undefined,
      });

    const result = await generateMultiPP3FromRawImage({
      inputPath: TEST_INPUT_FILE,
      generations: 3,
      verbose: true,
    });

    // Verify the correct number of RawTherapee CLI calls
    expect(convertDngToImage).toHaveBeenCalledTimes(1); // 1 preview
    expect(convertDngToImageWithPP3).toHaveBeenCalledTimes(4); // 3 eval + 1 final

    // Verify AI calls: 3 generations + 1 evaluation
    expect(generateText).toHaveBeenCalledTimes(4);

    // Verify result structure
    expect(result.bestResult).toBeDefined();
    expect(result.allResults).toHaveLength(3);
    expect(result.finalOutputPath).toBeDefined();
    expect(result.finalOutputPath).toContain("_final.");
  });

  it("should use same format/quality for preview and evaluation images", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: "<<<<<<< SEARCH\n[Exposure]\nExposure=0.5\n=======\n[Exposure]\nExposure=1.0\n>>>>>>> REPLACE",
        reasoning: undefined,
        files: [],
        reasoningDetails: [],
        sources: [],
        experimental_output: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: undefined,
        steps: [],
        request: {},
        response: {
          id: "mock-id-5",
          timestamp: new Date(),
          modelId: "mock-model",
          messages: [],
        },
        logprobs: undefined,
        providerMetadata: undefined,
        experimental_providerMetadata: undefined,
      })
      .mockResolvedValueOnce({
        text: "BEST_GENERATION: 1",
        reasoning: undefined,
        files: [],
        reasoningDetails: [],
        sources: [],
        experimental_output: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: undefined,
        steps: [],
        request: {},
        response: {
          id: "mock-id-6",
          timestamp: new Date(),
          modelId: "mock-model",
          messages: [],
        },
        logprobs: undefined,
        providerMetadata: undefined,
        experimental_providerMetadata: undefined,
      });

    await generateMultiPP3FromRawImage({
      inputPath: TEST_INPUT_FILE,
      generations: 1,
      previewFormat: "png",
      previewQuality: 85,
      outputFormat: "tiff",
      outputQuality: 100,
    });

    // Verify total calls: 1 eval + 1 final = 2 calls
    expect(vi.mocked(convertDngToImageWithPP3)).toHaveBeenCalledTimes(2);

    // Check that evaluation images use preview format/quality
    const evaluationCalls = vi
      .mocked(convertDngToImageWithPP3)
      .mock.calls.filter((call) => call[0].output.includes("_eval."));

    expect(evaluationCalls).toHaveLength(1);
    expect(evaluationCalls[0][0].format).toBe("png");
    expect(evaluationCalls[0][0].quality).toBe(85);

    // Check that final output uses desired format/quality
    const finalCalls = vi
      .mocked(convertDngToImageWithPP3)
      .mock.calls.filter((call) => call[0].output.includes("_final."));

    expect(finalCalls).toHaveLength(1);
    expect(finalCalls[0][0].format).toBe("tiff");
    expect(finalCalls[0][0].quality).toBe(100);
  });
});
