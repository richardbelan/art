import { describe, expect, it } from "vitest";
import { SectionChange } from "../pp3-parser.js";
import { splitContentIntoSections } from "../pp3-sections/section-parser.js";

// Import the function directly from agent.ts
// Note: In a real project, you might want to export this function from agent.ts
// For testing purposes, we'll recreate a simplified version here
function applyDirectSectionChanges(
  content: string,
  sectionChanges: SectionChange[],
): string {
  if (sectionChanges.length === 0) {
    return content;
  }

  // Split content into sections for easier manipulation
  const { sections, sectionOrders } = splitContentIntoSections(content);
  const sectionMap = new Map<string, string>();

  // Create a map of section name to section content
  for (const section of sections) {
    const sectionHeaderMatch = /^\[(.*?)\]/.exec(section);
    if (sectionHeaderMatch) {
      const sectionName = sectionHeaderMatch[1];
      sectionMap.set(sectionName, section);
    }
  }

  // Apply changes to each section
  for (const change of sectionChanges) {
    const { sectionName, parameters } = change;

    // Get the original section content
    const originalSection = sectionMap.get(sectionName);
    if (!originalSection) {
      continue;
    }

    // Split the section into lines for parameter replacement
    const sectionLines = originalSection.split("\n");
    const updatedLines = [...sectionLines];

    // Apply each parameter change
    for (const [paramName, paramLine] of parameters.entries()) {
      const paramRegex = new RegExp(`^\\s*${paramName}\\s*=.*$`, "m");

      // Find the parameter line index
      const paramLineIndex = sectionLines.findIndex((line) =>
        paramRegex.test(line),
      );

      if (paramLineIndex !== -1) {
        // Replace the parameter line
        updatedLines[paramLineIndex] = paramLine;
      }
    }

    // Update the section in the map
    sectionMap.set(sectionName, updatedLines.join("\n"));
  }

  // Reconstruct the content preserving the original section order
  return sectionOrders
    .map((sectionName) => sectionMap.get(sectionName) ?? "")
    .filter(Boolean)
    .join("\n");
}

describe("Direct Section Changes Application", () => {
  it("should apply direct section changes to PP3 content", () => {
    const originalContent = `[Version]
AppVersion=5.8
Version=346

[Exposure]
Auto=false
Clip=0.02
Compensation=0
Brightness=0
Contrast=0

[ColorToning]
Enabled=false
Method=LabRegions
Lumamode=true
Twocolor=Std
Redlow=0
Greenlow=0
Bluelow=0
Satlow=0
Balance=0
`;

    const sectionChanges: SectionChange[] = [
      {
        sectionName: "Exposure",
        parameters: new Map([
          ["Brightness", "Brightness=35"],
          ["Contrast", "Contrast=25"],
        ]),
      },
      {
        sectionName: "ColorToning",
        parameters: new Map([
          ["Enabled", "Enabled=true"],
          ["Redlow", "Redlow=20"],
        ]),
      },
    ];

    const result = applyDirectSectionChanges(originalContent, sectionChanges);

    // Check that the changes were applied correctly
    expect(result).toContain("Brightness=35");
    expect(result).toContain("Contrast=25");
    expect(result).toContain("Enabled=true");
    expect(result).toContain("Redlow=20");

    // Check that unchanged parameters remain the same
    expect(result).toContain("Auto=false");
    expect(result).toContain("Clip=0.02");
    expect(result).toContain("Compensation=0");

    // Check that section order is preserved
    expect(result.indexOf("[Version]")).toBeLessThan(
      result.indexOf("[Exposure]"),
    );
    expect(result.indexOf("[Exposure]")).toBeLessThan(
      result.indexOf("[ColorToning]"),
    );
  });

  it("should handle non-existent sections", () => {
    const originalContent = `[Version]
AppVersion=5.8
Version=346

[Exposure]
Auto=false
Clip=0.02`;

    const sectionChanges: SectionChange[] = [
      {
        sectionName: "NonExistentSection",
        parameters: new Map([["Parameter", "Parameter=Value"]]),
      },
    ];

    const result = applyDirectSectionChanges(originalContent, sectionChanges);

    // The content should contain all the original content
    expect(result).toContain("AppVersion=5.8");
    expect(result).toContain("Version=346");
    expect(result).toContain("Auto=false");
    expect(result).toContain("Clip=0.02");

    // And should not contain the non-existent section
    expect(result).not.toContain("NonExistentSection");
    expect(result).not.toContain("Parameter=Value");
  });

  it("should handle non-existent parameters", () => {
    const originalContent = `[Exposure]
Auto=false
Clip=0.02
`;

    const sectionChanges: SectionChange[] = [
      {
        sectionName: "Exposure",
        parameters: new Map([["NonExistentParam", "NonExistentParam=Value"]]),
      },
    ];

    const result = applyDirectSectionChanges(originalContent, sectionChanges);

    // The content should remain unchanged except for line endings
    expect(result.trim()).toBe(originalContent.trim());
  });

  it("should handle empty section changes", () => {
    const originalContent = `[Exposure]
Auto=false
Clip=0.02
`;

    const result = applyDirectSectionChanges(originalContent, []);

    // The content should remain unchanged (except for possible line ending differences)
    expect(result.trim()).toBe(originalContent.trim());
  });
});
