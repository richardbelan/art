#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { convertDngToImageWithPP3 } from "./raw-therapee-wrap.js";
import { generatePP3FromRawImage } from "./agent.js";
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
  maxRetries?: number;
}

function getOutputFormat(
  options: ProcessImageOptions,
): "jpeg" | "tiff" | "png" {
  if (options.png) return "png";
  if (options.tiff) return "tiff";
  return "jpeg";
}

export async function processImage(
  inputPath: string,
  options: ProcessImageOptions = {},
) {
  if (!inputPath) {
    throw new Error("Input path cannot be empty");
  }

  // Validate input file exists and is readable
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

  // Generate PP3 content
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
    maxRetries: options.maxRetries,
  });

  if (!pp3Content) {
    throw new Error("Failed to generate PP3 content");
  }

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const pp3Path = options.output || inputPath.replace(/\.[^.]+$/, ".pp3");

  await fs.promises.writeFile(pp3Path, pp3Content);
  // Handle PP3-only mode
  if (options.pp3Only) {
    return;
  }

  // Process image with PP3
  const format = getOutputFormat(options);
  const outputPath =
    options.output ?? inputPath.replace(/\.[^.]+$/, `_processed.${format}`);
  await convertDngToImageWithPP3({
    input: inputPath,
    output: outputPath,
    pp3Path,
    format,
    tiffCompression: options.compression,
    bitDepth: Number(options.bitDepth) as 8 | 16,
  });
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
          describe: "Keep the preview.jpg file after processing",
          type: "boolean",
        })
        .option("quality", {
          alias: "q",
          describe: "Quality of the output image (JPEG only)",
          type: "number",
        })
        .option("preview-quality", {
          describe: "JPEG quality for preview generation (1-100)",
          type: "number",
          coerce: (value) => {
            const quality = Number.parseInt(String(value), 10);
            if (Number.isNaN(quality) || quality < 1 || quality > 100) {
              throw new Error("Preview quality must be between 1 and 100");
            }
            return quality;
          },
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
          maxRetries: argv["max-retries"],
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
