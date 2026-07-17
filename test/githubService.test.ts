import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock(...) below is hoisted above regular const declarations, so the
// mocks it references must be created via vi.hoisted() to hoist alongside it.
const { mockListFiles, mockPaginateIterator, mockGet, mockCreateComment, mockCreateReview } = vi.hoisted(() => ({
  mockListFiles: vi.fn(),
  mockPaginateIterator: vi.fn(),
  mockGet: vi.fn(),
  mockCreateComment: vi.fn(),
  mockCreateReview: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
  // Must be a regular function, not an arrow function: githubService.ts
  // calls `new Octokit(...)`, and arrow functions can't be constructors.
  Octokit: vi.fn().mockImplementation(function () {
    return {
      pulls: {
        listFiles: mockListFiles,
        get: mockGet,
        createReview: mockCreateReview,
      },
      issues: {
        createComment: mockCreateComment,
      },
      paginate: {
        iterator: mockPaginateIterator,
      },
    };
  }),
}));

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

import {
  listChangedFiles,
  getPullRequest,
  postReviewComment,
  postInlineReviewComments,
} from "../src/services/githubService";

describe("githubService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listChangedFiles paginates and flattens file results", async () => {
    async function* fakeIterator() {
      yield { data: [{ filename: "a.ts", patch: "@@ -1 +1 @@\n+const a = 1;" }] };
      yield { data: [{ filename: "b.ts", patch: undefined }] };
    }
    mockPaginateIterator.mockReturnValue(fakeIterator());

    const files = await listChangedFiles("owner", "repo", 1);

    expect(files).toEqual([
      { filename: "a.ts", patch: "@@ -1 +1 @@\n+const a = 1;" },
      { filename: "b.ts", patch: undefined },
    ]);
    expect(mockPaginateIterator).toHaveBeenCalledWith(mockListFiles, {
      owner: "owner",
      repo: "repo",
      pull_number: 1,
    });
  });

  it("getPullRequest returns the PR data", async () => {
    mockGet.mockResolvedValue({ data: { number: 1, title: "Test PR" } });

    const pr = await getPullRequest("owner", "repo", 1);

    expect(pr).toEqual({ number: 1, title: "Test PR" });
    expect(mockGet).toHaveBeenCalledWith({ owner: "owner", repo: "repo", pull_number: 1 });
  });

  it("postReviewComment posts an issue comment", async () => {
    await postReviewComment("owner", "repo", 1, "hello");

    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      body: "hello",
    });
  });

  it("postInlineReviewComments creates a review with mapped comments", async () => {
    await postInlineReviewComments(
      "owner",
      "repo",
      1,
      [{ path: "a.ts", line: 3, body: "issue" }],
      "summary"
    );

    expect(mockCreateReview).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 1,
      event: "COMMENT",
      body: "summary",
      comments: [{ path: "a.ts", line: 3, body: "issue" }],
    });
  });
});
