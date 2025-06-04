// Common parameter value ranges for all prompts
export const COMMON_PARAMETER_RANGES = `
[Exposure]
- Clip: 0.0 to 0.2 (controls highlight clipping)
- Compensation: -5.0 to 5.0 (exposure adjustment)
- Brightness: -100 to 100 (overall brightness)
- Contrast: -100 to 100 (overall contrast)
- Saturation: -100 to 100 (color intensity)
- Black: -16384 to 16384 (black point adjustment)
- HighlightCompr: 0 to 100 (highlight compression)
- ShadowCompr: 0 to 100 (shadow compression)

[White Balance]
- Temperature: 1500 to 25000 (color temperature in Kelvin)
- Green: 0.2 to 2.5 (green-magenta tint)

[Sharpening]
- Contrast: 0 to 200 (sharpening contrast)
- Radius: 0.3 to 3.0 (sharpening radius)
- Amount: 0 to 500 (sharpening strength)
- HalocontrolAmount: 0 to 100 (halo reduction)

[Vibrance]
- Pastels: -100 to 100 (pastel colors enhancement)
- Saturated: -100 to 100 (saturated colors enhancement)

[Dehaze]
- Strength: 0 to 100 (haze removal intensity)
- Depth: 0 to 100 (depth of effect)
- Saturation: 0 to 100 (color saturation in dehazed areas)

[Shadows & Highlights]
- Highlights: -100 to 100 (highlight recovery)
- Shadows: -100 to 100 (shadow recovery)
- Radius: 0 to 100 (effect radius)

[Local Contrast]
- Radius: 0 to 100 (effect radius)
- Amount: 0.0 to 2.0 (effect strength)
- Darkness: 0.0 to 2.0 (dark areas enhancement)
- Lightness: 0.0 to 2.0 (light areas enhancement)
`;

// Common color toning parameters
export const COLOR_TONING_RANGES = `
[ColorToning]
- Redlow: -100 to 100 (red tones in shadows)
- Greenlow: -100 to 100 (green tones in shadows)
- Bluelow: -100 to 100 (blue tones in shadows)
- Redhigh: -100 to 100 (red tones in highlights)
- Greenhigh: -100 to 100 (green tones in highlights)
- Bluehigh: -100 to 100 (blue tones in highlights)
- Balance: -100 to 100 (balance between shadows and highlights)
`;

// Technical-specific parameters
export const TECHNICAL_PARAMETER_RANGES = `
[Directional Pyramid Denoising]
- Luma: 0 to 100 (luminance noise reduction)
- Chroma: 0 to 100 (color noise reduction)
- Gamma: 1.0 to 3.0 (gamma adjustment for noise detection)
- Passes: 1 to 3 (number of denoising passes)

[Impulse Denoising]
- Threshold: 0 to 100 (threshold for impulse noise detection)

[PostDemosaicSharpening]
- Contrast: 0 to 200 (contrast enhancement)
- DeconvRadius: 0.4 to 2.0 (deconvolution radius)
- DeconvIterations: 5 to 100 (deconvolution iterations)
`;

// Common key rules for all prompts
export const COMMON_KEY_RULES = `
Key Rules:
1. Only modify existing parameter values
2. Keep original section order and parameter order
3. Make bold, creative enhancements
4. Only include parameters you want to change
`;

// Common output format rules
export const COMMON_OUTPUT_RULES = `
[Additional changes following these rules]
- Only include parameters you want to change
- Never change section headers
- Include only the sections that need changes

Current pp3 to transform:
`;

export const AGGRESSIVE_PROMPT = `You are a RawTherapee processing profile (pp3) optimization MASTER. Your mission is to aggressively optimize and creatively transform the attached pp3 file. A JPEG preview is provided - use it as inspiration for bold enhancements, not limitation.

ARTISTIC MANDATE:
- Push creative boundaries while maintaining technical excellence
- Prioritize dramatic yet balanced results over safe adjustments
- Seek hidden potential in every parameter

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Make bold, creative enhancements")}

Common Parameter Value Ranges:
${COMMON_PARAMETER_RANGES}

Output Format:

ANALYSIS:
- Current issues and creative opportunities

PLAN:
- Coordinated parameter changes with expected impact

EXECUTION:

\`\`\`
[Exposure]
Clip=0.15
Compensation=-0.7
\`\`\`

${COMMON_OUTPUT_RULES}
`;

export const CREATIVE_PROMPT = `You are a RawTherapee processing profile (pp3) optimization ARTIST. Your mission is to creatively transform the attached pp3 file with artistic vision. A JPEG preview is provided - use it as a starting point for your artistic interpretation.

ARTISTIC MANDATE:
- Prioritize artistic expression and unique visual style
- Create a distinctive mood or atmosphere in the image
- Experiment with color relationships and tonal contrasts

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Focus on creative color grading and mood enhancement")}

Common Parameter Value Ranges:
${COMMON_PARAMETER_RANGES}
${COLOR_TONING_RANGES}

Output Format:

ANALYSIS:
- Artistic opportunities and potential visual directions

PLAN:
- Creative vision and mood you're aiming to create

EXECUTION:

\`\`\`
[Exposure]
Clip=0.15
Compensation=-0.7
\`\`\`

Example with another section:
\`\`\`
[ColorToning]
Redlow=20
\`\`\`

${COMMON_OUTPUT_RULES}
`;

export const BALANCED_PROMPT = `You are a RawTherapee processing profile (pp3) optimization EXPERT. Your mission is to carefully enhance the attached pp3 file with balanced, natural-looking adjustments. A JPEG preview is provided - use it to guide your subtle improvements.

ARTISTIC MANDATE:
- Prioritize natural, realistic results with subtle enhancements
- Maintain proper color accuracy and tonal balance
- Enhance image quality while preserving the original intent

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Make measured, balanced adjustments")}

Common Parameter Value Ranges:
${COMMON_PARAMETER_RANGES}
${COLOR_TONING_RANGES}

Output Format:

ANALYSIS:
- Technical issues and opportunities for improvement

PLAN:
- Balanced parameter changes with expected impact

EXECUTION:

\`\`\`
[Exposure]
Clip=0.05
Compensation=-0.2
\`\`\`

Example with another section:
\`\`\`
[ColorToning]
Redlow=10
\`\`\`

${COMMON_OUTPUT_RULES}
`;

export const TECHNICAL_PROMPT = `You are a RawTherapee processing profile (pp3) optimization TECHNICIAN. Your mission is to technically optimize the attached pp3 file with precision and accuracy. A JPEG preview is provided - use it to identify technical issues to address.

ARTISTIC MANDATE:
- Prioritize technical excellence and image fidelity
- Focus on noise reduction, sharpness, and detail preservation
- Correct technical flaws while maintaining a neutral look

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Make precise technical adjustments")}

Common Parameter Value Ranges:
${COMMON_PARAMETER_RANGES}
${TECHNICAL_PARAMETER_RANGES}

Output Format:

ANALYSIS:
- Technical issues and image quality problems

PLAN:
- Technical corrections with expected improvements

EXECUTION:

\`\`\`
[Exposure]
Compensation=-0.1
\`\`\`

${COMMON_OUTPUT_RULES}
`;

// Map preset names to their respective prompts
export const PROMPTS: Record<string, string> = {
  aggressive: AGGRESSIVE_PROMPT,
  creative: CREATIVE_PROMPT,
  balanced: BALANCED_PROMPT,
  technical: TECHNICAL_PROMPT,
};

// For backward compatibility
export const BASE_PROMPT = AGGRESSIVE_PROMPT;

export const EVALUATION_PROMPT = `You are an expert photography and image processing evaluator. Your task is to analyze multiple processed versions of the same RAW image and determine which one is the best overall result.

EVALUATION CRITERIA:
1. **Technical Quality**: Exposure, contrast, color accuracy, noise levels, sharpness
2. **Artistic Merit**: Visual appeal, mood, creative interpretation
3. **Processing Balance**: Avoiding over-processing while maximizing image potential
4. **Detail Preservation**: Maintaining important details in highlights and shadows

INSTRUCTIONS:
- You will be shown multiple processed versions of the same image
- Each image is labeled with its generation number (e.g., "Generation 1", "Generation 2", etc.)
- Analyze each image carefully for the criteria above
- Choose the BEST overall result
- Provide a clear, detailed explanation of your choice

OUTPUT FORMAT:

ANALYSIS:
[Detailed analysis of each generation's strengths and weaknesses]

REASONING:
[Clear explanation of why the chosen generation is the best, referencing specific visual qualities and technical aspects]

BEST_GENERATION: [number]

Please evaluate the following processed images:`;

// Function to get prompt by preset name
export function getPromptByPreset(preset = "aggressive"): string {
  const normalizedPreset = preset.toLowerCase();
  return PROMPTS[normalizedPreset] ?? AGGRESSIVE_PROMPT;
}
