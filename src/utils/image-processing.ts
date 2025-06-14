// Image processing utilities for histogram calculation and analysis
import sharp from 'sharp';

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
    brightness: 'dark' | 'normal' | 'bright';
    contrast: 'low' | 'normal' | 'high';
    colorCast: string;
    exposureIssues: string[];
  };
}

/**
 * Calculate histogram for an image
 */
export async function calculateHistogram(imagePath: string): Promise<ImageHistogram> {
  try {
    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Initialize histogram arrays
    const histogramR = new Array(256).fill(0);
    const histogramG = new Array(256).fill(0);
    const histogramB = new Array(256).fill(0);

    // Calculate histogram
    for (let i = 0; i < data.length; i += info.channels) {
      histogramR[data[i]]++;
      if (info.channels > 1) histogramG[data[i + 1]]++;
      if (info.channels > 2) histogramB[data[i + 2]]++;
    }

    return {
      red: histogramR,
      green: histogramG,
      blue: histogramB,
    };
  } catch (error) {
    throw new Error(`Error calculating histogram: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate histogram for image buffer
 */
export async function calculateHistogramFromBuffer(imageBuffer: Buffer): Promise<ImageHistogram> {
  try {
    const image = sharp(imageBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Initialize histogram arrays
    const histogramR = new Array(256).fill(0);
    const histogramG = new Array(256).fill(0);
    const histogramB = new Array(256).fill(0);

    // Calculate histogram
    for (let i = 0; i < data.length; i += info.channels) {
      histogramR[data[i]]++;
      if (info.channels > 1) histogramG[data[i + 1]]++;
      if (info.channels > 2) histogramB[data[i + 2]]++;
    }

    return {
      red: histogramR,
      green: histogramG,
      blue: histogramB,
    };
  } catch (error) {
    throw new Error(`Error calculating histogram from buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate statistical measures for a histogram channel
 */
function calculateChannelStats(histogram: number[]): HistogramStats {
  const totalPixels = histogram.reduce((sum, count) => sum + count, 0);
  
  // Mean
  let mean = 0;
  for (let i = 0; i < histogram.length; i++) {
    mean += i * histogram[i];
  }
  mean /= totalPixels;

  // Median
  let cumulativeCount = 0;
  let median = 0;
  for (let i = 0; i < histogram.length; i++) {
    cumulativeCount += histogram[i];
    if (cumulativeCount >= totalPixels / 2) {
      median = i;
      break;
    }
  }

  // Mode (most frequent value)
  let mode = 0;
  let maxCount = 0;
  for (let i = 0; i < histogram.length; i++) {
    if (histogram[i] > maxCount) {
      maxCount = histogram[i];
      mode = i;
    }
  }

  // Standard deviation
  let variance = 0;
  for (let i = 0; i < histogram.length; i++) {
    variance += histogram[i] * Math.pow(i - mean, 2);
  }
  variance /= totalPixels;
  const standardDeviation = Math.sqrt(variance);

  // Skewness
  let skewness = 0;
  for (let i = 0; i < histogram.length; i++) {
    skewness += histogram[i] * Math.pow((i - mean) / standardDeviation, 3);
  }
  skewness /= totalPixels;

  // Peak count (number of local maxima)
  let peakCount = 0;
  for (let i = 1; i < histogram.length - 1; i++) {
    if (histogram[i] > histogram[i - 1] && histogram[i] > histogram[i + 1] && histogram[i] > totalPixels * 0.001) {
      peakCount++;
    }
  }

  // Dynamic range (difference between highest and lowest non-zero values)
  let minValue = 0;
  let maxValue = 255;
  for (let i = 0; i < histogram.length; i++) {
    if (histogram[i] > 0) {
      minValue = i;
      break;
    }
  }
  for (let i = histogram.length - 1; i >= 0; i--) {
    if (histogram[i] > 0) {
      maxValue = i;
      break;
    }
  }
  const dynamicRange = maxValue - minValue;

  return {
    mean,
    median,
    mode,
    standardDeviation,
    skewness,
    peakCount,
    dynamicRange,
  };
}

/**
 * Analyze histogram to provide insights about the image
 */
export function analyzeHistogram(histogram: ImageHistogram): HistogramAnalysis {
  const redStats = calculateChannelStats(histogram.red);
  const greenStats = calculateChannelStats(histogram.green);
  const blueStats = calculateChannelStats(histogram.blue);

  // Overall brightness assessment
  const avgMean = (redStats.mean + greenStats.mean + blueStats.mean) / 3;
  let brightness: 'dark' | 'normal' | 'bright';
  if (avgMean < 85) brightness = 'dark';
  else if (avgMean > 170) brightness = 'bright';
  else brightness = 'normal';

  // Contrast assessment
  const avgStdDev = (redStats.standardDeviation + greenStats.standardDeviation + blueStats.standardDeviation) / 3;
  let contrast: 'low' | 'normal' | 'high';
  if (avgStdDev < 40) contrast = 'low';
  else if (avgStdDev > 80) contrast = 'high';
  else contrast = 'normal';

  // Color cast detection
  const redMean = redStats.mean;
  const greenMean = greenStats.mean;
  const blueMean = blueStats.mean;
  
  let colorCast = 'neutral';
  const threshold = 10;
  
  if (redMean > greenMean + threshold && redMean > blueMean + threshold) {
    colorCast = 'warm/red cast';
  } else if (blueMean > redMean + threshold && blueMean > greenMean + threshold) {
    colorCast = 'cool/blue cast';
  } else if (greenMean > redMean + threshold && greenMean > blueMean + threshold) {
    colorCast = 'green cast';
  } else if (redMean > blueMean + threshold && greenMean > blueMean + threshold) {
    colorCast = 'yellow cast';
  } else if (blueMean > redMean + threshold && greenMean > redMean + threshold) {
    colorCast = 'cyan cast';
  } else if (redMean > greenMean + threshold && blueMean > greenMean + threshold) {
    colorCast = 'magenta cast';
  }

  // Exposure issues detection
  const exposureIssues: string[] = [];
  
  // Check for clipped highlights (values at 255)
  const totalPixels = histogram.red.reduce((sum, count) => sum + count, 0);
  const highlightClipping = (histogram.red[255] + histogram.green[255] + histogram.blue[255]) / (3 * totalPixels);
  if (highlightClipping > 0.01) { // More than 1% clipped
    exposureIssues.push('highlight clipping detected');
  }

  // Check for blocked shadows (values at 0)
  const shadowClipping = (histogram.red[0] + histogram.green[0] + histogram.blue[0]) / (3 * totalPixels);
  if (shadowClipping > 0.01) { // More than 1% blocked
    exposureIssues.push('shadow clipping detected');
  }

  // Check for underexposure (too much data in shadows)
  const shadowData = histogram.red.slice(0, 64).reduce((sum, count) => sum + count, 0) +
                    histogram.green.slice(0, 64).reduce((sum, count) => sum + count, 0) +
                    histogram.blue.slice(0, 64).reduce((sum, count) => sum + count, 0);
  if (shadowData / (3 * totalPixels) > 0.4) {
    exposureIssues.push('possible underexposure');
  }

  // Check for overexposure (too much data in highlights)
  const highlightData = histogram.red.slice(192, 256).reduce((sum, count) => sum + count, 0) +
                       histogram.green.slice(192, 256).reduce((sum, count) => sum + count, 0) +
                       histogram.blue.slice(192, 256).reduce((sum, count) => sum + count, 0);
  if (highlightData / (3 * totalPixels) > 0.4) {
    exposureIssues.push('possible overexposure');
  }

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
 * Format histogram data for LLM consumption
 */
export function formatHistogramForLLM(histogram: ImageHistogram, analysis: HistogramAnalysis): string {
  const formatStats = (stats: HistogramStats, channel: string) => {
    return `${channel} Channel:
- Mean: ${stats.mean.toFixed(1)} (0-255 scale)
- Median: ${stats.median}
- Mode: ${stats.mode}
- Standard Deviation: ${stats.standardDeviation.toFixed(1)}
- Skewness: ${stats.skewness.toFixed(2)} (${stats.skewness > 0 ? 'right-skewed' : stats.skewness < 0 ? 'left-skewed' : 'symmetric'})
- Peak Count: ${stats.peakCount}
- Dynamic Range: ${stats.dynamicRange}`;
  };

  const formatDistribution = (histogram: number[], channel: string) => {
    const total = histogram.reduce((sum, count) => sum + count, 0);
    const shadows = histogram.slice(0, 85).reduce((sum, count) => sum + count, 0);
    const midtones = histogram.slice(85, 170).reduce((sum, count) => sum + count, 0);
    const highlights = histogram.slice(170, 256).reduce((sum, count) => sum + count, 0);
    
    return `${channel} Distribution:
- Shadows (0-84): ${(shadows / total * 100).toFixed(1)}%
- Midtones (85-169): ${(midtones / total * 100).toFixed(1)}%
- Highlights (170-255): ${(highlights / total * 100).toFixed(1)}%`;
  };

  return `
IMAGE HISTOGRAM ANALYSIS:

OVERALL ASSESSMENT:
- Brightness: ${analysis.overall.brightness}
- Contrast: ${analysis.overall.contrast}
- Color Cast: ${analysis.overall.colorCast}
- Exposure Issues: ${analysis.overall.exposureIssues.length > 0 ? analysis.overall.exposureIssues.join(', ') : 'none detected'}

DETAILED STATISTICS:

${formatStats(analysis.red, 'Red')}

${formatStats(analysis.green, 'Green')}

${formatStats(analysis.blue, 'Blue')}

TONAL DISTRIBUTION:

${formatDistribution(histogram.red, 'Red')}

${formatDistribution(histogram.green, 'Green')}

${formatDistribution(histogram.blue, 'Blue')}

PROCESSING RECOMMENDATIONS BASED ON HISTOGRAM:
${generateProcessingRecommendations(analysis)}
`;
}

/**
 * Generate processing recommendations based on histogram analysis
 */
function generateProcessingRecommendations(analysis: HistogramAnalysis): string {
  const recommendations: string[] = [];

  // Brightness recommendations
  if (analysis.overall.brightness === 'dark') {
    recommendations.push('- Consider increasing exposure compensation (+0.3 to +1.0)');
    recommendations.push('- Lift shadows to reveal detail in dark areas');
  } else if (analysis.overall.brightness === 'bright') {
    recommendations.push('- Consider decreasing exposure compensation (-0.3 to -1.0)');
    recommendations.push('- Recover highlights to prevent clipping');
  }

  // Contrast recommendations
  if (analysis.overall.contrast === 'low') {
    recommendations.push('- Increase contrast to add punch to the image');
    recommendations.push('- Consider using local contrast enhancement');
  } else if (analysis.overall.contrast === 'high') {
    recommendations.push('- Reduce contrast to prevent harsh transitions');
    recommendations.push('- Use shadow/highlight recovery to balance tones');
  }

  // Color cast recommendations
  if (analysis.overall.colorCast !== 'neutral') {
    if (analysis.overall.colorCast.includes('warm') || analysis.overall.colorCast.includes('red')) {
      recommendations.push('- Adjust white balance: decrease temperature or increase green tint');
    } else if (analysis.overall.colorCast.includes('cool') || analysis.overall.colorCast.includes('blue')) {
      recommendations.push('- Adjust white balance: increase temperature or decrease green tint');
    } else if (analysis.overall.colorCast.includes('green')) {
      recommendations.push('- Adjust white balance: decrease green tint (move toward magenta)');
    } else if (analysis.overall.colorCast.includes('magenta')) {
      recommendations.push('- Adjust white balance: increase green tint');
    }
  }

  // Exposure issue recommendations
  analysis.overall.exposureIssues.forEach(issue => {
    if (issue.includes('highlight clipping')) {
      recommendations.push('- Reduce exposure or use highlight recovery to restore clipped highlights');
    }
    if (issue.includes('shadow clipping')) {
      recommendations.push('- Increase exposure or lift shadows to restore blocked shadows');
    }
    if (issue.includes('underexposure')) {
      recommendations.push('- Increase overall exposure and consider shadow lifting');
    }
    if (issue.includes('overexposure')) {
      recommendations.push('- Decrease overall exposure and use highlight recovery');
    }
  });

  // Dynamic range recommendations
  const avgDynamicRange = (analysis.red.dynamicRange + analysis.green.dynamicRange + analysis.blue.dynamicRange) / 3;
  if (avgDynamicRange < 200) {
    recommendations.push('- Limited dynamic range detected - consider increasing contrast carefully');
  }

  return recommendations.length > 0 ? recommendations.join('\n') : '- Image appears well-exposed with good tonal distribution';
}