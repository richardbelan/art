// Individual section parameter ranges
const EXPOSURE_RANGES = `
[Exposure]
- Clip: 0.00 to 0.99 (defines percentage of pixels allowed to clip to histogram extremes - higher values increase contrast). As of RawTherapee 5.5, thumbnails use a fixed 0.2% value for caching efficiency.
- Compensation: -5.0 to 5.0 (ISO-based exposure adjustment where +1 equals one stop overexposure/+1 EV. Adjusts black and white points by shifting histogram. Positive values often needed as cameras underexpose to preserve highlights. Technical note: At EV=0, base gain is applied based on white balance to prevent highlight clipping from raw data).
- Brightness: -100 to 100 (overall brightness)
- HighlightCompr: 0 to 100 (highlight compression - recovers highlights by compressing clipped areas; works best when used with Highlight Reconstruction; color propagation method works best for values > 100; watch histogram to avoid over-compression that turns whites gray)
- HighlightComprThreshold: 0 to 100 (sets point where highlight compression starts; 0 means compression occurs over whole range; 100 sets threshold at one stop below white point)
- ShadowCompr: 0 to 100 (shadow compression - dampens the effect of the Black slider; maximum value of 100 gives a less dark image; only has effect when the Black slider is set to a value other than 0)
- Black: -16384 to 16384 (black point adjustment - positive values darken image, negative values lighten shadows)
- Contrast: -100 to 100 (increases or reduces contrast by applying a contrast curve centered at the average luminance level; tonalities above average are lifted/lowered while those below are lowered/lifted; same curve applied separately to each R, G and B channel)
- Saturation: -100 to 100 (adjusts image saturation by applying a multiplier to pixel saturation levels in HSV color space)
`;

const WHITE_BALANCE_RANGES = `
[White Balance]
- Setting: Camera | Auto (RGB grey) | Auto (Temperature correlation) | Custom | Daylight | Cloudy | Shade | Underwater | Tungsten | Fluorescent | Lamp | LED | Flash
- Temperature: 1500 to 25000 (color temperature in Kelvin; lower values = cooler/bluer, higher = warmer/yellower)
- Green: 0.2 to 2.5 (green-magenta tint; <1 = more magenta, >1 = more green)
`;

const SHARPENING_RANGES = `
[Sharpening]
- Method: usm | rl_deconvolution (unsharp mask or Richardson-Lucy deconvolution)
- Contrast: 0 to 200 (sharpening contrast - higher values increase local contrast)
- Radius: 0.3 to 3.0 (unsharp mask radius - controls size of details being amplified)
- BlurRadius: 0.1 to 2.0 (blur radius for edge masking)
- Amount: 0 to 500 (sharpening strength - 0-100 for subtle, 100-300 for moderate, 300+ for strong)
- Threshold: 0;0;1000;1000 (curve for tonal range targeting - format: shadow point; highlight point; shadow threshold; highlight threshold)
- OnlyEdges: true | false (when true, only sharpens edges)
- EdgeDetectionRadius: 0.5 to 3.0 (radius for edge detection when OnlyEdges is true)
- EdgeTolerance: 100 to 3000 (tolerance for edge detection - lower values detect more edges)
- HaloControlEnabled: true | false (enables halo reduction)
- HaloControlAmount: 0 to 100 (strength of halo reduction)
- DeconvRadius: 0.4 to 2.0 (RL deconvolution radius - matches lens blur characteristics)
- DeconvAmount: 0 to 300 (RL deconvolution strength)
- DeconvDamping: 0 to 100 (RL damping - reduces effect on finest details)
- DeconvIterations: 1 to 50 (RL iterations - more iterations increase sharpening but may introduce artifacts)
`;

const VIBRANCE_RANGES = `
[Vibrance]
- Pastels: -100 to 100 (adjusts saturation of pastel/desaturated tones)
- Saturated: -100 to 100 (adjusts saturation of already saturated tones)
- AvoidColorShift: true | false (when true, prevents hue shifting during adjustments)
`;

const DEHAZE_RANGES = `
[Dehaze]
- Strength: 0 to 100 (haze removal intensity - 0=no effect, 100=full effect)
- Saturation: 0 to 200 (color saturation in dehazed areas)
- Depth: 0 to 100 (depth of effect)
`;

const SHADOWS_HIGHLIGHTS_RANGES = `
[Shadows & Highlights]
- Highlights: -100 to 100 (darkens bright areas - positive values reduce highlights)
- Shadows: -100 to 100 (brightens dark areas - positive values lift shadows)
- HighlightTonalWidth: 0 to 100 (controls range of tones affected by Highlights slider - higher values affect more tones)
- ShadowTonalWidth: 0 to 100 (controls range of tones affected by Shadows slider - higher values affect more tones)
- Radius: 0 to 100 (controls the size of the area used for local adjustments - higher values affect larger areas)
`;

const RETINEX_RANGES = `
[Retinex]
- Str: 0 to 100 (overall strength of Retinex effect - higher values increase the effect)
- Scal: 1 to 5 (scale factor for Retinex processing - higher values process larger areas)
- Iter: 1 to 5 (number of iterations - more iterations increase effect but may cause artifacts)
- Grad: 0 to 5 (gradient type - controls how the effect is applied across the image)
- Grads: 0 to 2 (gradient strength - controls intensity of gradient application)
- Gam: 0.1 to 3.0 (gamma correction for Retinex processing)
- Slope: 1 to 10 (slope of the curve applied to the effect)
- Neigh: 10 to 200 (neighborhood size - larger values affect larger areas)
- Offs: -100 to 100 (offset for the effect - positive values brighten, negative darken)
- Vart: 0 to 500 (variance threshold - controls local contrast enhancement)
- Limd: 1 to 20 (limit for the difference - controls edge preservation)
- highl: 0 to 10 (highlight compression - reduces effect on bright areas)
- skal: 1 to 5 (scale for the effect - controls size of details affected)
- complexMethod: normal | exppo | unbound (method for complex processing)
- RetinexMethod: low | uniform | high | highlight (method for Retinex processing)
- Retinexcolorspace: Lab | hsl (color space for Retinex processing)
- Gammaretinex: none | low | middle | high | free (gamma correction profile)
- Highlights: -100 to 100 (highlight adjustment in Retinex processing)
- Shadows: -100 to 100 (shadow adjustment in Retinex processing)
- Radius: 0 to 100 (radius for local adjustments in Retinex)
`;

const WAVELET_RANGES = `
[Wavelet]
- Enabled: true | false (enable/disable wavelet processing)
- Strength: 0 to 100 (overall strength of wavelet effect)
- Contrast: 0 to 200 (contrast enhancement in wavelet processing)
- Chroma: 0 to 100 (chroma adjustment in wavelet processing)
- Edgedetection: 0 to 100 (edge detection threshold)
- Edgeamplification: 0 to 100 (edge amplification strength)
- Gamma: 0.1 to 3.0 (gamma correction for wavelet processing)
- Skinprotect: 0 to 100 (skin protection - reduces effect on skin tones)
- Hue: -180 to 180 (hue adjustment in wavelet processing)
- Saturation: -100 to 100 (saturation adjustment in wavelet processing)
- Residual: -100 to 100 (residual image adjustment)
- Residualcont: -100 to 100 (residual contrast adjustment)
- Residbala: 0 to 100 (residual balance between details and base)
- Residchro: 0 to 100 (residual chroma adjustment)
- Residsha: 0 to 100 (residual sharpening)
- Residhi: 0 to 100 (residual highlight adjustment)
- Residhish: 0 to 100 (residual highlight shadow balance)
- Tmpreduct: 0 to 100 (temporal noise reduction)
- Tilesize: 0 to 100 (tile size for processing - affects performance and memory usage)
`;

const LOCAL_CONTRAST_RANGES = `
[Local Contrast]
- Radius: 0 to 100 (extent of local contrast - higher values affect larger areas with smoother transitions)
- Amount: 0.0 to 2.0 (overall strength - amplifies differences between original and blurred image)
- Darkness: 0.0 to 2.0 (dark areas enhancement - higher values make dark areas darker)
- Lightness: 0.0 to 2.0 (light areas enhancement - higher values make light areas lighter)
`;

// Map of section names to their parameter ranges
const PARAMETER_RANGES_BY_SECTION: Record<string, string> = {
  Exposure: EXPOSURE_RANGES,
  "White Balance": WHITE_BALANCE_RANGES,
  Sharpening: SHARPENING_RANGES,
  Vibrance: VIBRANCE_RANGES,
  Dehaze: DEHAZE_RANGES,
  "Shadows & Highlights": SHADOWS_HIGHLIGHTS_RANGES,
  Retinex: RETINEX_RANGES,
  Wavelet: WAVELET_RANGES,
  "Local Contrast": LOCAL_CONTRAST_RANGES,
};

// For backward compatibility
export const COMMON_PARAMETER_RANGES = Object.values(
  PARAMETER_RANGES_BY_SECTION,
).join("\n");

/**
 * Get parameter ranges for the specified sections
 */
export function getParameterRangesForSections(sections: string[]): string {
  if (sections.length === 0) {
    return "";
  }

  return sections
    .map((section) => PARAMETER_RANGES_BY_SECTION[section] || "")
    .filter(Boolean)
    .join("\n");
}

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

const AGGRESSIVE_PROMPT_TEMPLATE = `You are a RawTherapee processing profile (pp3) optimization MASTER. Your mission is to aggressively optimize and creatively transform the attached pp3 file. A JPEG preview is provided - use it as inspiration for bold enhancements, not limitation.

ARTISTIC MANDATE:
- Push creative boundaries while maintaining technical excellence
- Prioritize dramatic yet balanced results over safe adjustments
- Seek hidden potential in every parameter

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Make bold, creative enhancements")}

Common Parameter Value Ranges:
%%PARAMETER_RANGES%%

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

const BALANCED_PROMPT_TEMPLATE = `You are a RawTherapee processing profile (pp3) optimization SPECIALIST. Your goal is to create a well-balanced, natural-looking image by making thoughtful adjustments to the pp3 file. A JPEG preview is provided for reference.

ARTISTIC MANDATE:
- Aim for a natural, true-to-life appearance
- Maintain a good balance between shadows and highlights
- Enhance details without introducing artifacts
- Preserve the original character of the image

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Make subtle, natural-looking enhancements")}

Common Parameter Value Ranges:
%%PARAMETER_RANGES%%

Output Format:

ANALYSIS:
- Current state and areas for balanced improvement

PLAN:
- Subtle adjustments to enhance the image naturally

EXECUTION:

\`\`\`
[Exposure]
Compensation=0.3
HighlightCompr=20
ShadowCompr=25
\`\`\`

${COMMON_OUTPUT_RULES}
`;

const TECHNICAL_PROMPT_TEMPLATE = `You are a RawTherapee processing profile (pp3) TECHNICAL SPECIALIST. Your focus is on achieving the highest technical quality in the image through precise parameter adjustments. A JPEG preview is provided for reference.

TECHNICAL MANDATE:
- Prioritize technical perfection and accuracy
- Focus on proper exposure, color accuracy, and detail preservation
- Use advanced techniques for noise reduction and sharpening
- Maintain maximum image quality throughout the processing pipeline

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Focus on technical precision and image quality")}

Common Parameter Value Ranges:
%%PARAMETER_RANGES%%

Output Format:

ANALYSIS:
- Technical issues and areas for improvement

PLAN:
- Technical adjustments to optimize image quality

EXECUTION:

\`\`\`
[Sharpening]
Method=rl_deconvolution
Radius=0.8
Amount=200
Damping=20
Iterations=30
\`\`\`

${COMMON_OUTPUT_RULES}
`;

const CREATIVE_PROMPT_TEMPLATE = `You are a RawTherapee processing profile (pp3) optimization ARTIST. Your mission is to creatively transform the attached pp3 file with artistic vision. A JPEG preview is provided - use it as a starting point for your artistic interpretation.

ARTISTIC MANDATE:
- Prioritize artistic expression and unique visual style
- Create a distinctive mood or atmosphere in the image
- Experiment with color relationships and tonal contrasts

${COMMON_KEY_RULES.replace("Make bold, creative enhancements", "Focus on creative color grading and mood enhancement")}

Common Parameter Value Ranges:
%%PARAMETER_RANGES%%
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

// Function to get prompt by preset name with dynamic parameter ranges
export function getPromptByPreset(
  preset = "aggressive",
  sections?: string[],
): string {
  // Get the appropriate template based on preset
  const promptTemplates: Record<string, string> = {
    aggressive: AGGRESSIVE_PROMPT_TEMPLATE,
    balanced: BALANCED_PROMPT_TEMPLATE,
    technical: TECHNICAL_PROMPT_TEMPLATE,
    creative: CREATIVE_PROMPT_TEMPLATE,
  };

  // Get the template or fall back to aggressive
  let prompt = promptTemplates[preset] || AGGRESSIVE_PROMPT_TEMPLATE;

  // If sections are provided, insert the relevant parameter ranges
  if (sections?.length) {
    const parameterRanges = getParameterRangesForSections(sections);
    prompt = prompt.replace("%%PARAMETER_RANGES%%", parameterRanges);
  } else {
    // Fallback to all parameter ranges if no sections specified
    prompt = prompt.replace("%%PARAMETER_RANGES%%", COMMON_PARAMETER_RANGES);
  }

  return prompt;
}

// Map preset names to their respective prompts
export const PROMPTS: Record<string, string> = {
  aggressive: AGGRESSIVE_PROMPT_TEMPLATE,
  balanced: BALANCED_PROMPT_TEMPLATE,
  technical: TECHNICAL_PROMPT_TEMPLATE,
  creative: CREATIVE_PROMPT_TEMPLATE,
};

// For backward compatibility
export const BASE_PROMPT = AGGRESSIVE_PROMPT_TEMPLATE;

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
