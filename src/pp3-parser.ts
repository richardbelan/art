/**
 * PP3 file format parser with search/replace block handling and direct section/attribute changes
 */

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export interface SectionChange {
  sectionName: string;
  parameters: Map<string, string>;
}

interface ParseState {
  isInSearch: boolean;
  isInReplace: boolean;
  currentBlock: { search: string[]; replace: string[] };
}

interface DirectChangeState {
  isInCodeBlock: boolean;
  currentSection: string;
  sections: SectionChange[];
}

function createInitialState(): ParseState {
  return {
    isInSearch: false,
    isInReplace: false,
    currentBlock: { search: [], replace: [] },
  };
}

function createDirectChangeState(): DirectChangeState {
  return {
    isInCodeBlock: false,
    currentSection: "",
    sections: [],
  };
}

function handleSearchStart(state: ParseState): void {
  state.isInSearch = true;
  state.isInReplace = false;
  state.currentBlock = { search: [], replace: [] };
}

function handleSeparator(state: ParseState): void {
  state.isInSearch = false;
  state.isInReplace = true;
}

function handleReplaceEnd(
  state: ParseState,
  blocks: SearchReplaceBlock[],
): void {
  state.isInSearch = false;
  state.isInReplace = false;
  if (
    state.currentBlock.search.length > 0 &&
    state.currentBlock.replace.length > 0
  ) {
    blocks.push({
      search: state.currentBlock.search.join("\n"),
      replace: state.currentBlock.replace.join("\n"),
    });
  }
}

function handleContentLine(line: string, state: ParseState): void {
  if (state.isInSearch) state.currentBlock.search.push(line);
  if (state.isInReplace) state.currentBlock.replace.push(line);
}

export function parseSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  const state = createInitialState();

  for (const line of text.split("\n")) {
    if (line.startsWith("<<<<<<< SEARCH")) {
      handleSearchStart(state);
    } else if (line.startsWith("=======")) {
      handleSeparator(state);
    } else if (line.startsWith(">>>>>>> REPLACE")) {
      handleReplaceEnd(state, blocks);
    } else {
      handleContentLine(line, state);
    }
  }

  return blocks;
}

/**
 * Parses direct section/attribute changes from AI response
 * @param text - The AI response text
 * @returns Array of section changes
 */
export function parseDirectSectionChanges(text: string): SectionChange[] {
  const state = createDirectChangeState();

  // Extract content to process (from code blocks or full text)
  const contentToProcess = extractContentToProcess(text);

  // Process the content line by line
  processContentLines(contentToProcess, state);

  return state.sections;
}

/**
 * Extracts content to process from text, prioritizing code blocks
 */
function extractContentToProcess(text: string): string {
  const codeBlocks = extractCodeBlocks(text);

  // If no code blocks found, use the entire text
  return codeBlocks.length > 0 ? codeBlocks.join("\n") : text;
}

/**
 * Extracts code blocks from text
 */
function extractCodeBlocks(text: string): string[] {
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match[1]) {
      codeBlocks.push(match[1].trim());
    }
  }

  return codeBlocks;
}

/**
 * Processes content lines and updates the state
 */
function processContentLines(content: string, state: DirectChangeState): void {
  let currentSectionChange: SectionChange | null = null;

  for (const line of content.split("\n")) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    if (isSectionHeader(trimmedLine)) {
      // Finalize previous section if exists
      if (currentSectionChange) {
        state.sections.push(currentSectionChange);
      }

      // Start a new section
      const sectionName = trimmedLine.slice(1, -1);
      currentSectionChange = createNewSectionChange(sectionName);
    } else if (isParameterLine(trimmedLine) && currentSectionChange) {
      processParameterLine(trimmedLine, currentSectionChange);
    }
  }

  // Add the last section if we were processing one
  if (currentSectionChange) {
    state.sections.push(currentSectionChange);
  }
}

/**
 * Checks if a line is a section header
 */
function isSectionHeader(line: string): boolean {
  return line.startsWith("[") && line.endsWith("]");
}

/**
 * Checks if a line is a parameter line
 */
function isParameterLine(line: string): boolean {
  return line.includes("=");
}

/**
 * Creates a new section change object
 */
function createNewSectionChange(sectionName: string): SectionChange {
  return {
    sectionName,
    parameters: new Map<string, string>(),
  };
}

/**
 * Processes a parameter line and adds it to the section change
 */
function processParameterLine(
  line: string,
  sectionChange: SectionChange,
): void {
  const [parameterName] = line.split("=");

  if (parameterName) {
    sectionChange.parameters.set(parameterName, line);
  }
}
