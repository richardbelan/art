import fs from "node:fs";

function getAccessMode(mode: "read" | "write"): number {
  return mode === "read" ? fs.constants.R_OK : fs.constants.W_OK;
}

function createNotFoundError(mode: "read" | "write", filePath: string): Error {
  const resourceType = mode === "read" ? "File" : "Directory";
  return new Error(`${resourceType} not found: ${filePath}`);
}

function createPermissionError(
  mode: "read" | "write",
  filePath: string,
): Error {
  const operation = mode === "read" ? "reading" : "writing";
  return new Error(`Permission denied ${operation} ${filePath}`);
}

function createGenericError(filePath: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "Unknown error";
  return new Error(`Error accessing ${filePath}: ${message}`);
}

export async function validateFileAccess(
  filePath: string,
  mode: "read" | "write",
) {
  try {
    await fs.promises.access(filePath, getAccessMode(mode));
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "ENOENT") {
        throw createNotFoundError(mode, filePath);
      } else if (error.code === "EACCES") {
        throw createPermissionError(mode, filePath);
      }
    }
    throw createGenericError(filePath, error);
  }
}

export function handleFileError(
  error: unknown,
  filePath: string,
  operation: "read" | "write",
) {
  if (error instanceof Error && "code" in error) {
    if (error.code === "ENOENT") {
      throw new Error(`File not found during ${operation}: ${filePath}`);
    } else if (error.code === "EACCES") {
      throw new Error(`Permission denied ${operation}ing file: ${filePath}`);
    }
  }
  throw new Error(
    `Error ${operation}ing file ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
}
