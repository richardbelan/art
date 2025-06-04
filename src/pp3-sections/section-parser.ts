// Section parsing functionality extracted from agent.ts

export interface SectionResult {
  sections: string[];
  sectionOrders: string[];
}

export interface SectionWithFilter extends SectionResult {
  includedSections: string[];
  excludedSections: string[];
}

interface SectionParseState {
  currentSection: string;
  currentSectionName: string;
  sectionIndex: number;
  inSection: boolean;
}

function createSectionParseState(): SectionParseState {
  return {
    currentSection: "",
    currentSectionName: "",
    sectionIndex: 0,
    inSection: false,
  };
}

function finalizePreviousSection(
  state: SectionParseState,
  sections: string[],
  processSection?: (
    section: string,
    sectionName: string,
    index: number,
  ) => void,
): void {
  if (state.inSection && state.currentSection) {
    const trimmedSection = state.currentSection.trim();
    sections.push(trimmedSection);
    if (processSection) {
      processSection(
        trimmedSection,
        state.currentSectionName,
        state.sectionIndex,
      );
    }
    state.sectionIndex++;
  }
}

function startNewSection(
  line: string,
  trimmedLine: string,
  state: SectionParseState,
  sectionOrders: string[],
): void {
  const sectionName = trimmedLine.slice(1, -1);
  state.currentSection = line;
  state.currentSectionName = sectionName;
  sectionOrders.push(sectionName);
  state.inSection = true;
}

function handleSectionLine(line: string, state: SectionParseState): void {
  const trimmedLine = line.trim();

  if (trimmedLine.startsWith("[")) {
    return; // This case is handled by the caller
  }

  if (state.inSection) {
    state.currentSection += `\n${line}`;
  }
}

/**
 * Base function to split content into sections based on section headers in square brackets
 * @param content - The content to split into sections
 * @param processSection - Optional callback to process each section as it's found
 * @returns Object containing sections and their order
 */
export function splitContentBySections(
  content: string,
  processSection?: (
    section: string,
    sectionName: string,
    index: number,
  ) => void,
): SectionResult {
  if (!content.trim()) {
    return { sections: [], sectionOrders: [] };
  }

  const lines = content.split("\n");
  const sections: string[] = [];
  const sectionOrders: string[] = [];
  const state = createSectionParseState();

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("[")) {
      finalizePreviousSection(state, sections, processSection);
      startNewSection(line, trimmedLine, state, sectionOrders);
    } else {
      handleSectionLine(line, state);
    }
  }

  // Handle the last section
  finalizePreviousSection(state, sections, processSection);

  return { sections, sectionOrders };
}

/**
 * Splits PP3 content into sections and categorizes them based on provided section names
 * @param content - The PP3 file content as a string
 * @param sectionNames - Array of section names to include
 * @returns Object containing included sections, excluded sections, and section order
 */
export function splitPP3ContentBySections(
  content: string,
  sectionNames: string[],
): SectionWithFilter {
  const includedSections: string[] = [];
  const excludedSections: string[] = [];

  const { sections, sectionOrders } = splitContentBySections(
    content,
    (section, sectionName) => {
      if (sectionNames.includes(sectionName)) {
        includedSections.push(section);
      } else {
        excludedSections.push(section);
      }
    },
  );

  return { sections, sectionOrders, includedSections, excludedSections };
}

/**
 * Splits content into sections based on section headers in square brackets
 * @param content - The content to split into sections
 * @returns Object containing sections and their order
 */
export function splitContentIntoSections(content: string): SectionResult {
  return splitContentBySections(content);
}
