import path from "node:path";
import { PREVIEW_SETTINGS } from "./constants.js";
import {
  P3GenerationParameters,
  MultiGenerationResult,
  ImageFormat,
  TiffCompression,
  BitDepth,
} from "./types.js";

// Re-export section parsing functionality
export {
  splitContentBySections,
  splitPP3ContentBySections,
  splitContentIntoSections,
  type SectionResult,
  type SectionWithFilter,
} from "./pp3-sections/section-parser.js";

// Re-export section manipulation functionality
export {
  createSectionMap,
  applySectionChanges,
  applyParameterChanges,
  reconstructContent,
  reconstructPP3Content,
  applyDirectSectionChanges,
} from "./pp3-sections/section-manipulation.js";

// Re-export file operations
export {
  readImageData,
  readBasePP3Content,
  createPreviewImage,
  setupPreviewAndValidation,
  cleanupPreviewFiles,
} from "./file-operations/file-handlers.js";

// Re-export AI processing functionality
export {
  generateAIResponse,
  processAIGeneration,
  evaluateGenerations,
} from "./ai-generation/ai-processor.js";

// Import search/replace functionality
import { processAIGeneration } from "./ai-generation/ai-processor.js";

// Re-export generation helpers
export {
  logGenerationProgress,
  generateSinglePP3Profile,
  logMultiGenerationAnalysis,
  logSingleGenerationAnalysis,
  generateMultiplePP3Profiles,
} from "./ai-generation/generation-helpers.js";
import {
  setupPreviewAndValidation,
  cleanupPreviewFiles,
} from "./file-operations/file-handlers.js";
import {
  generateMultiplePP3Profiles,
  logSingleGenerationAnalysis,
  logMultiGenerationAnalysis,
} from "./ai-generation/generation-helpers.js";

/**
 * Generates multiple PP3 profiles from a RAW image and selects the best one
 */
export async function generateMultiPP3FromRawImage({
  inputPath,
  basePP3Path,
  providerName = "openai",
  visionModel = "gpt-4-vision-preview",
  verbose = false,
  keepPreview = false,
  prompt,
  preset = "aggressive",
  sections = [
    "Exposure",
    "Retinex",
    "Local Contrast",
    "Wavlet",
    "Vibrance",
    "White Balance",
    "Color appearance",
    "Shadows & Highlights",
    "RGB Curves",
    "ColorToning",
    "ToneEqualizer",
    "Sharpening",
    "Defringing",
    "Dehaze",
    "Directional Pyramid Denoising",
  ],
  previewQuality = PREVIEW_SETTINGS.quality,
  previewFormat = "jpeg",
  maxRetries = 2,
  generations = 3,
  outputFormat = "jpeg" as ImageFormat,
  outputQuality = 100,
  tiffCompression,
  bitDepth = 16 as BitDepth,
}: P3GenerationParameters & {
  outputFormat?: ImageFormat;
  outputQuality?: number;
  tiffCompression?: TiffCompression;
  bitDepth?: BitDepth;
}): Promise<MultiGenerationResult> {
  const extension = inputPath.slice(inputPath.lastIndexOf("."));
  const previewExtension = previewFormat === "png" ? "png" : "jpg";
  const previewPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, extension)}_preview.${previewExtension}`,
  );

  // Handle multiple models
  const models = Array.isArray(visionModel) ? visionModel : [visionModel];
  const actualGenerations = Array.isArray(visionModel)
    ? models.length
    : generations;

  // Log analysis information
  logMultiGenerationAnalysis(
    verbose,
    inputPath,
    providerName,
    visionModel,
    models,
    generations,
  );

  let previewCreated = false;

  try {
    const setup = await setupPreviewAndValidation(
      inputPath,
      previewPath,
      basePP3Path,
      previewQuality,
      previewFormat,
      verbose,
    );
    previewCreated = setup.previewCreated;

    return await generateMultiplePP3Profiles(
      inputPath,
      setup.finalBasePP3Path,
      sections,
      providerName,
      visionModel,
      prompt,
      preset,
      maxRetries,
      verbose,
      actualGenerations,
      previewPath,
      previewFormat,
      previewQuality,
      outputFormat,
      outputQuality,
      tiffCompression,
      bitDepth,
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (verbose) {
        console.error("Error during multi-generation PP3 creation:");
        console.error(error.message);
        if (error.stack) console.error(error.stack);
      }
      throw error;
    }
    throw new Error(
      `Unknown error during multi-generation PP3 creation: ${String(error)}`,
    );
  } finally {
    await cleanupPreviewFiles(
      previewPath,
      previewCreated,
      keepPreview,
      verbose,
    );
  }
}

/**
 * Generates a single PP3 profile from a RAW image
 */
export async function generatePP3FromRawImage({
  inputPath,
  basePP3Path,
  providerName = "openai",
  visionModel = "gpt-4-vision-preview",
  verbose = false,
  keepPreview = false,
  prompt,
  preset = "aggressive",
  sections = [
    "Exposure",
    "Retinex",
    "Local Contrast",
    "Wavlet",
    "Vibrance",
    "White Balance",
    "Color appearance",
    "Shadows & Highlights",
    "RGB Curves",
    "ColorToning",
    "ToneEqualizer",
    "Sharpening",
    "Defringing",
    "Dehaze",
    "Directional Pyramid Denoising",
  ],
  previewQuality = PREVIEW_SETTINGS.quality,
  previewFormat = "jpeg",
  maxRetries = 2,
}: P3GenerationParameters): Promise<string> {
  const extension = inputPath.slice(inputPath.lastIndexOf("."));
  const previewExtension = previewFormat === "png" ? "png" : "jpg";
  const previewPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, extension)}_preview.${previewExtension}`,
  );

  // Log analysis information
  logSingleGenerationAnalysis(verbose, inputPath, providerName, visionModel);

  let previewCreated = false;

  try {
    const setup = await setupPreviewAndValidation(
      inputPath,
      previewPath,
      basePP3Path,
      previewQuality,
      previewFormat,
      verbose,
    );
    previewCreated = setup.previewCreated;

    return await processAIGeneration(
      previewPath,
      setup.finalBasePP3Path,
      sections,
      providerName,
      visionModel,
      prompt,
      preset,
      maxRetries,
      verbose,
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (verbose) {
        console.error("Error during PP3 generation:");
        console.error(error.message);
        if (error.stack) console.error(error.stack);
      }
      throw error;
    }
    throw new Error(`Unknown error during PP3 generation: ${String(error)}`);
  } finally {
    await cleanupPreviewFiles(
      previewPath,
      previewCreated,
      keepPreview,
      verbose,
    );
  }
}
