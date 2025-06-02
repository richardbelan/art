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
  visionModel?: string;
  verbose?: boolean;
  keepPreview?: boolean;
  prompt?: string;
  preset?: string;
  sections?: string[];
  previewQuality?: number;
  previewFormat?: "jpeg" | "png";
  maxRetries?: number;
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
