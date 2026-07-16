import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "../config";
import { listChangedFiles, postReviewComment, postInlineReviewComments } from "./githubService";
import { reviewFilesMock, reviewFilesWithClaude } from "./aiReviewService";

// Keep MVP output minimal: cap how many inline comments a single review posts.
const MAX_INLINE_COMMENTS = 10;

const config = loadConfig();
// BullMQ requires maxRetriesPerRequest: null on connections used for blocking
// operations (Workers); otherwise it throws at construction time.
const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("reviews", { connection });

export async function enqueueReview(payload: { owner: string; repo: string; prNumber: number }) {
  await queue.add("review", payload, { attempts: 3, backoff: { type: "exponential", delay: 1000 } });
}

new Worker(
  "reviews",
  async (job) => {
    const { owner, repo, prNumber } = job.data as { owner: string; repo: string; prNumber: number };
    const files = await listChangedFiles(owner, repo, prNumber);
    const findings =
      config.aiProvider === "anthropic" ? await reviewFilesWithClaude(files) : await reviewFilesMock(files);
    if (findings.length === 0) {
      await postReviewComment(owner, repo, prNumber, "AI Review: No issues found.");
      return;
    }

    const comments = findings
      .slice(0, MAX_INLINE_COMMENTS)
      .map((f) => ({ path: f.path, line: f.line, body: f.message }));

    const summary =
      findings.length > MAX_INLINE_COMMENTS
        ? `AI Review: found ${findings.length} issues. Showing the first ${MAX_INLINE_COMMENTS} as inline comments.`
        : `AI Review: found ${findings.length} issue${findings.length === 1 ? "" : "s"}.`;

    await postInlineReviewComments(owner, repo, prNumber, comments, summary);
  },
  { connection }
);
