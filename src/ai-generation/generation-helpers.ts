// Generation helper functions extracted from agent.ts
import path from "node:path";
import fs from "node:fs";
import { convertDngToImageWithPP3 } from "../raw-therapee-wrap.js";
import { processAIGeneration, evaluateGenerations } from "./ai-processor.js";
import {
  GenerationResult,
  MultiGenerationResult,
  ImageFormat,
  TiffCompression,
  BitDepth,
} from "../types.js";

/**
 * Helper function to log generation progress
 */
export function logGenerationProgress(
  verbose: boolean,
  visionModel: string | string[],
  models: string[],
  generations: number,
  index?: number,
  currentModel?: string,
): void {
  if (!verbose) return;

  if (index === undefined) {
    // Initial log
    if (Array.isArray(visionModel)) {
      console.log(
        `Generating ${String(models.length)} PP3 profiles using different models...`,
      );
    } else {
      console.log(
        `Generating ${String(generations)} different PP3 profiles...`,
      );
    }
    return;
  }

  // Per-generation log
  if (Array.isArray(visionModel) && currentModel) {
    console.log(
      `Generating PP3 profile ${String(index + 1)}/${String(models.length)} using model: ${currentModel}...`,
    );
  } else {
    console.log(
      `Generating PP3 profile ${String(index + 1)}/${String(generations)}...`,
    );
  }
}

/**
 * Helper function to generate a single PP3 profile
 */
export async function generateSinglePP3Profile(
  inputPath: string,
  basePP3Path: string,
  sections: string[],
  providerName: string,
  currentModel: string,
  prompt: string | undefined,
  preset: string,
  maxRetries: number,
  verbose: boolean,
  index: number,
  baseName: string,
  directoryName: string,
  previewPath: string,
  previewFormat: "jpeg" | "png",
  previewQuality: number,
  previewExtension: string,
  isMultiModel: boolean,
): Promise<GenerationResult | null> {
  try {
    const pp3Content = await processAIGeneration(
      previewPath,
      basePP3Path,
      sections,
      providerName,
      currentModel,
      prompt,
      preset,
      maxRetries,
      verbose,
    );

    // Create file names with model info if using multiple models
    const modelSuffix = isMultiModel
      ? `_${currentModel.replaceAll(/[^a-zA-Z0-9-]/g, "_")}`
      : "";

    const pp3Path = path.join(
      directoryName,
      `${baseName}_gen${String(index + 1)}${modelSuffix}.pp3`,
    );

    // Ensure the directory exists before writing files
    await fs.promises.mkdir(path.dirname(pp3Path), { recursive: true });

    await fs.promises.writeFile(pp3Path, pp3Content);

    // Create evaluation image with same format/quality as preview for consistency
    const evaluationImagePath = path.join(
      directoryName,
      `${baseName}_gen${String(index + 1)}${modelSuffix}_eval.${previewExtension}`,
    );

    // Ensure the directory exists before creating the evaluation image
    await fs.promises.mkdir(path.dirname(evaluationImagePath), {
      recursive: true,
    });

    await convertDngToImageWithPP3({
      input: inputPath,
      output: evaluationImagePath,
      pp3Path,
      format: previewFormat,
      quality: previewQuality,
    });

    return {
      pp3Content,
      pp3Path,
      processedImagePath: "",
      evaluationImagePath,
      generationIndex: index,
      success: true,
    };
  } catch (error) {
    if (verbose) {
      console.warn(
        `Failed to generate PP3 profile ${String(index + 1)}:`,
        error,
      );
    }

    // Return a failed generation entry to track it
    return {
      pp3Content: "",
      pp3Path: "",
      processedImagePath: "",
      evaluationImagePath: "",
      generationIndex: index,
      success: false,
    };
  }
}

/**
 * Helper function to log multi-generation analysis
 */
export function logMultiGenerationAnalysis(
  verbose: boolean,
  inputPath: string,
  providerName: string,
  visionModel: string | string[],
  models: string[],
  generations: number,
): void {
  if (!verbose) return;

  if (Array.isArray(visionModel)) {
    console.log(
      `Analyzing image ${inputPath} with ${providerName} using ${String(models.length)} different models: ${models.join(", ")}`,
    );
  } else {
    console.log(
      `Analyzing image ${inputPath} with ${providerName} model ${String(visionModel)} for ${String(generations)} generations`,
    );
  }
}

/**
 * Helper function to log single generation analysis
 */
export function logSingleGenerationAnalysis(
  verbose: boolean,
  inputPath: string,
  providerName: string,
  visionModel: string | string[],
): void {
  if (!verbose) return;

  if (Array.isArray(visionModel)) {
    console.log(
      `Analyzing image ${inputPath} with ${providerName} models: ${visionModel.join(", ")}`,
    );
  } else {
    console.log(
      `Analyzing image ${inputPath} with ${providerName} model ${String(visionModel)}`,
    );
  }
}

/**
 * Generates multiple PP3 profiles and evaluates them
 */
export async function generateMultiplePP3Profiles(
  inputPath: string,
  basePP3Path: string,
  sections: string[],
  providerName: string,
  visionModel: string | string[],
  prompt: string | undefined,
  preset: string,
  maxRetries: number,
  verbose: boolean,
  generations: number,
  previewPath: string,
  previewFormat: "jpeg" | "png",
  previewQuality: number,
  outputFormat: ImageFormat,
  outputQuality?: number,
  tiffCompression?: TiffCompression,
  bitDepth?: BitDepth,
): Promise<MultiGenerationResult> {
  const generationResults: GenerationResult[] = [];
  const extension = inputPath.slice(inputPath.lastIndexOf("."));
  const baseName = path.basename(inputPath, extension);
  const directoryName = path.dirname(inputPath);
  const previewExtension = previewFormat === "png" ? "png" : "jpg";

  // Handle multiple models
  const models = Array.isArray(visionModel) ? visionModel : [visionModel];
  const actualGenerations = Array.isArray(visionModel)
    ? models.length
    : generations;

  // Log initial progress
  logGenerationProgress(verbose, visionModel, models, generations);

  // Generate multiple PP3 profiles
  for (let index = 0; index < actualGenerations; index++) {
    // If using multiple models, select the appropriate model for this generation
    const currentModel = Array.isArray(visionModel)
      ? models[index]
      : visionModel;

    // Log per-generation progress
    logGenerationProgress(
      verbose,
      visionModel,
      models,
      generations,
      index,
      currentModel,
    );

    // Generate a single PP3 profile
    const result = await generateSinglePP3Profile(
      inputPath,
      basePP3Path,
      sections,
      providerName,
      currentModel,
      prompt,
      preset,
      maxRetries,
      verbose,
      index,
      baseName,
      directoryName,
      previewPath,
      previewFormat,
      previewQuality,
      previewExtension,
      Array.isArray(visionModel),
    );
    if (result) {
      generationResults.push(result);
    }
  }

  const successfulGenerations = generationResults.filter(
    (result) => result.success,
  );

  if (successfulGenerations.length === 0) {
    throw new Error("Failed to generate any successful PP3 profiles");
  }

  // Use AI to evaluate and select the best result
  const { winningGeneration, evaluationReason } = await evaluateGenerations(
    generationResults,
    providerName,
    visionModel,
    maxRetries,
    verbose,
  );

  // Extract model name from the pp3Path if it was generated with multiple models
  let modelSuffix = "";
  if (Array.isArray(visionModel)) {
    // Extract model name from the pp3Path
    const pp3FileName = path.basename(winningGeneration.pp3Path);
    const modelMatch = /_gen\d+_(.+?)\.pp3$/.exec(pp3FileName);
    if (modelMatch?.[1]) {
      modelSuffix = `_${modelMatch[1]}`;
    }
  }

  // Generate final output image with the winning PP3
  const finalOutputPath = path.join(
    directoryName,
    `${baseName}_final${modelSuffix}.${outputFormat}`,
  );

  if (verbose) {
    console.log(`Generating final output image with winning PP3...`);
    console.log(`Final output path: ${finalOutputPath}`);
  }

  // Ensure the output directory exists
  await fs.promises.mkdir(path.dirname(finalOutputPath), { recursive: true });

  await convertDngToImageWithPP3({
    input: inputPath,
    output: finalOutputPath,
    pp3Path: winningGeneration.pp3Path,
    format: outputFormat,
    quality: outputQuality,
    tiffCompression,
    bitDepth,
  });

  if (verbose) {
    console.log(`Final output image created at ${finalOutputPath}`);
  }

  // Update the winning generation's processedImagePath to point to the final output
  winningGeneration.processedImagePath = finalOutputPath;

  return {
    bestResult: winningGeneration,
    allResults: generationResults,
    evaluationReason,
    finalOutputPath,
  };
}
