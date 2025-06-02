// eslint-disable-next-line unicorn/import-style
import { basename, dirname, join } from "node:path";
import {
  convertDngToImage,
  convertDngToImageWithPP3,
} from "./raw-therapee-wrap.js";
import { generateText, LanguageModelV1 } from "ai";
import fs from "node:fs";
import { PREVIEW_SETTINGS } from "./constants.js";
import { validateFileAccess, handleFileError } from "./utils/validation.js";
import { handleProviderSetup } from "./utils/ai-provider.js";

import {
  PreviewImageParameters,
  P3GenerationParameters,
  GenerationResult,
  MultiGenerationResult,
  ImageFormat,
  TiffCompression,
  BitDepth,
} from "./types.js";
import { parseSearchReplaceBlocks } from "./pp3-parser.js";
import { getPromptByPreset, EVALUATION_PROMPT } from "./prompts.js";

export interface SectionResult {
  sections: string[];
  sectionOrders: string[];
}

export interface SectionWithFilter extends SectionResult {
  includedSections: string[];
  excludedSections: string[];
}

interface SectionParseState {
  currentSection: string;
  currentSectionName: string;
  sectionIndex: number;
  inSection: boolean;
}

function createSectionParseState(): SectionParseState {
  return {
    currentSection: "",
    currentSectionName: "",
    sectionIndex: 0,
    inSection: false,
  };
}

function finalizePreviousSection(
  state: SectionParseState,
  sections: string[],
  processSection?: (
    section: string,
    sectionName: string,
    index: number,
  ) => void,
): void {
  if (state.inSection && state.currentSection) {
    const trimmedSection = state.currentSection.trim();
    sections.push(trimmedSection);
    if (processSection) {
      processSection(
        trimmedSection,
        state.currentSectionName,
        state.sectionIndex,
      );
    }
    state.sectionIndex++;
  }
}

function startNewSection(
  line: string,
  trimmedLine: string,
  state: SectionParseState,
  sectionOrders: string[],
): void {
  const sectionName = trimmedLine.slice(1, -1);
  state.currentSection = line;
  state.currentSectionName = sectionName;
  sectionOrders.push(sectionName);
  state.inSection = true;
}

function handleSectionLine(line: string, state: SectionParseState): void {
  const trimmedLine = line.trim();

  if (trimmedLine.startsWith("[")) {
    return; // This case is handled by the caller
  }

  if (state.inSection) {
    state.currentSection += `\n${line}`;
  }
}

/**
 * Base function to split content into sections based on section headers in square brackets
 * @param content - The content to split into sections
 * @param processSection - Optional callback to process each section as it's found
 * @returns Object containing sections and their order
 */
export function splitContentBySections(
  content: string,
  processSection?: (
    section: string,
    sectionName: string,
    index: number,
  ) => void,
): SectionResult {
  if (!content.trim()) {
    return { sections: [], sectionOrders: [] };
  }

  const lines = content.split("\n");
  const sections: string[] = [];
  const sectionOrders: string[] = [];
  const state = createSectionParseState();

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("[")) {
      finalizePreviousSection(state, sections, processSection);
      startNewSection(line, trimmedLine, state, sectionOrders);
    } else {
      handleSectionLine(line, state);
    }
  }

  // Handle the last section
  finalizePreviousSection(state, sections, processSection);

  return { sections, sectionOrders };
}

/**
 * Splits PP3 content into sections and categorizes them based on provided section names
 * @param content - The PP3 file content as a string
 * @param sectionNames - Array of section names to include
 * @returns Object containing included sections, excluded sections, and section order
 */
export function splitPP3ContentBySections(
  content: string,
  sectionNames: string[],
): SectionWithFilter {
  const includedSections: string[] = [];
  const excludedSections: string[] = [];

  const { sections, sectionOrders } = splitContentBySections(
    content,
    (section, sectionName) => {
      if (sectionNames.includes(sectionName)) {
        includedSections.push(section);
      } else {
        excludedSections.push(section);
      }
    },
  );

  return { sections, sectionOrders, includedSections, excludedSections };
}

/**
 * Splits content into sections based on section headers in square brackets
 * @param content - The content to split into sections
 * @returns Object containing sections and their order
 */
export function splitContentIntoSections(content: string): SectionResult {
  return splitContentBySections(content);
}

async function readImageData(
  previewPath: string,
  verbose: boolean,
): Promise<Buffer> {
  try {
    const imageData = await fs.promises.readFile(previewPath);
    if (verbose) console.log("Preview file read successfully");
    return imageData;
  } catch (error: unknown) {
    handleFileError(error, previewPath, "read");
    throw new Error("Failed to read preview image data");
  }
}

async function readBasePP3Content(
  basePP3Path: string,
  verbose: boolean,
): Promise<string | undefined> {
  try {
    const content = await fs.promises.readFile(basePP3Path, "utf8");
    if (verbose)
      console.log(`Base PP3 file read successfully from ${basePP3Path}`);
    return content;
  } catch (error: unknown) {
    handleFileError(error, basePP3Path, "read");
    return undefined;
  }
}

/**
 * Finds the section boundaries in content
 */
function findSectionBoundaries(
  contentLines: string[],
  sectionHeader: string,
): { startIndex: number; endIndex: number } | null {
  const sectionStartIndex = contentLines.findIndex(
    (line) => line.trim() === sectionHeader,
  );
  if (sectionStartIndex === -1) {
    return null;
  }

  // Find the end of the section (next section or end of content)
  let sectionEndIndex = contentLines.length;
  for (
    let index = sectionStartIndex + 1;
    index < contentLines.length;
    index++
  ) {
    const line = contentLines[index].trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      sectionEndIndex = index;
      break;
    }
  }

  return { startIndex: sectionStartIndex, endIndex: sectionEndIndex };
}

/**
 * Extracts parameter lines from search/replace patterns
 */
function extractParameters(lines: string[]): string[] {
  return lines
    .filter((line) => !line.trim().startsWith("[") && line.trim().length > 0)
    .map((line) => line.trim());
}

/**
 * Creates a map of parameter names to replacement values
 */
function createReplacementMap(
  searchParameters: string[],
  replaceParameters: string[],
): Map<string, string> {
  const replaceMap = new Map<string, string>();

  for (const [index, searchParameter] of searchParameters.entries()) {
    const replaceParameter = replaceParameters[index];
    const searchParameterName = searchParameter.split("=")[0];
    replaceMap.set(searchParameterName, replaceParameter);
  }

  return replaceMap;
}

/**
 * Applies replacements within a section
 */
function applyReplacementsInSection(
  contentLines: string[],
  boundaries: { startIndex: number; endIndex: number },
  replaceMap: Map<string, string>,
  verbose: boolean,
): string[] {
  const result = [...contentLines];
  const indentationRegex = /^\s*/;

  for (
    let index = boundaries.startIndex + 1;
    index < boundaries.endIndex;
    index++
  ) {
    const line = result[index].trim();
    if (line.length === 0) continue;

    const parameterName = line.split("=")[0];
    if (replaceMap.has(parameterName)) {
      const originalIndentation =
        indentationRegex.exec(result[index])?.[0] ?? "";
      const replacementValue = replaceMap.get(parameterName);

      if (replacementValue !== undefined) {
        result[index] = originalIndentation + replacementValue;

        if (verbose) {
          console.log(`Replaced: ${line} -> ${replacementValue}`);
        }
      }
    }
  }

  return result;
}

/**
 * Applies fuzzy search/replace that supports line skipping within sections
 */
function applyFuzzySearchReplace(
  content: string,
  search: string,
  replace: string,
  verbose: boolean,
): string {
  const searchLines = search.trim().split("\n");
  const replaceLines = replace.trim().split("\n");
  const contentLines = content.split("\n");

  // Find the section header (first line starting with [)
  const sectionHeaderLine = searchLines.find((line) =>
    line.trim().startsWith("["),
  );
  if (!sectionHeaderLine) {
    return content.replace(search.trim(), replace.trim());
  }

  const sectionHeader = sectionHeaderLine.trim();
  const boundaries = findSectionBoundaries(contentLines, sectionHeader);

  if (!boundaries) {
    if (verbose) {
      console.log(`Section ${sectionHeader} not found in content`);
    }
    return content;
  }

  const searchParameters = extractParameters(searchLines);
  const replaceParameters = extractParameters(replaceLines);

  if (searchParameters.length !== replaceParameters.length) {
    if (verbose) {
      console.log("Parameter count mismatch, falling back to exact match");
    }
    return content.replace(search.trim(), replace.trim());
  }

  const replaceMap = createReplacementMap(searchParameters, replaceParameters);
  const result = applyReplacementsInSection(
    contentLines,
    boundaries,
    replaceMap,
    verbose,
  );

  return result.join("\n");
}

function applySearchReplaceBlocks(
  content: string,
  searchReplaceBlocks: { search: string; replace: string }[],
  verbose: boolean,
): string {
  let result = content;

  for (const block of searchReplaceBlocks) {
    const { search, replace } = block;

    if (!search || !replace) {
      throw new Error("Invalid search/replace block format");
    }

    if (verbose) {
      console.log(`Searching for: ${search}`);
      console.log(`Replacing with: ${replace}`);
    }

    // Try fuzzy search/replace first, fallback to exact match
    const fuzzyResult = applyFuzzySearchReplace(
      result,
      search,
      replace,
      verbose,
    );
    result =
      fuzzyResult === result
        ? result.replace(search.trim(), replace.trim())
        : fuzzyResult;
  }

  return result;
}

function reconstructPP3Content(
  sectionOrders: string[],
  editedSections: string[],
  includedSections: string[],
  excludedSections: string[],
): string {
  return sectionOrders
    .map((sectionName) => {
      return (
        editedSections.find((section) =>
          section.startsWith(`[${sectionName}]`),
        ) ??
        includedSections.find((section) =>
          section.startsWith(`[${sectionName}]`),
        ) ??
        excludedSections.find((section) =>
          section.startsWith(`[${sectionName}]`),
        ) ??
        ""
      );
    })
    .join("\n");
}

async function cleanupPreviewFiles(
  previewPath: string,
  previewCreated: boolean,
  keepPreview: boolean,
  verbose: boolean,
): Promise<void> {
  if (!previewCreated || keepPreview) {
    return;
  }

  try {
    await fs.promises.unlink(previewPath);
    await fs.promises.unlink(`${previewPath}.pp3`);
    if (verbose) console.log("Preview file cleaned up");
  } catch (cleanupError: unknown) {
    if (cleanupError instanceof Error && "code" in cleanupError && verbose) {
      if (cleanupError.code === "ENOENT") {
        console.warn("Preview file was already deleted");
      } else if (cleanupError.code === "EACCES") {
        console.warn(
          "Permission denied deleting preview file:",
          cleanupError.message,
        );
      } else {
        console.warn("Failed to clean up preview file:", cleanupError.message);
      }
    }
  }
}

async function generateAIResponse(
  aiProvider: LanguageModelV1,
  extractedText: string,
  imageData: Buffer,
  maxRetries: number,
  providerName: string,
): Promise<string> {
  try {
    const response = await generateText({
      model: aiProvider,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: extractedText,
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
    return responseText;
  } catch (error: unknown) {
    throw new Error(
      `AI provider error (${providerName}): ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function createPreviewImage({
  inputPath,
  previewPath,
  basePP3Path,
  quality,
  format = "jpeg",
  verbose,
}: PreviewImageParameters) {
  try {
    await (basePP3Path
      ? convertDngToImageWithPP3({
          input: inputPath,
          output: previewPath,
          pp3Path: basePP3Path,
          format,
          quality,
        })
      : convertDngToImage({
          input: inputPath,
          output: previewPath,
          format,
          quality,
        }));
    if (verbose) console.log(`Preview file created at ${previewPath}`);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error("Unknown error creating preview image");
  }
}

async function setupPreviewAndValidation(
  inputPath: string,
  previewPath: string,
  basePP3Path: string | undefined,
  previewQuality: number,
  previewFormat: "jpeg" | "png",
  verbose: boolean,
): Promise<{ previewCreated: boolean; finalBasePP3Path: string }> {
  await validateFileAccess(inputPath, "read");
  await validateFileAccess(dirname(previewPath), "write");

  if (verbose)
    console.log(`Generating preview with quality=${String(previewQuality)}`);
  const previewCreated = await createPreviewImage({
    inputPath,
    previewPath,
    basePP3Path,
    quality: previewQuality,
    format: previewFormat,
    verbose,
  });

  const finalBasePP3Path = basePP3Path ?? `${previewPath}.pp3`;
  return { previewCreated, finalBasePP3Path };
}

async function processAIGeneration(
  previewPath: string,
  basePP3Path: string,
  sections: string[],
  providerName: string,
  visionModel: string,
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

  if (verbose) console.log("Sending request to AI provider...", extractedText);
  const responseText = await generateAIResponse(
    aiProvider,
    extractedText,
    imageData,
    maxRetries,
    providerName,
  );

  if (verbose) console.log("Received response from AI provider:", responseText);

  const searchReplaceBlocks = parseSearchReplaceBlocks(
    responseText.replaceAll("```", ""),
  );
  if (searchReplaceBlocks.length === 0) {
    if (verbose) console.log("No valid search/replace blocks found");
    throw new Error("No valid search/replace blocks found");
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

async function prepareImageContents(
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
      imageContents.push(
        { type: "text", text: `\n\nGeneration ${String(displayIndex)}:` },
        { type: "image", image: imageData },
      );
      displayIndex++;
    } catch (error) {
      if (verbose) {
        console.warn(
          `Failed to read evaluation image ${result.evaluationImagePath}:`,
          error,
        );
      }
      // Mark this generation as failed since we couldn't read its image
      result.success = false;
    }
  }

  return imageContents;
}

function parseBestGenerationIndex(
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

async function evaluateGenerations(
  generationResults: GenerationResult[],
  providerName: string,
  visionModel: string,
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
    // Find the index of this successful result in the original array
    const originalIndex = generationResults.indexOf(successfulResults[0]);
    return {
      bestIndex: originalIndex,
      evaluationReason: "Only one successful generation available",
    };
  }

  const aiProvider = handleProviderSetup(providerName, visionModel);
  // Only pass successful generations to prepareImageContents
  const imageContents = await prepareImageContents(successfulResults, verbose);

  if (verbose) {
    console.log(
      `Evaluating ${String(successfulResults.length)} successful generations with AI...`,
    );
  }

  try {
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
    }

    return {
      bestIndex: finalIndex,
      evaluationReason: responseText,
    };
  } catch (error) {
    if (verbose) {
      console.warn("AI evaluation failed, using first generation:", error);
    }
    // Find the index of the first successful generation in the original array
    const firstSuccessfulIndex = generationResults.findIndex(
      (result) => result.success,
    );

    return {
      bestIndex: Math.max(firstSuccessfulIndex, 0),
      evaluationReason: `AI evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}. Using first successful generation as fallback.`,
    };
  }
}

async function generateMultiplePP3Profiles(
  inputPath: string,
  basePP3Path: string,
  sections: string[],
  providerName: string,
  visionModel: string,
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
  const baseName = basename(inputPath, extension);
  const directoryName = dirname(inputPath);
  const previewExtension = previewFormat === "png" ? "png" : "jpg";

  if (verbose) {
    console.log(`Generating ${String(generations)} different PP3 profiles...`);
  }

  // Generate multiple PP3 profiles
  for (let index = 0; index < generations; index++) {
    if (verbose) {
      console.log(
        `Generating PP3 profile ${String(index + 1)}/${String(generations)}...`,
      );
    }

    try {
      const pp3Content = await processAIGeneration(
        previewPath,
        basePP3Path,
        sections,
        providerName,
        visionModel,
        prompt,
        preset,
        maxRetries,
        verbose,
      );

      const pp3Path = join(
        directoryName,
        `${baseName}_gen${String(index + 1)}.pp3`,
      );
      await fs.promises.writeFile(pp3Path, pp3Content);

      // Create evaluation image with same format/quality as preview for consistency
      const evaluationImagePath = join(
        directoryName,
        `${baseName}_gen${String(index + 1)}_eval.${previewExtension}`,
      );
      await convertDngToImageWithPP3({
        input: inputPath,
        output: evaluationImagePath,
        pp3Path,
        format: previewFormat,
        quality: previewQuality,
      });

      generationResults.push({
        pp3Content,
        pp3Path,
        processedImagePath: "", // Will be set to final output path for the winning generation
        evaluationImagePath,
        generationIndex: index,
        success: true,
      });

      if (verbose) {
        console.log(
          `Generated PP3 profile ${String(index + 1)} and evaluation image`,
        );
      }
    } catch (error) {
      if (verbose) {
        console.warn(
          `Failed to generate PP3 profile ${String(index + 1)}:`,
          error,
        );
      }

      // Add a failed generation entry to track it
      generationResults.push({
        pp3Content: "",
        pp3Path: "",
        processedImagePath: "",
        evaluationImagePath: "",
        generationIndex: index,
        success: false,
      });

      // Continue with other generations even if one fails
    }
  }

  const successfulGenerations = generationResults.filter(
    (result) => result.success,
  );

  if (successfulGenerations.length === 0) {
    throw new Error("Failed to generate any successful PP3 profiles");
  }

  // Use AI to evaluate and select the best result
  const { bestIndex, evaluationReason } = await evaluateGenerations(
    generationResults,
    providerName,
    visionModel,
    maxRetries,
    verbose,
  );

  // Generate final output image with the winning PP3
  const finalOutputPath = join(
    directoryName,
    `${baseName}_final.${outputFormat}`,
  );

  if (verbose) {
    console.log(`Generating final output image with winning PP3...`);
    console.log(`Final output path: ${finalOutputPath}`);
  }

  await convertDngToImageWithPP3({
    input: inputPath,
    output: finalOutputPath,
    pp3Path: generationResults[bestIndex].pp3Path,
    format: outputFormat,
    quality: outputQuality,
    tiffCompression,
    bitDepth,
  });

  if (verbose) {
    console.log(`Final output image created at ${finalOutputPath}`);
  }

  // Update the winning generation's processedImagePath to point to the final output
  generationResults[bestIndex].processedImagePath = finalOutputPath;

  return {
    bestResult: generationResults[bestIndex],
    allResults: generationResults,
    evaluationReason,
    finalOutputPath,
  };
}

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
  const previewPath = join(
    dirname(inputPath),
    `${basename(inputPath, extension)}_preview.${previewExtension}`,
  );

  if (verbose) {
    console.log(
      `Analyzing image ${inputPath} with ${providerName} model ${visionModel} for ${String(generations)} generations`,
    );
  }

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
      generations,
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
  const previewPath = join(
    dirname(inputPath),
    `${basename(inputPath, extension)}_preview.${previewExtension}`,
  );

  if (verbose) {
    console.log(
      `Analyzing image ${inputPath} with ${providerName} model ${visionModel}`,
    );
  }

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
