import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

// webhook.ts imports enqueueReview from reviewWorker.ts, which opens a real
// Redis connection as a module-load side effect. Mock it so this test stays
// isolated from Redis entirely.
vi.mock("../src/services/reviewWorker", () => ({
  enqueueReview: vi.fn(),
}));

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

import { verifySignature } from "../src/routes/webhook";

function sign(body: string, secret: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifySignature", () => {
  const secret = "test-secret";
  const body = Buffer.from(JSON.stringify({ hello: "world" }));

  it("accepts a correctly signed payload", () => {
    const sig = sign(body.toString(), secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const sig = sign(body.toString(), "wrong-secret");
    expect(verifySignature(body, sig, secret)).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const sig = sign(body.toString(), secret);
    const tamperedBody = Buffer.from(JSON.stringify({ hello: "tampered" }));
    expect(verifySignature(tamperedBody, sig, secret)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifySignature(body, undefined, secret)).toBe(false);
  });

  it("does not throw on a malformed/short signature header", () => {
    expect(() => verifySignature(body, "sha256=short", secret)).not.toThrow();
    expect(verifySignature(body, "sha256=short", secret)).toBe(false);
  });
});
