# AI Code Review Bot - TODO

This file lists the step-by-step plan for the MVP.

## Goal
Build a GitHub AI Code Review Bot that uses a single repository, receives pull request events, generates AI review feedback, and posts inline comments.

## Step-by-step plan

1. Project setup
   - Initialize `package.json`, `tsconfig.json`, and `.gitignore`
   - Install runtime and dev dependencies
   - Create `README.md` with project overview and run instructions

2. Configuration
   - Add `src/config.ts`
   - Read environment variables from `.env`
   - Support GitHub token, webhook secret, Redis URL, port

3. Webhook receiver
   - Create `src/routes/webhook.ts`
   - Add endpoint for GitHub webhook events
   - Validate signatures using the webhook secret
   - Parse `pull_request` opened/updated events

4. GitHub integration
   - Create `src/services/githubService.ts`
   - Fetch pull request metadata and changed files
   - Fetch diff or file contents as needed
   - Create a method to post inline review comments

5. Job queue and worker
   - Create `src/services/reviewWorker.ts`
   - Use BullMQ with Redis to enqueue review jobs
   - Create a worker that processes queued jobs

6. AI Review Service
   - Create `src/services/aiReviewService.ts`
   - Build a prompt from PR diff or changed files
   - Call a mock AI provider for local development
   - Structure responses into review comments

7. Inline comment posting
   - Implement posting of one or more inline comments to the PR
   - Keep output minimal for MVP: review summary plus a small number of comments

8. Testing and validation
   - Add lightweight tests for config, webhook payload parsing, and GitHub service
   - Add a local run/debug instruction
   - Validate TypeScript compilation and startup
   - Manual end-to-end test against a real PR:
     - Fill in `.env` (GITHUB_TOKEN with write access to the test repo, WEBHOOK_SECRET, REDIS_URL, PORT)
     - Start Redis (`redis-server`) and the app (`npm run dev`)
     - Expose `localhost:3000` publicly via a tunnel (smee-client or ngrok)
     - Add a webhook on the test repo pointing at `<tunnel-url>/api/webhook`, content type `application/json`, matching secret, "Pull requests" event only
     - Open/update a PR on the test repo with a diff line containing `TODO`/`FIXME` or >200 chars (what the mock reviewer flags)
     - Confirm inline review comments (or the "No issues found" summary) appear on the PR

9. Future enhancements
   - Support multiple repos
   - Add GitHub App support
   - Add AI provider abstraction for OpenAI/Anthropic
   - Add PR summary comments and security-specific checks

## Notes
- For MVP, use a Personal Access Token with repo permissions.
- Start with `pull_request` events only.
- The first implementation should focus on inline comments and a single repo.
