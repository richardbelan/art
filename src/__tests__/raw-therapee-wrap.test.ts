import { expect, it, vi, beforeEach, afterEach, describe } from "vitest";
import * as rawTherapeeModule from "../raw-therapee-wrap.js";

// Mock dependencies
vi.mock("nano-spawn", () => {
  return {
    default: vi.fn(),
  };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    constants: { W_OK: 2 },
    promises: {
      access: vi.fn(),
    },
  };
});

vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...actual,
    platform: vi.fn().mockReturnValue("linux"),
  };
});

// Import the actual functions (not mocked)
const { convertDngToImage, convertDngToImageWithPP3 } = rawTherapeeModule;

// Import mocked modules
const nanoSpawnModule = await import("nano-spawn");
const spawn = nanoSpawnModule.default;
const fs = await import("node:fs");
const os = await import("node:os");

beforeEach(() => {
  vi.resetAllMocks();
  // Set default platform to Linux
  vi.mocked(os.platform).mockReturnValue("linux");

  // Mock fs.promises.access to prevent directory access errors
  vi.mocked(fs.promises.access).mockResolvedValue();

  // Mock spawn to succeed by default
  vi.mocked(spawn).mockResolvedValue({} as Awaited<ReturnType<typeof spawn>>);
});

afterEach(() => {
  vi.resetAllMocks();
});

it("convertDngToImage should throw error when quality is out of range", async () => {
  const parameters = {
    input: "/path/to/input.dng",
    output: "/path/to/output.jpg",
    quality: 101, // Invalid quality
    format: "jpeg" as const,
  };

  await expect(convertDngToImage(parameters)).rejects.toThrow(
    "Quality must be between 0 and 100",
  );
});

it("convertDngToImage should throw error when subsampling is out of range", async () => {
  const parameters = {
    input: "/path/to/input.dng",
    output: "/path/to/output.jpg",
    subsampling: 4, // Invalid subsampling
    format: "jpeg" as const,
  };

  await expect(convertDngToImage(parameters)).rejects.toThrow(
    "Subsampling must be between 1 and 3",
  );
});

it("convertDngToImage should throw error when output directory does not exist", async () => {
  // Mock fs.promises.access to fail with ENOENT
  const error = new Error("Directory not found");
  // Add code property to error
  Object.defineProperty(error, "code", { value: "ENOENT" });
  vi.mocked(fs.promises.access).mockRejectedValue(error);

  const parameters = {
    input: "/path/to/input.dng",
    output: "/nonexistent/directory/output.jpg",
    format: "jpeg" as const,
  };

  await expect(convertDngToImage(parameters)).rejects.toThrow(
    /Output directory does not exist/,
  );
});

it("convertDngToImageWithPP3 should throw error when PP3 path is empty", async () => {
  const parameters = {
    input: "/path/to/input.dng",
    output: "/path/to/output.jpg",
    pp3Path: "",
    format: "jpeg" as const,
  };

  await expect(convertDngToImageWithPP3(parameters)).rejects.toThrow(
    "PP3 profile path is required",
  );
});

describe("Format and platform branch coverage", () => {
  it("should handle TIFF format with compression", async () => {
    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.tiff",
      format: "tiff" as const,
      tiffCompression: "z" as const,
    };

    await convertDngToImage(parameters);

    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.arrayContaining(["-t", "z"]),
    );
  });

  it("should handle TIFF format without compression", async () => {
    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.tiff",
      format: "tiff" as const,
    };

    await convertDngToImage(parameters);

    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.arrayContaining(["-t"]),
    );
    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.not.arrayContaining(["z"]),
    );
  });

  it("should handle PNG format", async () => {
    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.png",
      format: "png" as const,
    };

    await convertDngToImage(parameters);

    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.arrayContaining(["-n"]),
    );
  });

  it("should handle Windows platform", async () => {
    vi.mocked(os.platform).mockReturnValue("win32");

    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.jpg",
      format: "jpeg" as const,
    };

    await convertDngToImage(parameters);

    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.arrayContaining(["-w"]),
    );
  });

  it("should handle PP3 path in buildCliArguments", async () => {
    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.jpg",
      pp3Path: "/path/to/profile.pp3",
      format: "jpeg" as const,
    };

    await convertDngToImageWithPP3(parameters);

    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.arrayContaining(["-o", "-p", "/path/to/profile.pp3"]),
    );
  });
});

describe("Error handling branch coverage", () => {
  it("should handle permission denied error in validateOutputDirectory", async () => {
    const error = new Error("Permission denied");
    Object.defineProperty(error, "code", { value: "EACCES" });
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    const parameters = {
      input: "/path/to/input.dng",
      output: "/restricted/directory/output.jpg",
      format: "jpeg" as const,
    };

    await expect(convertDngToImage(parameters)).rejects.toThrow(
      /Permission denied writing to output directory/,
    );
  });

  it("should handle generic error in validateOutputDirectory", async () => {
    const error = new Error("Some other error");
    vi.mocked(fs.promises.access).mockRejectedValue(error);

    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.jpg",
      format: "jpeg" as const,
    };

    await expect(convertDngToImage(parameters)).rejects.toThrow(
      /Error accessing output directory/,
    );
  });

  it("should handle spawn error in convertDngToImage", async () => {
    const spawnError = new Error("rawtherapee-cli not found");
    vi.mocked(spawn).mockRejectedValue(spawnError);

    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.jpg",
      format: "jpeg" as const,
    };

    await expect(convertDngToImage(parameters)).rejects.toThrow(
      "Conversion failed: rawtherapee-cli not found",
    );
  });

  it("should handle spawn error in convertDngToImageWithPP3", async () => {
    const spawnError = new Error("rawtherapee-cli failed");
    vi.mocked(spawn).mockRejectedValue(spawnError);

    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.jpg",
      pp3Path: "/path/to/profile.pp3",
      format: "jpeg" as const,
    };

    await expect(convertDngToImageWithPP3(parameters)).rejects.toThrow(
      "Conversion failed: rawtherapee-cli failed",
    );
  });

  it("should handle unknown spawn error", async () => {
    vi.mocked(spawn).mockRejectedValue("unknown error");

    const parameters = {
      input: "/path/to/input.dng",
      output: "/path/to/output.jpg",
      format: "jpeg" as const,
    };

    await expect(convertDngToImage(parameters)).rejects.toThrow(
      "Conversion failed: Unknown error",
    );
  });
});
