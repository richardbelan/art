import { expect, it, vi, beforeEach, describe } from "vitest";
import path from "node:path";

// Mock dependencies BEFORE importing the module under test
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

// Mock os.platform to return win32 BEFORE importing the module
vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...actual,
    default: {
      ...actual.default,
      platform: () => "win32",
    },
    platform: () => "win32",
  };
});

// Import after mocking
import { convertDngToImage } from "../raw-therapee-wrap.js";

// Import mocked modules
const nanoSpawnModule = await import("nano-spawn");
const spawn = nanoSpawnModule.default;
const fs = await import("node:fs");

// Use real test file and existing directory for tests
const TEST_INPUT_FILE = path.resolve("examples/1/IMG_0080.CR2");
const TEST_OUTPUT_DIR = path.resolve("examples/1");

beforeEach(() => {
  vi.clearAllMocks();
  // Mock fs.promises.access to prevent directory access errors
  vi.mocked(fs.promises.access).mockResolvedValue(undefined);
  // Mock spawn to succeed by default
  vi.mocked(spawn).mockResolvedValue({} as Awaited<ReturnType<typeof spawn>>);
});

describe("Windows platform tests", () => {
  it("should handle Windows platform", async () => {
    const parameters = {
      input: TEST_INPUT_FILE,
      output: path.join(TEST_OUTPUT_DIR, "output.jpg"),
      format: "jpeg" as const,
    };

    await convertDngToImage(parameters);

    // Check that the arguments include the Windows flag
    expect(spawn).toHaveBeenCalledWith(
      "rawtherapee-cli",
      expect.arrayContaining(["-w"]),
    );
  });
});
