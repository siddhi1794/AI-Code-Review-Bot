import express from "express";
import crypto from "crypto";
import { loadConfig } from "../config";
import { enqueueReview } from "../services/reviewWorker";

export const webhookRouter = express.Router();

export function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digestBuf = Buffer.from(`sha256=${hmac.digest("hex")}`);
  const signatureBuf = Buffer.from(signature);
  // timingSafeEqual throws on length mismatch rather than returning false
  if (digestBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, signatureBuf);
}

webhookRouter.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const config = loadConfig();
  const sig = req.headers["x-hub-signature-256"] as string | undefined;
  const verified = verifySignature(req.body as Buffer, sig, config.webhookSecret);
  if (!verified) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.headers["x-github-event"] as string | undefined;
  if (!event) return res.status(400).json({ error: "Missing event header" });

  const payload = JSON.parse(req.body.toString("utf8"));

  // For MVP, we only care about pull_request events
  if (event === "pull_request") {
    const action = payload.action;
    const pr = payload.pull_request;
    if (pr && (action === "opened" || action === "synchronize" || action === "reopened")) {
      // enqueue a review job
      await enqueueReview({ owner: payload.repository.owner.login, repo: payload.repository.name, prNumber: pr.number });
      return res.status(202).json({ status: "enqueued" });
    }
  }

  return res.status(200).json({ status: "ignored" });
});
