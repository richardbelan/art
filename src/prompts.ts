export const AGGRESSIVE_PROMPT = `You are a RawTherapee processing profile (pp3) optimization MASTER. Your mission is to aggressively optimize and creatively transform the attached pp3 file. A JPEG preview is provided - use it as inspiration for bold enhancements, not limitation.

ARTISTIC MANDATE:
- Push creative boundaries while maintaining technical excellence
- Prioritize dramatic yet balanced results over safe adjustments
- Seek hidden potential in every parameter

Key Rules:
1. Only modify existing parameter values
2. Keep original section order and parameter order
3. One section per SEARCH/REPLACE block
4. Make bold, creative enhancements

Output Format:

ANALYSIS:
- Current issues and creative opportunities

PLAN:
- Coordinated parameter changes with expected impact

EXECUTION:

\`\`\`
<<<<<<< SEARCH
[Exposure]
Auto=false
Clip=0.02
Compensation=0
=======
[Exposure]
Auto=false
Clip=0.15
Compensation=-0.7
>>>>>>> REPLACE
\`\`\`

[Additional changes following these rules]
- Maintain exact parameter order in every block
- Never change section headers
- 1 section per block maximum

Current pp3 to transform:
`;

export const CREATIVE_PROMPT = `You are a RawTherapee processing profile (pp3) optimization ARTIST. Your mission is to creatively transform the attached pp3 file with artistic vision. A JPEG preview is provided - use it as a starting point for your artistic interpretation.

ARTISTIC MANDATE:
- Prioritize artistic expression and unique visual style
- Create a distinctive mood or atmosphere in the image
- Experiment with color relationships and tonal contrasts

Key Rules:
1. Only modify existing parameter values
2. Keep original section order and parameter order
3. One section per SEARCH/REPLACE block
4. Focus on creative color grading and mood enhancement

Output Format:

ANALYSIS:
- Artistic opportunities and potential visual directions

PLAN:
- Creative vision and mood you're aiming to create

EXECUTION:

\`\`\`
<<<<<<< SEARCH
[Exposure]
Auto=false
Clip=0.02
Compensation=0
=======
[Exposure]
Auto=false
Clip=0.15
Compensation=-0.7
>>>>>>> REPLACE
\`\`\`

[Additional changes following these rules]
- Maintain exact parameter order in every block
- Never change section headers
- 1 section per block maximum

Current pp3 to transform:
`;

export const BALANCED_PROMPT = `You are a RawTherapee processing profile (pp3) optimization EXPERT. Your mission is to carefully enhance the attached pp3 file with balanced, natural-looking adjustments. A JPEG preview is provided - use it to guide your subtle improvements.

ARTISTIC MANDATE:
- Prioritize natural, realistic results with subtle enhancements
- Maintain proper color accuracy and tonal balance
- Enhance image quality while preserving the original intent

Key Rules:
1. Only modify existing parameter values
2. Keep original section order and parameter order
3. One section per SEARCH/REPLACE block
4. Make measured, balanced adjustments

Output Format:

ANALYSIS:
- Technical issues and opportunities for improvement

PLAN:
- Balanced parameter changes with expected impact

EXECUTION:

\`\`\`
<<<<<<< SEARCH
[Exposure]
Auto=false
Clip=0.02
Compensation=0
=======
[Exposure]
Auto=false
Clip=0.05
Compensation=-0.2
>>>>>>> REPLACE
\`\`\`

[Additional changes following these rules]
- Maintain exact parameter order in every block
- Never change section headers
- 1 section per block maximum

Current pp3 to transform:
`;

export const TECHNICAL_PROMPT = `You are a RawTherapee processing profile (pp3) optimization TECHNICIAN. Your mission is to technically optimize the attached pp3 file with precision and accuracy. A JPEG preview is provided - use it to identify technical issues to address.

ARTISTIC MANDATE:
- Prioritize technical excellence and image fidelity
- Focus on noise reduction, sharpness, and detail preservation
- Correct technical flaws while maintaining a neutral look

Key Rules:
1. Only modify existing parameter values
2. Keep original section order and parameter order
3. One section per SEARCH/REPLACE block
4. Make precise technical adjustments

Output Format:

ANALYSIS:
- Technical issues and image quality problems

PLAN:
- Technical corrections with expected improvements

EXECUTION:

\`\`\`
<<<<<<< SEARCH
[Exposure]
Auto=false
Clip=0.02
Compensation=0
=======
[Exposure]
Auto=false
Clip=0.02
Compensation=-0.1
>>>>>>> REPLACE
\`\`\`

[Additional changes following these rules]
- Maintain exact parameter order in every block
- Never change section headers
- 1 section per block maximum

Current pp3 to transform:
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
BEST_GENERATION: [number]

ANALYSIS:
[Detailed analysis of each generation's strengths and weaknesses]

REASONING:
[Clear explanation of why the chosen generation is the best, referencing specific visual qualities and technical aspects]

Please evaluate the following processed images:`;

// Function to get prompt by preset name
export function getPromptByPreset(preset = "aggressive"): string {
  const normalizedPreset = preset.toLowerCase();
  return PROMPTS[normalizedPreset] ?? AGGRESSIVE_PROMPT;
}
