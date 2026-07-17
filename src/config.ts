import dotenv from "dotenv";

dotenv.config();

export function loadConfig() {
  return {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    githubToken: process.env.GITHUB_TOKEN || "",
    webhookSecret: process.env.WEBHOOK_SECRET || "",
    redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    aiProvider: process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "mock",
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;
