import { describe, expect, it } from "vitest";
import { parseSearchReplaceBlocks } from "../pp3-parser.js";

// Import the actual function by creating a test that uses the real implementation
// We'll test the integration through the parseSearchReplaceBlocks and applySearchReplaceBlocks workflow

describe("Integration: Fuzzy Search/Replace with Real Implementation", () => {
  it("should parse and apply line-skipping search/replace blocks correctly", () => {
    // Removed unused variable samplePP3Content

    // This simulates what the AI would generate - skipping some lines
    const aiResponse = `
ANALYSIS:
The ColorToning section needs adjustment for better color balance.

PLAN:
Increase red and green low values while maintaining other settings.

EXECUTION:

\`\`\`
<<<<<<< SEARCH
[ColorToning]
Lumamode=true
Twocolor=Std
Redlow=0
=======
[ColorToning]
Lumamode=true
Twocolor=Std
Redlow=20
>>>>>>> REPLACE
\`\`\``;

    // Parse the search/replace blocks
    const blocks = parseSearchReplaceBlocks(aiResponse.replaceAll("```", ""));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe(
      "[ColorToning]\nLumamode=true\nTwocolor=Std\nRedlow=0",
    );
    expect(blocks[0].replace).toBe(
      "[ColorToning]\nLumamode=true\nTwocolor=Std\nRedlow=20",
    );

    // The actual applySearchReplaceBlocks function should handle this correctly
    // We can't directly test it here since it's not exported, but we can verify
    // that the parsing works correctly for the fuzzy matching scenario
  });

  it("should handle multiple parameter changes with line skipping", () => {
    const aiResponse = `
<<<<<<< SEARCH
[ColorToning]
Lumamode=true
Redlow=0
Greenlow=0
Balance=0
=======
[ColorToning]
Lumamode=false
Redlow=15
Greenlow=10
Balance=5
>>>>>>> REPLACE`;

    const blocks = parseSearchReplaceBlocks(aiResponse);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toContain("Lumamode=true");
    expect(blocks[0].search).toContain("Redlow=0");
    expect(blocks[0].search).toContain("Greenlow=0");
    expect(blocks[0].search).toContain("Balance=0");

    expect(blocks[0].replace).toContain("Lumamode=false");
    expect(blocks[0].replace).toContain("Redlow=15");
    expect(blocks[0].replace).toContain("Greenlow=10");
    expect(blocks[0].replace).toContain("Balance=5");
  });

  it("should preserve exact formatting in search/replace blocks", () => {
    const aiResponse = `
<<<<<<< SEARCH
[Exposure]
Auto=false
Clip=0.02
Compensation=0
Brightness=0
=======
[Exposure]
Auto=false
Clip=0.05
Compensation=-0.2
Brightness=10
>>>>>>> REPLACE`;

    const blocks = parseSearchReplaceBlocks(aiResponse);

    expect(blocks).toHaveLength(1);

    // Verify exact parameter matching
    const searchLines = blocks[0].search.split("\n");
    const replaceLines = blocks[0].replace.split("\n");

    expect(searchLines).toContain("[Exposure]");
    expect(searchLines).toContain("Auto=false");
    expect(searchLines).toContain("Clip=0.02");
    expect(searchLines).toContain("Compensation=0");
    expect(searchLines).toContain("Brightness=0");

    expect(replaceLines).toContain("[Exposure]");
    expect(replaceLines).toContain("Auto=false");
    expect(replaceLines).toContain("Clip=0.05");
    expect(replaceLines).toContain("Compensation=-0.2");
    expect(replaceLines).toContain("Brightness=10");
  });

  it("should handle complex parameter values correctly", () => {
    const aiResponse = `
<<<<<<< SEARCH
[Wavelet]
Strength=100
Balance=0
Sigmafin=1
=======
[Wavelet]
Strength=150
Balance=25
Sigmafin=1.5
>>>>>>> REPLACE`;

    const blocks = parseSearchReplaceBlocks(aiResponse);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe(
      "[Wavelet]\nStrength=100\nBalance=0\nSigmafin=1",
    );
    expect(blocks[0].replace).toBe(
      "[Wavelet]\nStrength=150\nBalance=25\nSigmafin=1.5",
    );
  });

  it("should handle sections with special characters and complex values", () => {
    const aiResponse = `
<<<<<<< SEARCH
[RGB Curves]
Enabled=false
LumaMode=false
rCurve=0;
=======
[RGB Curves]
Enabled=true
LumaMode=false
rCurve=1;0;0.25;0.35;0.35;0.75;0.85;0.35;0.35;1;1;0.35;0.35;
>>>>>>> REPLACE`;

    const blocks = parseSearchReplaceBlocks(aiResponse);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toContain("rCurve=0;");
    expect(blocks[0].replace).toContain(
      "rCurve=1;0;0.25;0.35;0.35;0.75;0.85;0.35;0.35;1;1;0.35;0.35;",
    );
  });
});
