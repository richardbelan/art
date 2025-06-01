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

import { PreviewImageParameters, P3GenerationParameters } from "./types.js";
import { parseSearchReplaceBlocks } from "./pp3-parser.js";
import { getPromptByPreset } from "./prompts.js";

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

    result = result.replace(search.trim(), replace.trim());
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
  verbose,
}: PreviewImageParameters) {
  try {
    await (basePP3Path
      ? convertDngToImageWithPP3({
          input: inputPath,
          output: previewPath,
          pp3Path: basePP3Path,
          format: "jpeg",
          quality,
        })
      : convertDngToImage({
          input: inputPath,
          output: previewPath,
          format: "jpeg",
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
  maxRetries = 2,
}: P3GenerationParameters): Promise<string> {
  const extension = inputPath.toLowerCase().slice(inputPath.lastIndexOf("."));
  const previewPath = join(
    dirname(inputPath),
    `${basename(inputPath, extension)}_preview.jpg`,
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
