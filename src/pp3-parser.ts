/**
 * PP3 file format parser with search/replace block handling
 */

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

interface ParseState {
  isInSearch: boolean;
  isInReplace: boolean;
  currentBlock: { search: string[]; replace: string[] };
}

function createInitialState(): ParseState {
  return {
    isInSearch: false,
    isInReplace: false,
    currentBlock: { search: [], replace: [] },
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
