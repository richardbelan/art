// Image processing utilities for histogram calculation and analysis
import sharp from "sharp";

export type Brightness = "dark" | "normal" | "bright";
export type Contrast = "low" | "normal" | "high";

export interface ImageHistogram {
  red: number[];
  green: number[];
  blue: number[];
}

export interface HistogramStats {
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  skewness: number;
  peakCount: number;
  dynamicRange: number;
}

export interface HistogramAnalysis {
  red: HistogramStats;
  green: HistogramStats;
  blue: HistogramStats;
  overall: {
    brightness: Brightness;
    contrast: Contrast;
    colorCast: string;
    exposureIssues: string[];
  };
}

/**
 * Calculate histogram for an image
 */
export async function calculateHistogram(
  imagePath: string,
): Promise<ImageHistogram> {
  try {
    const image = sharp(imagePath);
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Initialize histogram arrays with proper typing
    const histogramR: number[] = Array.from<number>({ length: 256 }).fill(0);
    const histogramG: number[] = Array.from<number>({ length: 256 }).fill(0);
    const histogramB: number[] = Array.from<number>({ length: 256 }).fill(0);

    // Calculate histogram
    for (let index = 0; index < data.length; index += info.channels) {
      const r = data[index];
      histogramR[r]++;

      if (info.channels > 1) {
        const g = data[index + 1];
        histogramG[g]++;
      }

      if (info.channels > 2) {
        const b = data[index + 2];
        histogramB[b]++;
      }
    }

    return {
      red: histogramR,
      green: histogramG,
      blue: histogramB,
    };
  } catch (error) {
    throw new Error(
      `Error calculating histogram: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Calculate histogram for image buffer
 */
export async function calculateHistogramFromBuffer(
  imageBuffer: Buffer,
): Promise<ImageHistogram> {
  try {
    const image = sharp(imageBuffer);
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Initialize histogram arrays with proper typing
    const histogramR: number[] = Array.from<number>({ length: 256 }).fill(0);
    const histogramG: number[] = Array.from<number>({ length: 256 }).fill(0);
    const histogramB: number[] = Array.from<number>({ length: 256 }).fill(0);

    // Calculate histogram
    for (let index = 0; index < data.length; index += info.channels) {
      const r = data[index];
      histogramR[r]++;

      if (info.channels > 1) {
        const g = data[index + 1];
        histogramG[g]++;
      }

      if (info.channels > 2) {
        const b = data[index + 2];
        histogramB[b]++;
      }
    }

    return {
      red: histogramR,
      green: histogramG,
      blue: histogramB,
    };
  } catch (error) {
    throw new Error(
      `Error calculating histogram from buffer: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Calculate mean value for a histogram channel
 */
function calculateMean(histogram: number[], totalPixels: number): number {
  let sum = 0;
  for (const [index, element] of histogram.entries()) {
    sum += index * element;
  }
  return sum / totalPixels;
}

/**
 * Calculate median value for a histogram channel
 */
function calculateMedian(histogram: number[], totalPixels: number): number {
  let cumulativeCount = 0;
  const target = totalPixels / 2;
  for (const [index, element] of histogram.entries()) {
    cumulativeCount += element;
    if (cumulativeCount >= target) {
      return index;
    }
  }
  return 0;
}

/**
 * Calculate mode (most frequent value) for a histogram channel
 */
function calculateMode(histogram: number[]): number {
  let mode = 0;
  let maxCount = 0;
  for (const [index, element] of histogram.entries()) {
    if (element > maxCount) {
      maxCount = element;
      mode = index;
    }
  }
  return mode;
}

/**
 * Calculate standard deviation for a histogram channel
 */
function calculateStandardDeviation(
  histogram: number[],
  mean: number,
  totalPixels: number,
): number {
  let variance = 0;
  for (const [index, element] of histogram.entries()) {
    variance += element * Math.pow(index - mean, 2);
  }
  variance /= totalPixels;
  return Math.sqrt(variance);
}

/**
 * Calculate skewness for a histogram channel
 */
function calculateSkewness(
  histogram: number[],
  mean: number,
  standardDeviation: number,
  totalPixels: number,
): number {
  let skewness = 0;
  for (const [index, element] of histogram.entries()) {
    skewness += element * Math.pow((index - mean) / standardDeviation, 3);
  }
  return skewness / totalPixels;
}

/**
 * Count peaks (local maxima) in a histogram channel
 */
function countPeaks(histogram: number[], totalPixels: number): number {
  let peakCount = 0;
  const threshold = totalPixels * 0.001;

  for (let index = 1; index < histogram.length - 1; index++) {
    if (
      histogram[index] > histogram[index - 1] &&
      histogram[index] > histogram[index + 1] &&
      histogram[index] > threshold
    ) {
      peakCount++;
    }
  }
  return peakCount;
}

/**
 * Calculate dynamic range of a histogram channel
 */
function calculateDynamicRange(histogram: number[]): number {
  let minValue = 0;
  let maxValue = 255;

  // Find first non-zero value from start
  for (const [index, element] of histogram.entries()) {
    if (element > 0) {
      minValue = index;
      break;
    }
  }

  // Find last non-zero value from end
  for (let index = histogram.length - 1; index >= 0; index--) {
    if (histogram[index] > 0) {
      maxValue = index;
      break;
    }
  }

  return maxValue - minValue;
}

/**
 * Calculate statistical measures for a histogram channel
 */
function calculateChannelStats(histogram: number[]): HistogramStats {
  const totalPixels = histogram.reduce((sum, count) => sum + count, 0);
  const mean = calculateMean(histogram, totalPixels);
  const standardDeviation = calculateStandardDeviation(
    histogram,
    mean,
    totalPixels,
  );

  return {
    mean,
    median: calculateMedian(histogram, totalPixels),
    mode: calculateMode(histogram),
    standardDeviation,
    skewness: calculateSkewness(
      histogram,
      mean,
      standardDeviation,
      totalPixels,
    ),
    peakCount: countPeaks(histogram, totalPixels),
    dynamicRange: calculateDynamicRange(histogram),
  };
}

/**
 * Determine image brightness based on channel means
 */
function determineBrightness(
  redStats: HistogramStats,
  greenStats: HistogramStats,
  blueStats: HistogramStats,
): "dark" | "normal" | "bright" {
  const avgMean = (redStats.mean + greenStats.mean + blueStats.mean) / 3;
  if (avgMean < 85) return "dark";
  if (avgMean > 170) return "bright";
  return "normal";
}

/**
 * Determine image contrast based on standard deviations
 */
function determineContrast(
  redStats: HistogramStats,
  greenStats: HistogramStats,
  blueStats: HistogramStats,
): "low" | "normal" | "high" {
  const avgStdDevelopment =
    (redStats.standardDeviation +
      greenStats.standardDeviation +
      blueStats.standardDeviation) /
    3;

  if (avgStdDevelopment < 40) return "low";
  if (avgStdDevelopment > 80) return "high";
  return "normal";
}

/**
 * Detect color cast based on channel means
 */
function detectColorCast(
  redMean: number,
  greenMean: number,
  blueMean: number,
  threshold = 10,
): string {
  if (redMean > greenMean + threshold && redMean > blueMean + threshold) {
    return "warm/red cast";
  }
  if (blueMean > redMean + threshold && blueMean > greenMean + threshold) {
    return "cool/blue cast";
  }
  if (greenMean > redMean + threshold && greenMean > blueMean + threshold) {
    return "green cast";
  }
  if (redMean > blueMean + threshold && greenMean > blueMean + threshold) {
    return "yellow cast";
  }
  if (blueMean > redMean + threshold && greenMean > redMean + threshold) {
    return "cyan cast";
  }
  if (redMean > greenMean + threshold && blueMean > greenMean + threshold) {
    return "magenta cast";
  }
  return "neutral";
}

/**
 * Detect exposure issues in the histogram
 */
function detectExposureIssues(
  histogram: ImageHistogram,
  totalPixels: number,
): string[] {
  const issues: string[] = [];
  const pixelThreshold = 0.01; // 1% threshold for clipping
  const exposureThreshold = 0.4; // 40% threshold for under/overexposure

  // Check for highlight clipping (values at 255)
  const highlightPixels =
    (histogram.red[255] + histogram.green[255] + histogram.blue[255]) / 3;
  const highlightRatio = highlightPixels / totalPixels;
  if (highlightRatio > pixelThreshold) {
    issues.push("highlight clipping detected");
  }

  // Check for shadow clipping (values at 0)
  const shadowPixels =
    (histogram.red[0] + histogram.green[0] + histogram.blue[0]) / 3;
  const shadowRatio = shadowPixels / totalPixels;
  if (shadowRatio > pixelThreshold) {
    issues.push("shadow clipping detected");
  }

  // Check for underexposure (too much data in shadows 0-63)
  const shadowData = [
    histogram.red.slice(0, 64).reduce((sum, count) => sum + count, 0),
    histogram.green.slice(0, 64).reduce((sum, count) => sum + count, 0),
    histogram.blue.slice(0, 64).reduce((sum, count) => sum + count, 0),
  ].reduce((sum, count) => sum + count, 0);

  if (shadowData / 3 / totalPixels > exposureThreshold) {
    issues.push("possible underexposure");
  }

  // Check for overexposure (too much data in highlights 192-255)
  const highlightData = [
    histogram.red.slice(192, 256).reduce((sum, count) => sum + count, 0),
    histogram.green.slice(192, 256).reduce((sum, count) => sum + count, 0),
    histogram.blue.slice(192, 256).reduce((sum, count) => sum + count, 0),
  ].reduce((sum, count) => sum + count, 0);

  if (highlightData / 3 / totalPixels > exposureThreshold) {
    issues.push("possible overexposure");
  }

  return issues;
}

/**
 * Analyze histogram to provide insights about the image
 */
export function analyzeHistogram(histogram: ImageHistogram): HistogramAnalysis {
  // Calculate statistics for each color channel
  const redStats = calculateChannelStats(histogram.red);
  const greenStats = calculateChannelStats(histogram.green);
  const blueStats = calculateChannelStats(histogram.blue);

  // Calculate total pixels for exposure analysis
  const totalPixels = histogram.red.reduce((sum, count) => sum + count, 0);

  // Perform analysis using helper functions
  const brightness = determineBrightness(redStats, greenStats, blueStats);
  const contrast = determineContrast(redStats, greenStats, blueStats);
  const colorCast = detectColorCast(
    redStats.mean,
    greenStats.mean,
    blueStats.mean,
  );
  const exposureIssues = detectExposureIssues(histogram, totalPixels);

  return {
    red: redStats,
    green: greenStats,
    blue: blueStats,
    overall: {
      brightness,
      contrast,
      colorCast,
      exposureIssues,
    },
  };
}

/**
 * Format histogram statistics for a single channel
 */
function formatStats(stats: HistogramStats, channel: string): string {
  let skewnessDescription: string;
  if (stats.skewness > 0) {
    skewnessDescription = "right-skewed";
  } else if (stats.skewness < 0) {
    skewnessDescription = "left-skewed";
  } else {
    skewnessDescription = "symmetric";
  }

  return `${channel} Channel:
- Mean: ${stats.mean.toFixed(1)} (0-255 scale)
- Median: ${String(stats.median)}
- Mode: ${String(stats.mode)}
- Standard Deviation: ${stats.standardDeviation.toFixed(1)}
- Skewness: ${stats.skewness.toFixed(2)} (${skewnessDescription})
- Peak Count: ${String(stats.peakCount)}
- Dynamic Range: ${String(stats.dynamicRange)}`;
}

/**
 * Format histogram distribution for a single channel
 */
function formatDistribution(histogram: number[], channel: string): string {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  const shadows = histogram.slice(0, 85).reduce((sum, count) => sum + count, 0);
  const midtones = histogram
    .slice(85, 170)
    .reduce((sum, count) => sum + count, 0);
  const highlights = histogram
    .slice(170, 256)
    .reduce((sum, count) => sum + count, 0);

  return `${channel} Distribution:
- Shadows (0-84): ${((shadows / total) * 100).toFixed(1)}%
- Midtones (85-169): ${((midtones / total) * 100).toFixed(1)}%
- Highlights (170-255): ${((highlights / total) * 100).toFixed(1)}%`;
}

/**
 * Format histogram data for LLM consumption
 */
export function formatHistogramForLLM(
  histogram: ImageHistogram,
  analysis: HistogramAnalysis,
): string {
  return `
IMAGE HISTOGRAM ANALYSIS:

OVERALL ASSESSMENT:
- Brightness: ${analysis.overall.brightness}
- Contrast: ${analysis.overall.contrast}
- Color Cast: ${analysis.overall.colorCast}
- Exposure Issues: ${analysis.overall.exposureIssues.length > 0 ? analysis.overall.exposureIssues.join(", ") : "none detected"}

DETAILED STATISTICS:

${formatStats(analysis.red, "Red")}

${formatStats(analysis.green, "Green")}

${formatStats(analysis.blue, "Blue")}

TONAL DISTRIBUTION:

${formatDistribution(histogram.red, "Red")}

${formatDistribution(histogram.green, "Green")}

${formatDistribution(histogram.blue, "Blue")}

PROCESSING RECOMMENDATIONS BASED ON HISTOGRAM:
${generateProcessingRecommendations(analysis)}
`;
}

/**
 * Get brightness-related recommendations
 */
function getBrightnessRecommendations(
  brightness: "dark" | "normal" | "bright",
): string[] {
  const recommendations: string[] = [];

  if (brightness === "dark") {
    recommendations.push(
      "- Consider increasing exposure compensation (+0.3 to +1.0)",
      "- Lift shadows to reveal detail in dark areas",
    );
  } else if (brightness === "bright") {
    recommendations.push(
      "- Consider decreasing exposure compensation (-0.3 to -1.0)",
      "- Recover highlights to prevent clipping",
    );
  }

  return recommendations;
}

/**
 * Get contrast-related recommendations
 */
function getContrastRecommendations(
  contrast: "low" | "normal" | "high",
): string[] {
  const recommendations: string[] = [];

  if (contrast === "low") {
    recommendations.push(
      "- Increase contrast to add punch to the image",
      "- Consider using local contrast enhancement",
    );
  } else if (contrast === "high") {
    recommendations.push(
      "- Reduce contrast to prevent harsh transitions",
      "- Use shadow/highlight recovery to balance tones",
    );
  }

  return recommendations;
}

/**
 * Get color cast-related recommendations
 */
function getColorCastRecommendations(colorCast: string): string[] {
  const recommendations: string[] = [];

  if (colorCast === "neutral") {
    return recommendations;
  }

  if (colorCast.includes("warm") || colorCast.includes("red")) {
    recommendations.push(
      "- Adjust white balance: decrease temperature or increase green tint",
    );
  } else if (colorCast.includes("cool") || colorCast.includes("blue")) {
    recommendations.push(
      "- Adjust white balance: increase temperature or decrease green tint",
    );
  } else if (colorCast.includes("green")) {
    recommendations.push(
      "- Adjust white balance: decrease green tint (move toward magenta)",
    );
  } else if (colorCast.includes("magenta")) {
    recommendations.push("- Adjust white balance: increase green tint");
  }

  return recommendations;
}

/**
 * Get exposure issue-related recommendations
 */
function getExposureIssueRecommendations(issue: string): string[] {
  const recommendations: string[] = [];

  if (issue.includes("highlight clipping")) {
    recommendations.push(
      "- Reduce exposure or use highlight recovery to restore clipped highlights",
    );
  }
  if (issue.includes("shadow clipping")) {
    recommendations.push(
      "- Increase exposure or lift shadows to restore blocked shadows",
    );
  }
  if (issue.includes("underexposure")) {
    recommendations.push(
      "- Increase overall exposure and consider shadow lifting",
    );
  }
  if (issue.includes("overexposure")) {
    recommendations.push(
      "- Decrease overall exposure and use highlight recovery",
    );
  }

  return recommendations;
}

/**
 * Get dynamic range-related recommendations
 */
function getDynamicRangeRecommendations(
  red: HistogramStats,
  green: HistogramStats,
  blue: HistogramStats,
): string[] {
  const avgDynamicRange =
    (red.dynamicRange + green.dynamicRange + blue.dynamicRange) / 3;

  if (avgDynamicRange < 200) {
    return [
      "- Limited dynamic range detected - consider increasing contrast carefully",
    ];
  }

  return [];
}

/**
 * Generate processing recommendations based on histogram analysis
 */
function generateProcessingRecommendations(
  analysis: HistogramAnalysis,
): string {
  // Combine all recommendations
  const recommendations = [
    ...getBrightnessRecommendations(analysis.overall.brightness),
    ...getContrastRecommendations(analysis.overall.contrast),
    ...getColorCastRecommendations(analysis.overall.colorCast),
    // Add exposure issue recommendations
    ...analysis.overall.exposureIssues.flatMap((issue) =>
      getExposureIssueRecommendations(issue),
    ),
    // Add dynamic range recommendations
    ...getDynamicRangeRecommendations(
      analysis.red,
      analysis.green,
      analysis.blue,
    ),
  ];

  // Return the final recommendations or a default message
  return recommendations.length > 0
    ? recommendations.join("\n")
    : "- Image appears well-exposed with good tonal distribution";
}
