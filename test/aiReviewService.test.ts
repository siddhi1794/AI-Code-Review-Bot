import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock(...) below is hoisted above regular const declarations, so the
// mock it references must be created via vi.hoisted() to hoist alongside it.
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  // Must be a regular function, not an arrow function: aiReviewService.ts
  // calls `new Anthropic(...)`, and arrow functions can't be constructors.
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: mockCreate,
      },
    };
  }),
}));

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

import { reviewFilesWithClaude } from "../src/services/aiReviewService";

const FILES = [{ filename: "a.ts", patch: "@@ -0,0 +1 @@\n+const a = 1;" }];

function textResponse(findings: unknown[]) {
  return { content: [{ type: "text", text: JSON.stringify({ findings }) }] };
}

describe("reviewFilesWithClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns findings whose path/line are part of the diff", async () => {
    mockCreate.mockResolvedValue(
      textResponse([{ path: "a.ts", line: 1, message: "Possible off-by-one" }])
    );

    const findings = await reviewFilesWithClaude(FILES);

    expect(findings).toEqual([{ path: "a.ts", line: 1, message: "Possible off-by-one" }]);
  });

  it("drops findings whose line isn't part of the diff", async () => {
    mockCreate.mockResolvedValue(
      textResponse([
        { path: "a.ts", line: 1, message: "Valid finding" },
        { path: "a.ts", line: 99, message: "Hallucinated line" },
      ])
    );

    const findings = await reviewFilesWithClaude(FILES);

    expect(findings).toEqual([{ path: "a.ts", line: 1, message: "Valid finding" }]);
  });

  it("returns an empty array when the model reports no findings", async () => {
    mockCreate.mockResolvedValue(textResponse([]));

    const findings = await reviewFilesWithClaude(FILES);

    expect(findings).toEqual([]);
  });
});
