// Core type definitions for PP3 processing

export type ImageFormat = "jpeg" | "tiff" | "png";
export type TiffCompression = "z" | "none";
export type BitDepth = 8 | 16;

export interface PreviewImageParameters {
  inputPath: string;
  previewPath: string;
  basePP3Path?: string;
  quality: number;
  format?: "jpeg" | "png";
  verbose?: boolean;
}

export interface P3GenerationParameters {
  inputPath: string;
  basePP3Path?: string;
  providerName?: string;
  /**
   * Vision model to use for image analysis
   * Can be a single model name (string) or an array of model names
   * If an array is provided, each model will be used for one generation
   * The number of generations will be equal to the number of models
   */
  visionModel?: string | string[];
  verbose?: boolean;
  keepPreview?: boolean;
  prompt?: string;
  preset?: string;
  sections?: string[];
  previewQuality?: number;
  previewFormat?: "jpeg" | "png";
  maxRetries?: number;
  /**
   * Number of generations to create
   * Note: If visionModel is an array, this value is ignored and
   * the number of generations equals the number of models
   */
  generations?: number;
}

export interface PreviewSettings {
  quality: number;
}

export interface OutputSettings {
  quality: number;
}

export interface GenerationResult {
  pp3Content: string;
  pp3Path: string;
  processedImagePath: string;
  evaluationImagePath: string;
  generationIndex: number;
  success: boolean;
}

export interface MultiGenerationResult {
  bestResult: GenerationResult;
  allResults: GenerationResult[];
  evaluationReason: string;
  finalOutputPath: string;
}
