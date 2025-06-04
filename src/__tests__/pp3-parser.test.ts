import { describe, expect, it } from "vitest";
import {
  parseSearchReplaceBlocks,
  parseDirectSectionChanges,
} from "../pp3-parser.js";

describe("PP3 Parser", () => {
  it("should parse complete search/replace block", () => {
    const input = `
<<<<<<< SEARCH
[Exposure]
Auto=false
=======
[Exposure]
Auto=true
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toEqual([
      {
        search: "[Exposure]\nAuto=false",
        replace: "[Exposure]\nAuto=true",
      },
    ]);
  });

  it("should handle multiple blocks", () => {
    const input = `
<<<<<<< SEARCH
First
=======
FirstModified
>>>>>>> REPLACE

<<<<<<< SEARCH
Second
=======
SecondModified
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toHaveLength(2);
    expect(result[0].search).toBe("First");
    expect(result[0].replace).toBe("FirstModified");
    expect(result[1].search).toBe("Second");
    expect(result[1].replace).toBe("SecondModified");
  });

  it("should handle incomplete blocks", () => {
    const input = `
<<<<<<< SEARCH
Unclosed`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toEqual([]);
  });

  it("should handle empty input", () => {
    const result = parseSearchReplaceBlocks("");
    expect(result).toEqual([]);
  });

  it("should handle partial block markers", () => {
    const input = `
=======
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toEqual([]);
  });

  it("should handle blocks with empty search or replace", () => {
    const input = `
<<<<<<< SEARCH
=======
ReplaceOnly
>>>>>>> REPLACE

<<<<<<< SEARCH
SearchOnly
=======
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toEqual([]);
  });

  it("should handle blocks with multiple lines", () => {
    const input = `
<<<<<<< SEARCH
[Section]
Param1=Value1
Param2=Value2
=======
[Section]
Param1=NewValue1
Param2=NewValue2
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].search).toBe("[Section]\nParam1=Value1\nParam2=Value2");
    expect(result[0].replace).toBe(
      "[Section]\nParam1=NewValue1\nParam2=NewValue2",
    );
  });

  it("should not duplicate blocks", () => {
    const input = `
<<<<<<< SEARCH
Test
=======
TestModified
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].search).toBe("Test");
    expect(result[0].replace).toBe("TestModified");
  });

  it("should handle line skipping in search/replace blocks", () => {
    const input = `
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
>>>>>>> REPLACE`;

    const result = parseSearchReplaceBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].search).toBe(
      "[ColorToning]\nLumamode=true\nTwocolor=Std\nRedlow=0",
    );
    expect(result[0].replace).toBe(
      "[ColorToning]\nLumamode=true\nTwocolor=Std\nRedlow=20",
    );
  });

  describe("Direct Section Changes Parser", () => {
    it("should parse direct section changes from code blocks", () => {
      const input = `
ANALYSIS:
The image appears underexposed and lacks contrast.

PLAN:
Increase exposure and contrast to improve overall brightness and detail.

EXECUTION:

\`\`\`
[Exposure]
Brightness=35
Contrast=25
\`\`\`

\`\`\`
[ColorToning]
Redlow=20
\`\`\`
`;

      const result = parseDirectSectionChanges(input);
      expect(result).toHaveLength(2);

      // Check first section
      expect(result[0].sectionName).toBe("Exposure");
      expect(result[0].parameters.size).toBe(2);
      expect(result[0].parameters.get("Brightness")).toBe("Brightness=35");
      expect(result[0].parameters.get("Contrast")).toBe("Contrast=25");

      // Check second section
      expect(result[1].sectionName).toBe("ColorToning");
      expect(result[1].parameters.size).toBe(1);
      expect(result[1].parameters.get("Redlow")).toBe("Redlow=20");
    });

    it("should handle a single section with multiple parameters", () => {
      const input = `
\`\`\`
[Exposure]
Brightness=35
Contrast=25
Saturation=10
\`\`\`
`;

      const result = parseDirectSectionChanges(input);
      expect(result).toHaveLength(1);
      expect(result[0].sectionName).toBe("Exposure");
      expect(result[0].parameters.size).toBe(3);
      expect(result[0].parameters.get("Brightness")).toBe("Brightness=35");
      expect(result[0].parameters.get("Contrast")).toBe("Contrast=25");
      expect(result[0].parameters.get("Saturation")).toBe("Saturation=10");
    });

    it("should handle input without code blocks", () => {
      const input = `
[Exposure]
Brightness=35
Contrast=25

[ColorToning]
Redlow=20
`;

      const result = parseDirectSectionChanges(input);
      expect(result).toHaveLength(2);

      // Check first section
      expect(result[0].sectionName).toBe("Exposure");
      expect(result[0].parameters.size).toBe(2);

      // Check second section
      expect(result[1].sectionName).toBe("ColorToning");
      expect(result[1].parameters.size).toBe(1);
    });

    it("should handle empty input", () => {
      const result = parseDirectSectionChanges("");
      expect(result).toEqual([]);
    });

    it("should handle input with no valid sections", () => {
      const input = `
This is just some text without any section headers.
`;

      const result = parseDirectSectionChanges(input);
      expect(result).toEqual([]);
    });

    it("should handle parameters with = in the value", () => {
      const input = `
\`\`\`
[Exposure]
Curve=0;0;0.5=0.5;1=1
\`\`\`
`;

      const result = parseDirectSectionChanges(input);
      expect(result).toHaveLength(1);
      expect(result[0].sectionName).toBe("Exposure");
      expect(result[0].parameters.size).toBe(1);
      expect(result[0].parameters.get("Curve")).toBe("Curve=0;0;0.5=0.5;1=1");
    });
  });
});
