import { Octokit } from "@octokit/rest";
import { loadConfig } from "../config";

const config = loadConfig();
const octokit = new Octokit({ auth: config.githubToken });

export async function getPullRequest(owner: string, repo: string, prNumber: number) {
  const { data } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
  return data;
}

export async function listChangedFiles(owner: string, repo: string, prNumber: number) {
  const files: Array<{ filename: string; patch?: string }> = [];
  for await (const response of octokit.paginate.iterator(octokit.pulls.listFiles, { owner, repo, pull_number: prNumber })) {
    for (const f of response.data) {
      files.push({ filename: f.filename, patch: f.patch });
    }
  }
  return files;
}

export async function postReviewComment(owner: string, repo: string, prNumber: number, body: string) {
  // Post a review summary as a PR comment for now
  await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
}

export type InlineComment = { path: string; line: number; body: string };

export async function postInlineReviewComments(
  owner: string,
  repo: string,
  prNumber: number,
  comments: InlineComment[],
  summary: string
) {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    event: "COMMENT",
    body: summary,
    comments: comments.map((c) => ({ path: c.path, line: c.line, body: c.body })),
  });
}
