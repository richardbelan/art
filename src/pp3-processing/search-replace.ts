// Search and replace functionality extracted from agent.ts

/**
 * Finds the section boundaries in content
 */
export function findSectionBoundaries(
  contentLines: string[],
  sectionHeader: string,
): { startIndex: number; endIndex: number } | null {
  const sectionStartIndex = contentLines.findIndex(
    (line) => line.trim() === sectionHeader,
  );
  if (sectionStartIndex === -1) {
    return null;
  }

  // Find the end of the section (next section or end of content)
  let sectionEndIndex = contentLines.length;
  for (
    let index = sectionStartIndex + 1;
    index < contentLines.length;
    index++
  ) {
    const line = contentLines[index].trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      sectionEndIndex = index;
      break;
    }
  }

  return { startIndex: sectionStartIndex, endIndex: sectionEndIndex };
}

/**
 * Extracts parameter lines from search/replace patterns
 */
export function extractParameters(lines: string[]): string[] {
  return lines
    .filter((line) => !line.trim().startsWith("[") && line.trim().length > 0)
    .map((line) => line.trim());
}

/**
 * Creates a map of parameter names to replacement values
 */
export function createReplacementMap(
  searchParameters: string[],
  replaceParameters: string[],
): Map<string, string> {
  const replaceMap = new Map<string, string>();

  for (const [index, searchParameter] of searchParameters.entries()) {
    const replaceParameter = replaceParameters[index];
    const searchParameterName = searchParameter.split("=")[0];
    replaceMap.set(searchParameterName, replaceParameter);
  }

  return replaceMap;
}

/**
 * Applies replacements within a section
 */
export function applyReplacementsInSection(
  contentLines: string[],
  boundaries: { startIndex: number; endIndex: number },
  replaceMap: Map<string, string>,
  verbose: boolean,
): string[] {
  const result = [...contentLines];
  const indentationRegex = /^\s*/;

  for (
    let index = boundaries.startIndex + 1;
    index < boundaries.endIndex;
    index++
  ) {
    const line = result[index].trim();
    if (line.length === 0) continue;

    const parameterName = line.split("=")[0];
    if (replaceMap.has(parameterName)) {
      const originalIndentation =
        indentationRegex.exec(result[index])?.[0] ?? "";
      const replacementValue = replaceMap.get(parameterName);

      if (replacementValue !== undefined) {
        result[index] = originalIndentation + replacementValue;

        if (verbose) {
          console.log(`Replaced: ${line} -> ${replacementValue}`);
        }
      }
    }
  }

  return result;
}

/**
 * Applies fuzzy search/replace that supports line skipping within sections
 */
export function applyFuzzySearchReplace(
  content: string,
  search: string,
  replace: string,
  verbose: boolean,
): string {
  const searchLines = search.trim().split("\n");
  const replaceLines = replace.trim().split("\n");
  const contentLines = content.split("\n");

  // Find the section header (first line starting with [)
  const sectionHeaderLine = searchLines.find((line) =>
    line.trim().startsWith("["),
  );
  if (!sectionHeaderLine) {
    return content.replace(search.trim(), replace.trim());
  }

  const sectionHeader = sectionHeaderLine.trim();
  const boundaries = findSectionBoundaries(contentLines, sectionHeader);

  if (!boundaries) {
    if (verbose) {
      console.log(`Section ${sectionHeader} not found in content`);
    }
    return content;
  }

  const searchParameters = extractParameters(searchLines);
  const replaceParameters = extractParameters(replaceLines);

  if (searchParameters.length !== replaceParameters.length) {
    if (verbose) {
      console.log("Parameter count mismatch, falling back to exact match");
    }
    return content.replace(search.trim(), replace.trim());
  }

  const replaceMap = createReplacementMap(searchParameters, replaceParameters);
  const result = applyReplacementsInSection(
    contentLines,
    boundaries,
    replaceMap,
    verbose,
  );

  return result.join("\n");
}

/**
 * Applies search/replace blocks to content
 */
export function applySearchReplaceBlocks(
  content: string,
  searchReplaceBlocks: { search: string; replace: string }[],
  verbose: boolean,
): string {
  let result = content;

  for (const block of searchReplaceBlocks) {
    const { search, replace } = block;

    if (!search || !replace) {
      throw new Error("Invalid search/replace block format");
    }

    if (verbose) {
      console.log(`Searching for: ${search}`);
      console.log(`Replacing with: ${replace}`);
    }

    // Try fuzzy search/replace first, fallback to exact match
    const fuzzyResult = applyFuzzySearchReplace(
      result,
      search,
      replace,
      verbose,
    );
    result =
      fuzzyResult === result
        ? result.replace(search.trim(), replace.trim())
        : fuzzyResult;
  }

  return result;
}
