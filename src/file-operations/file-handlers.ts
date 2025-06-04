// File operation functionality extracted from agent.ts
import fs from "node:fs";
import path from "node:path";
import { handleFileError, validateFileAccess } from "../utils/validation.js";
import {
  convertDngToImage,
  convertDngToImageWithPP3,
} from "../raw-therapee-wrap.js";
import { PreviewImageParameters } from "../types.js";

/**
 * Reads image data from a file
 */
export async function readImageData(
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

/**
 * Reads PP3 content from a file
 */
export async function readBasePP3Content(
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
 * Creates a preview image from a RAW file
 */
export async function createPreviewImage({
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

/**
 * Sets up preview image and validates file access
 */
export async function setupPreviewAndValidation(
  inputPath: string,
  previewPath: string,
  basePP3Path: string | undefined,
  previewQuality: number,
  previewFormat: "jpeg" | "png",
  verbose: boolean,
): Promise<{ previewCreated: boolean; finalBasePP3Path: string }> {
  await validateFileAccess(inputPath, "read");
  await validateFileAccess(path.dirname(previewPath), "write");

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

/**
 * Cleans up preview files if needed
 */
export async function cleanupPreviewFiles(
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
