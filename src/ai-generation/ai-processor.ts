// AI processing functionality extracted from agent.ts
import { generateText, LanguageModelV1 } from "ai";
import fs from "node:fs";
import { handleProviderSetup } from "../utils/ai-provider.js";
import {
  readImageData,
  readBasePP3Content,
} from "../file-operations/file-handlers.js";
import {
  splitPP3ContentBySections,
  splitContentIntoSections,
} from "../pp3-sections/section-parser.js";
import { getPromptByPreset, EVALUATION_PROMPT } from "../prompts.js";
import {
  parseSearchReplaceBlocks,
  parseDirectSectionChanges,
} from "../pp3-parser.js";
import {
  applyDirectSectionChanges,
  reconstructPP3Content,
} from "../pp3-sections/section-manipulation.js";
import { applySearchReplaceBlocks } from "../pp3-processing/search-replace.js";
import { GenerationResult } from "../types.js";
import {
  calculateHistogramFromBuffer,
  analyzeHistogram,
  formatHistogramForLLM,
} from "../utils/image-processing.js";

/**
 * Generates AI response based on image and text
 */
export async function generateAIResponse(
  aiProvider: LanguageModelV1,
  extractedText: string,
  imageData: Buffer,
  maxRetries: number,
  providerName: string,
  verbose?: boolean,
): Promise<string> {
  try {
    if (verbose) {
      console.log(`Sending request to AI provider (${providerName})...`);
      console.log("Calculating image histogram for enhanced analysis...");
    }

    // Calculate histogram and analysis
    let histogramText = "";
    try {
      const histogram = await calculateHistogramFromBuffer(imageData);
      const analysis = analyzeHistogram(histogram);
      histogramText = formatHistogramForLLM(histogram, analysis);

      if (verbose) {
        console.log("Histogram analysis completed successfully");
      }
    } catch (histogramError) {
      if (verbose) {
        console.warn(
          "Failed to calculate histogram, proceeding without histogram data:",
          histogramError,
        );
      }
      // Continue without histogram data if calculation fails
    }

    // Combine original text with histogram analysis
    const enhancedText = histogramText
      ? `${extractedText}\n\n${histogramText}`
      : extractedText;

    const response = await generateText({
      model: aiProvider,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: enhancedText,
            },
            {
              type: "image",
              image: imageData,
            },
          ],
        },
      ],
      maxRetries,
    });

    const responseText =
      typeof response === "string" ? response : response.text;
    if (!responseText) {
      throw new Error("AI response was empty or in an unexpected format");
    }

    if (verbose) {
      console.log("\n=== COMPLETE AI RESPONSE ===");
      console.log(responseText);
      console.log("=== END OF AI RESPONSE ===\n");
    }

    return responseText;
  } catch (error: unknown) {
    if (verbose) {
      console.error(`AI provider error (${providerName}):`, error);
    }
    throw new Error(
      `AI provider error (${providerName}): ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Processes AI generation for PP3 content
 */
export async function processAIGeneration({
  previewPath,
  basePP3Path,
  sections,
  providerName,
  visionModel,
  prompt,
  preset,
  maxRetries,
  verbose,
}: {
  previewPath: string;
  basePP3Path: string;
  sections: string[];
  providerName: string;
  visionModel: string | string[];
  prompt: string | undefined;
  preset: string;
  maxRetries: number;
  verbose: boolean;
}): Promise<string> {
  const imageData = await readImageData(previewPath, verbose);
  const basePP3Content = await readBasePP3Content(basePP3Path, verbose);

  const { includedSections, excludedSections, sectionOrders } =
    splitPP3ContentBySections(basePP3Content ?? "", sections);

  const aiProvider = handleProviderSetup(providerName, visionModel);
  const toBeEdited = includedSections.join("\n");

  const promptText = prompt ?? getPromptByPreset(preset, sections);
  const extractedText = `${promptText}\n\n${toBeEdited}`;

  // Detailed logging is now handled inside generateAIResponse
  const responseText = await generateAIResponse(
    aiProvider,
    extractedText,
    imageData,
    maxRetries,
    providerName,
    verbose,
  );

  if (verbose) console.log("AI response received and processed");

  // Try to parse direct section changes first
  const sectionChanges = parseDirectSectionChanges(responseText);

  if (sectionChanges.length > 0) {
    if (verbose) {
      console.log(
        `Found ${String(sectionChanges.length)} direct section changes`,
      );
    }

    // Apply direct section changes
    return applyDirectSectionChanges(
      basePP3Content ?? "",
      sectionChanges,
      verbose,
    );
  } else {
    // Fall back to search/replace blocks for backward compatibility
    if (verbose)
      console.log(
        "No direct section changes found, trying search/replace blocks",
      );

    const searchReplaceBlocks = parseSearchReplaceBlocks(
      responseText.replaceAll("```", ""),
    );

    if (searchReplaceBlocks.length === 0) {
      if (verbose) console.log("No valid search/replace blocks found");
      throw new Error("No valid changes found in AI response");
    }

    const pp3Content = applySearchReplaceBlocks(
      toBeEdited,
      searchReplaceBlocks,
      verbose,
    );
    const { sections: editedSections } = splitContentIntoSections(pp3Content);

    return reconstructPP3Content(
      sectionOrders,
      editedSections,
      includedSections,
      excludedSections,
    );
  }
}

/**
 * Calculate histogram text for an image buffer
 */
async function calculateHistogramText(
  imageData: Buffer,
  displayIndex: number,
  verbose: boolean,
): Promise<string> {
  try {
    const histogram = await calculateHistogramFromBuffer(imageData);
    const analysis = analyzeHistogram(histogram);
    const histogramText = formatHistogramForLLM(histogram, analysis);

    if (verbose) {
      console.log(
        `Histogram analysis completed for generation ${String(displayIndex)}`,
      );
    }
    return histogramText;
  } catch (histogramError) {
    if (verbose) {
      console.warn(
        `Failed to calculate histogram for generation ${String(displayIndex)}:`,
        histogramError,
      );
    }
    return "";
  }
}

/**
 * Process a single generation result
 */
async function processGenerationResult(
  result: GenerationResult,
  displayIndex: number,
  verbose: boolean,
): Promise<{ text: string; image: Buffer } | null> {
  try {
    const imageData = await fs.promises.readFile(result.evaluationImagePath);
    const histogramText = await calculateHistogramText(
      imageData,
      displayIndex,
      verbose,
    );

    const generationText = histogramText
      ? `\n\nGeneration ${String(displayIndex)}:\n${histogramText}`
      : `\n\nGeneration ${String(displayIndex)}:`;

    return { text: generationText, image: imageData };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error reading evaluation image";

    if (verbose) {
      console.warn(
        `Failed to read evaluation image ${result.evaluationImagePath}:`,
        errorMessage,
      );
    }
    result.success = false;
    return null;
  }
}

/**
 * Prepares image contents for evaluation
 */
export async function prepareImageContents(
  successfulGenerationResults: GenerationResult[],
  verbose: boolean,
): Promise<
  ({ type: "text"; text: string } | { type: "image"; image: Buffer })[]
> {
  const imageContents: (
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer }
  )[] = [{ type: "text", text: EVALUATION_PROMPT }];

  // Process each successful result
  let displayIndex = 1;
  for (const result of successfulGenerationResults) {
    const processed = await processGenerationResult(
      result,
      displayIndex,
      verbose,
    );

    if (processed) {
      imageContents.push(
        { type: "text", text: processed.text },
        { type: "image", image: processed.image },
      );
      displayIndex++;
    }
  }

  return imageContents;
}

/**
 * Parses the best generation from AI response
 */
export function parseBestGenerationIndexAmongSuccessfuls(
  responseText: string,
): number {
  const bestGenerationMatch = /BEST_GENERATION:\s*(\d+)/i.exec(responseText);

  // Get the display index (1-based) from the AI response
  return Math.max(0, Number.parseInt(bestGenerationMatch?.[1] ?? "1", 10) - 1);
}

/**
 * Attempts to evaluate generations with a specific model
 */
async function attemptEvaluationWithModel({
  model,
  modelIndex,
  models,
  providerName,
  imageContents,
  maxRetries,
  successfulResults,
  verbose,
}: {
  model: string;
  modelIndex: number;
  models: string[];
  providerName: string;
  imageContents: (
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer }
  )[];
  maxRetries: number;
  successfulResults: GenerationResult[];
  verbose: boolean;
}): Promise<{
  winningGeneration: GenerationResult;
  evaluationReason: string;
} | null> {
  if (verbose && models.length > 1) {
    console.log(
      `Attempting evaluation with model ${model} (${String(modelIndex + 1)}/${String(models.length)})...`,
    );
  }

  try {
    const aiProvider = handleProviderSetup(providerName, model);
    const response = await generateText({
      model: aiProvider,
      messages: [
        {
          role: "user",
          content: imageContents,
        },
      ],
      maxRetries,
    });

    const responseText =
      typeof response === "string" ? response : response.text;
    const bestIndex = parseBestGenerationIndexAmongSuccessfuls(responseText);

    if (verbose) {
      console.log("\n=== COMPLETE AI EVALUATION RESPONSE ===");
      console.log(responseText);
      console.log("=== END OF AI EVALUATION RESPONSE ===\n");

      console.log(
        `AI selected generation ${String(successfulResults[bestIndex].generationIndex + 1)} as the best`,
      );
    }

    return {
      winningGeneration: successfulResults[bestIndex],
      evaluationReason: responseText,
    };
  } catch {
    // Handle error in the calling function
    return null;
  }
}

/**
 * Handles the fallback case when all models fail
 */
function handleAllModelsFailed(
  successfulGenerationResults: GenerationResult[],
  lastError: unknown,
  verbose: boolean,
): { winningGeneration: GenerationResult; evaluationReason: string } {
  if (verbose) {
    console.warn(
      "All AI evaluation models failed, using first generation as fallback:",
      lastError,
    );
  }

  return {
    winningGeneration: successfulGenerationResults[0],
    evaluationReason: `AI evaluation failed: ${lastError instanceof Error ? lastError.message : "Unknown error"}. Using first successful generation as fallback.`,
  };
}

/**
 * Evaluates multiple generations and selects the best one
 * If multiple models are specified, it will try each one sequentially until successful
 */
export async function evaluateGenerations(
  generationResults: GenerationResult[],
  providerName: string,
  visionModel: string | string[],
  maxRetries: number,
  verbose: boolean,
): Promise<{ winningGeneration: GenerationResult; evaluationReason: string }> {
  // Filter out failed generations
  const successfulResults = generationResults.filter(
    (result) => result.success,
  );

  if (successfulResults.length === 0) {
    throw new Error("No successful generations to evaluate");
  }

  if (successfulResults.length === 1) {
    return {
      winningGeneration: successfulResults[0],
      evaluationReason: "Only one successful generation available",
    };
  }

  // Only pass successful generations to prepareImageContents
  const imageContents = await prepareImageContents(successfulResults, verbose);

  if (verbose) {
    console.log(
      `Evaluating ${String(successfulResults.length)} successful generations with AI...`,
    );
  }

  // Convert visionModel to array for sequential attempts
  const models = Array.isArray(visionModel) ? visionModel : [visionModel];
  let lastError: unknown = null;

  // Try each model sequentially until one succeeds
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const currentModel = models[modelIndex];

    const result = await attemptEvaluationWithModel({
      model: currentModel,
      modelIndex,
      models,
      providerName,
      imageContents,
      maxRetries,
      successfulResults,
      verbose,
    });

    if (result) {
      return result;
    } else {
      // Handle error and try next model if available
      const error = new Error(`Evaluation with model ${currentModel} failed`);
      lastError = error;

      if (verbose) {
        console.warn(
          `AI evaluation with model ${currentModel} failed: ${error.message}`,
        );
      }

      if (modelIndex < models.length - 1 && verbose) {
        console.log(`Trying next model: ${models[modelIndex + 1]}...`);
      }
    }
  }

  // If we get here, all models failed
  return handleAllModelsFailed(generationResults, lastError, verbose);
}
