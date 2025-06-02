#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { convertDngToImageWithPP3 } from "./raw-therapee-wrap.js";
import {
  generatePP3FromRawImage,
  generateMultiPP3FromRawImage,
} from "./agent.js";
import { ImageFormat } from "./types.js";
import fs from "node:fs";
import packageJson from "../package.json" with { type: "json" };

interface ProcessImageOptions {
  output?: string;
  pp3Only?: boolean;
  provider?: string;
  model?: string;
  verbose?: boolean;
  keepPreview?: boolean;
  quality?: number;
  prompt?: string;
  preset?: string;
  base?: string;
  sections?: string;
  tiff?: boolean;
  png?: boolean;
  compression?: "z" | "none";
  bitDepth?: 8 | 16;
  previewQuality?: number;
  previewFormat?: "jpeg" | "png";
  maxRetries?: number;
  generations?: number;
}

function getOutputFormat(options: ProcessImageOptions): ImageFormat {
  if (options.png) return "png";
  if (options.tiff) return "tiff";
  return "jpeg";
}

async function validateInputFile(inputPath: string): Promise<void> {
  if (!inputPath) {
    throw new Error("Input path cannot be empty");
  }

  try {
    await fs.promises.access(inputPath, fs.constants.R_OK);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "ENOENT") {
        throw new Error(`Input file not found: ${inputPath}`);
      } else if (error.code === "EACCES") {
        throw new Error(`Permission denied reading input file: ${inputPath}`);
      }
      throw error;
    }
  }
}

function generateOutputPaths(
  inputPath: string,
  options: ProcessImageOptions,
  format: ImageFormat,
) {
  const pp3Path = options.output ?? inputPath.replace(/\.[^.]+$/, ".pp3");
  const imagePath =
    options.output ?? inputPath.replace(/\.[^.]+$/, `_processed.${format}`);
  return { pp3Path, imagePath };
}

async function cleanupIntermediateFiles(
  allResults: { pp3Path: string; processedImagePath: string }[],
  bestResult: { pp3Path: string; processedImagePath: string },
): Promise<void> {
  for (const genResult of allResults) {
    if (genResult !== bestResult) {
      try {
        await fs.promises.unlink(genResult.pp3Path);
        await fs.promises.unlink(genResult.processedImagePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// Helper functions to reduce cognitive complexity
async function generateMultiPP3Result(
  inputPath: string,
  options: ProcessImageOptions,
  format: string,
) {
  return await generateMultiPP3FromRawImage({
    inputPath,
    basePP3Path: options.base,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    providerName: options.provider || "openai",
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    visionModel: options.model || "gpt-4-vision-preview",
    verbose: options.verbose,
    keepPreview: options.keepPreview,
    prompt: options.prompt,
    preset: options.preset,
    sections: options.sections?.split(",").filter((s) => s.trim() !== ""),
    previewQuality: options.previewQuality,
    previewFormat: options.previewFormat,
    maxRetries: options.maxRetries,
    generations: options.generations,
    outputFormat: format as ImageFormat,
    outputQuality: options.quality,
    tiffCompression: options.compression,
    bitDepth: Number(options.bitDepth) as 8 | 16,
  });
}

async function copyFinalOutput(
  sourcePath: string,
  destinationPath: string,
  verbose: boolean | undefined,
): Promise<void> {
  if (verbose) {
    console.log(
      `Copying final output from ${sourcePath} to ${destinationPath}`,
    );
  }

  try {
    await fs.promises.copyFile(sourcePath, destinationPath);
  } catch (error) {
    if (verbose) {
      console.error(
        `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    throw error;
  }
}

async function processMultiGeneration(
  inputPath: string,
  options: ProcessImageOptions,
): Promise<void> {
  if (options.verbose) {
    console.log(
      `Multi-generation mode: generating ${String(options.generations)} different PP3 profiles`,
    );
  }

  const format = getOutputFormat(options);
  const result = await generateMultiPP3Result(inputPath, options, format);

  const { pp3Path, imagePath } = generateOutputPaths(
    inputPath,
    options,
    format,
  );
  await fs.promises.writeFile(pp3Path, result.bestResult.pp3Content);

  if (options.verbose) {
    console.log(
      `Selected generation ${String(result.bestResult.generationIndex + 1)} as the best result`,
    );
    console.log(`AI evaluation: ${result.evaluationReason.split("\n")[0]}`);
  }

  if (options.pp3Only) {
    return;
  }

  if (result.bestResult.processedImagePath !== imagePath) {
    await copyFinalOutput(
      result.bestResult.processedImagePath,
      imagePath,
      options.verbose,
    );
  }

  if (!options.verbose && !options.keepPreview) {
    await cleanupIntermediateFiles(result.allResults, result.bestResult);
  }
}

async function processSingleGeneration(
  inputPath: string,
  options: ProcessImageOptions,
): Promise<void> {
  const pp3Content = await generatePP3FromRawImage({
    inputPath,
    basePP3Path: options.base,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    providerName: options.provider || "openai",
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    visionModel: options.model || "gpt-4-vision-preview",
    verbose: options.verbose,
    keepPreview: options.keepPreview,
    prompt: options.prompt,
    preset: options.preset,
    sections: options.sections?.split(",").filter((s) => s.trim() !== ""),
    previewQuality: options.previewQuality,
    previewFormat: options.previewFormat,
    maxRetries: options.maxRetries,
  });

  if (!pp3Content) {
    throw new Error("Failed to generate PP3 content");
  }

  const format = getOutputFormat(options);
  const { pp3Path, imagePath } = generateOutputPaths(
    inputPath,
    options,
    format,
  );

  await fs.promises.writeFile(pp3Path, pp3Content);

  if (options.pp3Only) {
    return;
  }

  await convertDngToImageWithPP3({
    input: inputPath,
    output: imagePath,
    pp3Path,
    format: format,
    tiffCompression: options.compression,
    bitDepth: Number(options.bitDepth) as 8 | 16,
  });
}

export async function processImage(
  inputPath: string,
  options: ProcessImageOptions = {},
) {
  await validateInputFile(inputPath);

  return options.generations && options.generations > 1
    ? processMultiGeneration(inputPath, options)
    : processSingleGeneration(inputPath, options);
}

// Create the CLI program
// eslint-disable-next-line sonarjs/void-use
void yargs(hideBin(process.argv))
  .scriptName("ai-pp3")
  .usage("$0 <input> [options]")
  .command(
    "$0 <input>",
    "Process a RAW image file with AI-generated PP3 profile",
    (yargs) => {
      return yargs
        .positional("input", {
          describe: "Input RAW file path",
          type: "string",
          demandOption: true,
        })
        .option("output", {
          alias: "o",
          describe:
            "Output file path (defaults to input.pp3 or input_processed.jpg)",
          type: "string",
        })
        .option("pp3-only", {
          describe: "Only generate PP3 file without processing the image",
          type: "boolean",
        })
        .option("prompt", {
          alias: "p",
          describe: "Prompt text for AI analysis",
          type: "string",
        })
        .option("preset", {
          describe:
            "Preset style to use (aggressive, creative, balanced, technical)",
          type: "string",
          default: "aggressive",
        })
        .option("provider", {
          describe: "AI provider to use",
          type: "string",
          default: "openai",
        })
        .option("model", {
          describe: "Model name to use",
          type: "string",
          default: "gpt-4-vision-preview",
        })
        .option("verbose", {
          alias: "v",
          describe: "Enable verbose logging",
          type: "boolean",
        })
        .option("keep-preview", {
          alias: "k",
          describe: "Keep the preview file after processing",
          type: "boolean",
        })
        .option("quality", {
          alias: "q",
          describe: "Quality of the output image (JPEG only)",
          type: "number",
        })
        .option("preview-quality", {
          describe: "Quality for preview generation (1-100, JPEG only)",
          type: "number",
          coerce: (value) => {
            const quality = Number.parseInt(String(value), 10);
            if (Number.isNaN(quality) || quality < 1 || quality > 100) {
              throw new Error("Preview quality must be between 1 and 100");
            }
            return quality;
          },
        })
        .option("preview-format", {
          describe: "Preview image format (jpeg or png)",
          type: "string",
          choices: ["jpeg", "png"],
          default: "jpeg",
        })
        .option("tiff", {
          describe: "Output as TIFF format",
          type: "boolean",
        })
        .option("png", {
          describe: "Output as PNG format",
          type: "boolean",
        })
        .option("compression", {
          describe: "TIFF compression type (z/none)",
          type: "string",
          choices: ["z", "none"],
        })
        .option("bit-depth", {
          describe: "Bit depth (8 or 16)",
          type: "number",
          default: 16,
          choices: [8, 16],
        })
        .option("sections", {
          describe: "Comma-separated list of PP3 sections to process",
          type: "string",
        })
        .option("base", {
          describe: "Base PP3 file to improve upon",
          type: "string",
        })
        .option("max-retries", {
          describe: "Maximum number of retries for AI API calls",
          type: "number",
          coerce: (value) => {
            const retries = Number.parseInt(String(value), 10);
            if (Number.isNaN(retries) || retries < 0) {
              throw new Error("Max retries must be a non-negative integer");
            }
            return retries;
          },
        })
        .option("generations", {
          describe:
            "Generate multiple PP3 profiles and use AI to select the best one",
          type: "number",
          coerce: (value) => {
            const generations = Number.parseInt(String(value), 10);
            if (
              Number.isNaN(generations) ||
              generations < 1 ||
              generations > 10
            ) {
              throw new Error("Generations must be between 1 and 10");
            }
            return generations;
          },
        });
    },
    async (argv) => {
      try {
        await processImage(argv.input, {
          output: argv.output,
          pp3Only: argv["pp3-only"],
          provider: argv.provider,
          model: argv.model,
          verbose: argv.verbose,
          keepPreview: argv["keep-preview"],
          quality: argv.quality,
          prompt: argv.prompt,
          preset: argv.preset,
          base: argv.base,
          sections: argv.sections,
          tiff: argv.tiff,
          png: argv.png,
          compression: argv.compression as "z" | "none" | undefined,
          bitDepth: argv["bit-depth"] as 8 | 16,
          previewQuality: argv["preview-quality"],
          previewFormat: argv["preview-format"] as "jpeg" | "png",
          maxRetries: argv["max-retries"],
          generations: argv.generations,
        });
      } catch (error_) {
        const error =
          error_ instanceof Error
            ? error_
            : new Error("Unknown error occurred");
        console.error("Error:", error.message);
        process.exit(1);
      }
    },
  )
  .describe("version", "Show version number")
  .alias("version", "V")
  .version(packageJson.version)
  .epilogue(
    "AI-Powered PP3 Profile Generator for RawTherapee\nSpecializes in bulk generation and customization of PP3 development profiles\nKey features:\n- AI-driven analysis of RAW files (DNG/NEF/CR2/ARW)\n- Batch PP3 creation with consistent processing parameters\n- Customizable development settings through natural language prompts\n- Seamless integration with existing PP3 workflows\n- Multi-model support for different processing styles\n- Interactive preview generation with quality controls\nDocumentation available in README for advanced customization",
  )
  .help()
  .alias("help", "h")
  .strict()
  .parse();
