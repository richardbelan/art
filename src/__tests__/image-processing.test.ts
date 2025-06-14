// Tests for image processing utilities
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateHistogramFromBuffer,
  analyzeHistogram,
  formatHistogramForLLM,
} from '../utils/image-processing.js';

describe('Image Processing', () => {
  // Skip tests if test image doesn't exist
  const testImagePath = path.join(process.cwd(), 'test-temp', 'test_histogram.jpg');
  const hasTestImage = fs.existsSync(testImagePath);

  it('should calculate histogram from buffer', async () => {
    if (!hasTestImage) {
      console.log('Skipping histogram test - no test image available');
      return;
    }

    const imageBuffer = await fs.promises.readFile(testImagePath);
    const histogram = await calculateHistogramFromBuffer(imageBuffer);

    expect(histogram).toBeDefined();
    expect(histogram.red).toHaveLength(256);
    expect(histogram.green).toHaveLength(256);
    expect(histogram.blue).toHaveLength(256);

    // Check that histogram contains some data
    const totalRed = histogram.red.reduce((sum, count) => sum + count, 0);
    const totalGreen = histogram.green.reduce((sum, count) => sum + count, 0);
    const totalBlue = histogram.blue.reduce((sum, count) => sum + count, 0);

    expect(totalRed).toBeGreaterThan(0);
    expect(totalGreen).toBeGreaterThan(0);
    expect(totalBlue).toBeGreaterThan(0);
  });

  it('should analyze histogram correctly', async () => {
    if (!hasTestImage) {
      console.log('Skipping histogram analysis test - no test image available');
      return;
    }

    const imageBuffer = await fs.promises.readFile(testImagePath);
    const histogram = await calculateHistogramFromBuffer(imageBuffer);
    const analysis = analyzeHistogram(histogram);

    expect(analysis).toBeDefined();
    expect(analysis.red).toBeDefined();
    expect(analysis.green).toBeDefined();
    expect(analysis.blue).toBeDefined();
    expect(analysis.overall).toBeDefined();

    expect(analysis.overall.brightness).toMatch(/^(dark|normal|bright)$/);
    expect(analysis.overall.contrast).toMatch(/^(low|normal|high)$/);
    expect(typeof analysis.overall.colorCast).toBe('string');
    expect(Array.isArray(analysis.overall.exposureIssues)).toBe(true);

    // Check statistical measures
    expect(typeof analysis.red.mean).toBe('number');
    expect(typeof analysis.red.median).toBe('number');
    expect(typeof analysis.red.mode).toBe('number');
    expect(typeof analysis.red.standardDeviation).toBe('number');
    expect(typeof analysis.red.skewness).toBe('number');
    expect(typeof analysis.red.peakCount).toBe('number');
    expect(typeof analysis.red.dynamicRange).toBe('number');

    expect(analysis.red.mean).toBeGreaterThanOrEqual(0);
    expect(analysis.red.mean).toBeLessThanOrEqual(255);
    expect(analysis.red.median).toBeGreaterThanOrEqual(0);
    expect(analysis.red.median).toBeLessThanOrEqual(255);
  });

  it('should format histogram for LLM correctly', async () => {
    if (!hasTestImage) {
      console.log('Skipping histogram formatting test - no test image available');
      return;
    }

    const imageBuffer = await fs.promises.readFile(testImagePath);
    const histogram = await calculateHistogramFromBuffer(imageBuffer);
    const analysis = analyzeHistogram(histogram);
    const formatted = formatHistogramForLLM(histogram, analysis);

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);

    // Check that key sections are present
    expect(formatted).toContain('IMAGE HISTOGRAM ANALYSIS');
    expect(formatted).toContain('OVERALL ASSESSMENT');
    expect(formatted).toContain('DETAILED STATISTICS');
    expect(formatted).toContain('TONAL DISTRIBUTION');
    expect(formatted).toContain('PROCESSING RECOMMENDATIONS');

    // Check that channel information is present
    expect(formatted).toContain('Red Channel');
    expect(formatted).toContain('Green Channel');
    expect(formatted).toContain('Blue Channel');

    // Check that statistical measures are included
    expect(formatted).toContain('Mean:');
    expect(formatted).toContain('Median:');
    expect(formatted).toContain('Standard Deviation:');
  });

  it('should handle errors gracefully', async () => {
    // Test with invalid buffer
    const invalidBuffer = Buffer.from('not an image');
    
    await expect(calculateHistogramFromBuffer(invalidBuffer)).rejects.toThrow();
  });
});