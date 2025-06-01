import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateFileAccess, handleFileError } from "../utils/validation.js";

// Mock node:fs
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    constants: { R_OK: 4, W_OK: 2 },
    promises: {
      access: vi.fn(),
    },
  };
});

const fs = await import("node:fs");

beforeEach(() => {
  vi.resetAllMocks();
  // Reset to success by default
  vi.mocked(fs.promises.access).mockResolvedValue();
});

describe("validateFileAccess", () => {
  it("should succeed when file access is allowed", async () => {
    vi.mocked(fs.promises.access).mockResolvedValue();

    await expect(
      validateFileAccess("/path/to/file.txt", "read"),
    ).resolves.toBeUndefined();
    expect(fs.promises.access).toHaveBeenCalledWith(
      "/path/to/file.txt",
      fs.constants.R_OK,
    );
  });

  it("should use write mode correctly", async () => {
    vi.mocked(fs.promises.access).mockResolvedValue();

    await expect(
      validateFileAccess("/path/to/directory", "write"),
    ).resolves.toBeUndefined();
    expect(fs.promises.access).toHaveBeenCalledWith(
      "/path/to/directory",
      fs.constants.W_OK,
    );
  });

  it("should throw file not found error for read mode", async () => {
    const error = new Error("File not found");
    Object.defineProperty(error, "code", { value: "ENOENT" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(
      validateFileAccess("/nonexistent/file.txt", "read"),
    ).rejects.toThrow("File not found: /nonexistent/file.txt");
  });

  it("should throw directory not found error for write mode", async () => {
    const error = new Error("Directory not found");
    Object.defineProperty(error, "code", { value: "ENOENT" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(
      validateFileAccess("/nonexistent/directory", "write"),
    ).rejects.toThrow("Directory not found: /nonexistent/directory");
  });

  it("should throw permission denied error for read mode", async () => {
    const error = new Error("Permission denied");
    Object.defineProperty(error, "code", { value: "EACCES" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(
      validateFileAccess("/restricted/file.txt", "read"),
    ).rejects.toThrow("Permission denied reading /restricted/file.txt");
  });

  it("should throw permission denied error for write mode", async () => {
    const error = new Error("Permission denied");
    Object.defineProperty(error, "code", { value: "EACCES" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(
      validateFileAccess("/restricted/directory", "write"),
    ).rejects.toThrow("Permission denied writing /restricted/directory");
  });

  it("should throw generic error for unknown error codes", async () => {
    const error = new Error("Some other error");
    Object.defineProperty(error, "code", { value: "UNKNOWN" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(
      validateFileAccess("/path/to/file.txt", "read"),
    ).rejects.toThrow("Error accessing /path/to/file.txt: Some other error");
  });

  it("should throw generic error for non-Error objects", async () => {
    vi.mocked(fs.promises.access).mockRejectedValue("string error");

    await expect(
      validateFileAccess("/path/to/file.txt", "read"),
    ).rejects.toThrow("Error accessing /path/to/file.txt: Unknown error");
  });

  it("should throw generic error for errors without code property", async () => {
    const error = new Error("Error without code");
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    await expect(
      validateFileAccess("/path/to/file.txt", "read"),
    ).rejects.toThrow("Error accessing /path/to/file.txt: Error without code");
  });
});

describe("handleFileError", () => {
  it("should handle ENOENT error for read operation", () => {
    const error = new Error("File not found");
    Object.defineProperty(error, "code", { value: "ENOENT" });

    expect(() => {
      handleFileError(error, "/path/to/file.txt", "read");
    }).toThrow("File not found during read: /path/to/file.txt");
  });

  it("should handle ENOENT error for write operation", () => {
    const error = new Error("File not found");
    Object.defineProperty(error, "code", { value: "ENOENT" });

    expect(() => {
      handleFileError(error, "/path/to/file.txt", "write");
    }).toThrow("File not found during write: /path/to/file.txt");
  });

  it("should handle EACCES error for read operation", () => {
    const error = new Error("Permission denied");
    Object.defineProperty(error, "code", { value: "EACCES" });

    expect(() => {
      handleFileError(error, "/path/to/file.txt", "read");
    }).toThrow("Permission denied reading file: /path/to/file.txt");
  });

  it("should handle EACCES error for write operation", () => {
    const error = new Error("Permission denied");
    Object.defineProperty(error, "code", { value: "EACCES" });

    expect(() => {
      handleFileError(error, "/path/to/file.txt", "write");
    }).toThrow("Permission denied writing file: /path/to/file.txt");
  });

  it("should handle generic Error objects", () => {
    const error = new Error("Some generic error");

    expect(() => {
      handleFileError(error, "/path/to/file.txt", "read");
    }).toThrow("Error reading file /path/to/file.txt: Some generic error");
  });

  it("should handle non-Error objects", () => {
    expect(() => {
      handleFileError("string error", "/path/to/file.txt", "write");
    }).toThrow("Error writing file /path/to/file.txt: Unknown error");
  });

  it("should handle errors without code property", () => {
    const error = new Error("Error without code");

    expect(() => {
      handleFileError(error, "/path/to/file.txt", "read");
    }).toThrow("Error reading file /path/to/file.txt: Error without code");
  });
});
