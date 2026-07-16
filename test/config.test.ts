import { describe, it, expect, vi, beforeEach } from "vitest";

// Prevent dotenv from reading the real local .env file — tests must be
// deterministic regardless of what's in a developer's machine.
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.GITHUB_TOKEN;
    delete process.env.WEBHOOK_SECRET;
    delete process.env.REDIS_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  it("applies defaults when env vars are unset", () => {
    expect(loadConfig()).toEqual({
      port: 3000,
      githubToken: "",
      webhookSecret: "",
      redisUrl: "redis://127.0.0.1:6379",
      anthropicApiKey: "",
      aiProvider: "mock",
    });
  });

  it("reads values from env vars when present", () => {
    process.env.PORT = "4000";
    process.env.GITHUB_TOKEN = "test-token";
    process.env.WEBHOOK_SECRET = "test-secret";
    process.env.REDIS_URL = "redis://example:6380";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.AI_PROVIDER = "anthropic";

    expect(loadConfig()).toEqual({
      port: 4000,
      githubToken: "test-token",
      webhookSecret: "test-secret",
      redisUrl: "redis://example:6380",
      anthropicApiKey: "test-anthropic-key",
      aiProvider: "anthropic",
    });
  });

  it("falls back to mock provider for any non-anthropic AI_PROVIDER value", () => {
    process.env.AI_PROVIDER = "bogus";
    expect(loadConfig().aiProvider).toBe("mock");
  });
});
