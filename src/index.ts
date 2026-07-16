import express from "express";
import { json } from "express";
import { webhookRouter } from "./routes/webhook";
import { loadConfig } from "./config";

const config = loadConfig();

const app = express();

// Mounted before the global JSON parser: this router parses its own
// raw body (needed for HMAC signature verification), and json() below
// would otherwise consume the body stream first.
app.use("/api/webhook", webhookRouter);

app.use(json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-code-review-bot" });
});

const port = config.port;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Code Review Bot listening on port ${port}`);
});
