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
        console.warn("Failed to calculate histogram, proceeding without histogram data:", histogramError);
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
export async function processAIGeneration(
  previewPath: string,
  basePP3Path: string,
  sections: string[],
  providerName: string,
  visionModel: string | string[],
  prompt: string | undefined,
  preset: string,
  maxRetries: number,
  verbose: boolean,
): Promise<string> {
  const imageData = await readImageData(previewPath, verbose);
  const basePP3Content = await readBasePP3Content(basePP3Path, verbose);

  const { includedSections, excludedSections, sectionOrders } =
    splitPP3ContentBySections(basePP3Content ?? "", sections);

  const aiProvider = handleProviderSetup(providerName, visionModel);
  const toBeEdited = includedSections.join("\n");
  const promptText = prompt ?? getPromptByPreset(preset);
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
 * Prepares image contents for evaluation
 */
export async function prepareImageContents(
  generationResults: GenerationResult[],
  verbose: boolean,
): Promise<
  ({ type: "text"; text: string } | { type: "image"; image: Buffer })[]
> {
  const imageContents: (
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer }
  )[] = [{ type: "text", text: EVALUATION_PROMPT }];

  // Filter out failed generations
  const successfulResults = generationResults.filter(
    (result) => result.success,
  );

  if (verbose && successfulResults.length < generationResults.length) {
    console.log(
      `Skipping ${String(generationResults.length - successfulResults.length)} failed generations in evaluation`,
    );
  }

  // Create a mapping for display indices (1-based) that skips failed generations
  let displayIndex = 1;

  for (const result of successfulResults) {
    try {
      const imageData = await fs.promises.readFile(result.evaluationImagePath);
      
      // Calculate histogram for evaluation image
      let histogramText = "";
      try {
        const histogram = await calculateHistogramFromBuffer(imageData);
        const analysis = analyzeHistogram(histogram);
        histogramText = formatHistogramForLLM(histogram, analysis);
        
        if (verbose) {
          console.log(`Histogram analysis completed for generation ${displayIndex}`);
        }
      } catch (histogramError) {
        if (verbose) {
          console.warn(`Failed to calculate histogram for generation ${displayIndex}:`, histogramError);
        }
        // Continue without histogram data if calculation fails
      }

      // Add generation with histogram analysis
      const generationText = histogramText 
        ? `\n\nGeneration ${String(displayIndex)}:\n${histogramText}`
        : `\n\nGeneration ${String(displayIndex)}:`;
        
      imageContents.push(
        { type: "text", text: generationText },
        { type: "image", image: imageData },
      );
      displayIndex++;
    } catch (error) {
      // Safe error handling
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
      // Mark this generation as failed since we couldn't read its image
      result.success = false;
    }
  }

  return imageContents;
}

/**
 * Parses the best generation index from AI response
 */
export function parseBestGenerationIndex(
  responseText: string,
  generationResults: GenerationResult[],
): number {
  const bestGenerationMatch = /BEST_GENERATION:\s*(\d+)/i.exec(responseText);

  if (!bestGenerationMatch) {
    // Default to the first successful generation if no match
    const firstSuccessfulIndex = generationResults.findIndex(
      (result) => result.success,
    );
    return Math.max(firstSuccessfulIndex, 0);
  }

  // Get the display index (1-based) from the AI response
  const displayIndex = Number.parseInt(bestGenerationMatch[1], 10);

  // Create a mapping from display indices to actual indices
  const successfulResults = generationResults.filter(
    (result) => result.success,
  );
  const displayToActualMap = new Map<number, number>();

  let currentDisplayIndex = 1;
  for (const result of successfulResults) {
    displayToActualMap.set(currentDisplayIndex, result.generationIndex);
    currentDisplayIndex++;
  }

  // Get the actual index from the map, or default to the first successful one
  const actualIndex = displayToActualMap.get(displayIndex);
  if (actualIndex !== undefined) {
    return actualIndex;
  }

  // Fallback to the first successful generation
  const firstSuccessfulIndex = generationResults.findIndex(
    (result) => result.success,
  );
  return Math.max(firstSuccessfulIndex, 0);
}

/**
 * Handles the case when there's only one successful generation
 */
function handleSingleGeneration(
  successfulResults: GenerationResult[],
  generationResults: GenerationResult[],
): { bestIndex: number; evaluationReason: string } {
  const originalIndex = generationResults.indexOf(successfulResults[0]);
  return {
    bestIndex: originalIndex,
    evaluationReason: "Only one successful generation available",
  };
}

/**
 * Attempts to evaluate generations with a specific model
 */
async function attemptEvaluationWithModel(
  model: string,
  modelIndex: number,
  models: string[],
  providerName: string,
  imageContents: (
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer }
  )[],
  maxRetries: number,
  successfulResults: GenerationResult[],
  generationResults: GenerationResult[],
  verbose: boolean,
): Promise<{ bestIndex: number; evaluationReason: string } | null> {
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
    const bestIndex = parseBestGenerationIndex(responseText, successfulResults);

    // Map the best index from the successful results array back to the original array
    const originalIndex = generationResults.findIndex(
      (result) =>
        result.generationIndex === successfulResults[bestIndex].generationIndex,
    );

    const finalIndex = originalIndex === -1 ? bestIndex : originalIndex;

    if (verbose) {
      console.log(
        `AI selected generation ${String(successfulResults[bestIndex].generationIndex + 1)} as the best`,
      );
      console.log("\n=== COMPLETE AI EVALUATION RESPONSE ===");
      console.log(responseText);
      console.log("=== END OF AI EVALUATION RESPONSE ===\n");
    }

    return {
      bestIndex: finalIndex,
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
  generationResults: GenerationResult[],
  lastError: unknown,
  verbose: boolean,
): { bestIndex: number; evaluationReason: string } {
  if (verbose) {
    console.warn(
      "All AI evaluation models failed, using first generation as fallback:",
      lastError,
    );
  }

  // Find the index of the first successful generation in the original array
  const firstSuccessfulIndex = generationResults.findIndex(
    (result) => result.success,
  );

  return {
    bestIndex: Math.max(firstSuccessfulIndex, 0),
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
): Promise<{ bestIndex: number; evaluationReason: string }> {
  // Filter out failed generations
  const successfulResults = generationResults.filter(
    (result) => result.success,
  );

  if (successfulResults.length === 0) {
    throw new Error("No successful generations to evaluate");
  }

  if (successfulResults.length === 1) {
    return handleSingleGeneration(successfulResults, generationResults);
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

    const result = await attemptEvaluationWithModel(
      currentModel,
      modelIndex,
      models,
      providerName,
      imageContents,
      maxRetries,
      successfulResults,
      generationResults,
      verbose,
    );

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
