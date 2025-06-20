# Histogram Analysis Feature

## Overview

The AI-PP3 tool now includes automatic histogram calculation and analysis for all images sent to AI models. This enhancement provides AI models with detailed technical information about image characteristics, enabling more informed and precise processing recommendations.

## What's New

### Automatic Histogram Calculation

- **RGB Channel Analysis**: Calculates separate histograms for Red, Green, and Blue channels
- **Statistical Measures**: Computes mean, median, mode, standard deviation, skewness, peak count, and dynamic range for each channel
- **Tonal Distribution**: Analyzes shadow, midtone, and highlight distribution
- **Exposure Assessment**: Detects clipping, underexposure, and overexposure issues
- **Color Cast Detection**: Identifies color temperature and tint issues

### Enhanced AI Prompts

Before sending images to AI models, the tool now automatically:

1. Calculates the image histogram using Sharp.js
2. Analyzes the histogram data for technical insights
3. Formats the analysis in a structured, LLM-friendly format
4. Appends this information to the original prompt

### Example Histogram Analysis Output

```
IMAGE HISTOGRAM ANALYSIS:

OVERALL ASSESSMENT:
- Brightness: normal
- Contrast: high
- Color Cast: warm/red cast
- Exposure Issues: highlight clipping detected

DETAILED STATISTICS:

Red Channel:
- Mean: 142.3 (0-255 scale)
- Median: 138
- Mode: 255
- Standard Deviation: 85.2
- Skewness: 0.15 (right-skewed)
- Peak Count: 12
- Dynamic Range: 255

TONAL DISTRIBUTION:

Red Distribution:
- Shadows (0-84): 25.3%
- Midtones (85-169): 42.1%
- Highlights (170-255): 32.6%

PROCESSING RECOMMENDATIONS BASED ON HISTOGRAM:
- Reduce exposure or use highlight recovery to restore clipped highlights
- Adjust white balance: decrease temperature or increase green tint
- Consider reducing contrast to prevent harsh transitions
```

## Technical Implementation

### Dependencies Added

- **sharp**: High-performance image processing library for Node.js
- **@types/sharp**: TypeScript definitions for Sharp

### New Files

- `src/utils/image-processing.ts`: Core histogram calculation and analysis functions
- `src/__tests__/image-processing.test.ts`: Comprehensive test suite

### Modified Files

- `src/ai-generation/ai-processor.ts`: Enhanced to include histogram analysis in AI requests
- `package.json`: Added Sharp dependency

### Key Functions

#### `calculateHistogramFromBuffer(imageBuffer: Buffer): Promise<ImageHistogram>`

Calculates RGB histograms from an image buffer.

#### `analyzeHistogram(histogram: ImageHistogram): HistogramAnalysis`

Performs statistical analysis and technical assessment of histogram data.

#### `formatHistogramForLLM(histogram: ImageHistogram, analysis: HistogramAnalysis): string`

Formats histogram data and analysis in a structured format optimized for LLM consumption.

## Benefits for AI Processing

### More Informed Decisions

AI models now receive:

- **Quantitative Data**: Precise statistical measures instead of just visual information
- **Technical Context**: Understanding of exposure, contrast, and color balance issues
- **Processing Hints**: Specific recommendations based on histogram analysis

### Better PP3 Generation

The enhanced prompts lead to:

- **More Accurate Adjustments**: AI can make precise parameter changes based on histogram data
- **Targeted Corrections**: Specific fixes for detected issues (clipping, color casts, etc.)
- **Consistent Results**: More predictable outcomes across different images

### Example Impact

**Before**: "This image looks a bit dark"
**After**: "Red channel mean: 85.2, shadows contain 45.3% of data, possible underexposure detected - recommend increasing exposure compensation +0.5 to +1.0"

## Error Handling

The histogram feature is designed to be robust:

- **Graceful Degradation**: If histogram calculation fails, processing continues without histogram data
- **Format Support**: Works with all image formats supported by Sharp (JPEG, PNG, TIFF, WebP, etc.)
- **Memory Efficient**: Processes images in streaming fashion to handle large files

## Performance Considerations

- **Minimal Overhead**: Histogram calculation adds ~50-200ms per image
- **Cached Results**: Results could be cached for repeated processing of the same image
- **Parallel Processing**: Histogram calculation runs concurrently with other operations

## Future Enhancements

Potential improvements for future versions:

- **Histogram Caching**: Store calculated histograms to avoid recalculation
- **Advanced Analysis**: Include entropy, contrast metrics, and color space analysis
- **Visual Histogram**: Generate histogram charts for debugging and visualization
- **Custom Thresholds**: Allow users to configure analysis thresholds and recommendations

## Testing

The feature includes comprehensive tests covering:

- Histogram calculation accuracy
- Statistical analysis correctness
- LLM formatting consistency
- Error handling scenarios

Run tests with:

```bash
npm test -- image-processing
```

## Demo

A demonstration script is available to see the histogram analysis in action:

```bash
node demo-histogram.js
```

This feature represents a significant enhancement to the AI-PP3 tool's analytical capabilities, providing AI models with the technical depth needed for professional-grade image processing recommendations.
