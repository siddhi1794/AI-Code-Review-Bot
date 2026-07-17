import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "../config";

const config = loadConfig();
const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export type ReviewFinding = {
  path: string;
  line: number;
  message: string;
};

type DiffFile = { filename: string; patch?: string };
type AddedLine = { content: string; newLineNumber: number };

// Parses a unified diff hunk, returning only lines added in the new file,
// with their real line number in the new file. GitHub's inline-comment API
// rejects line numbers that aren't part of the diff, so this tracks the
// new-file line counter rather than the patch text's own line index.
function parseAddedLines(patch: string): AddedLine[] {
  const result: AddedLine[] = [];
  let newLineNumber = 0;
  for (const raw of patch.split("\n")) {
    const hunkHeader = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkHeader) {
      newLineNumber = Number(hunkHeader[1]);
      continue;
    }
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;
    if (raw.startsWith("+")) {
      result.push({ content: raw.slice(1), newLineNumber });
      newLineNumber++;
    } else if (raw.startsWith("-")) {
      continue; // removed line: doesn't exist in the new file
    } else if (!raw.startsWith("\\")) {
      newLineNumber++; // context line, present in both old and new file
    }
  }
  return result;
}

// Builds the prompt that would be sent to a real AI provider (see TODO step 9).
// Only added lines are included, since those are what a PR review should comment on.
export function buildPrompt(files: DiffFile[]): string {
  const sections = files
    .filter((f) => f.patch)
    .map((f) => {
      const added = parseAddedLines(f.patch!);
      const body = added.map((l) => `${l.newLineNumber}: ${l.content}`).join("\n");
      return `File: ${f.filename}\n${body}`;
    });
  return ["Review the following pull request diff. Flag any issues on the added lines.", ...sections].join("\n\n");
}

// Mock AI provider for local development: applies simple heuristics directly
// to the parsed diff instead of performing real inference.
export async function reviewFilesMock(files: DiffFile[]): Promise<ReviewFinding[]> {
  const results: ReviewFinding[] = [];
  for (const f of files) {
    if (!f.patch) continue;
    for (const { content, newLineNumber } of parseAddedLines(f.patch)) {
      if (content.includes("TODO") || content.includes("FIXME")) {
        results.push({ path: f.filename, line: newLineNumber, message: "Found TODO/FIXME in diff" });
      }
      if (content.length > 200) {
        results.push({ path: f.filename, line: newLineNumber, message: "Very long line — consider breaking it up" });
      }
    }
  }
  return results;
}

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string", description: "The file path exactly as shown in the diff" },
          line: { type: "integer", description: "The new-file line number exactly as shown in the diff" },
          message: { type: "string", description: "A concise description of the issue" },
        },
        required: ["path", "line", "message"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
};

const REVIEW_SYSTEM_PROMPT =
  "You are an expert code reviewer. You will be shown the added lines of a pull request diff, each " +
  "prefixed with its line number. Review only those added lines for correctness bugs, security issues, " +
  "and significant code-quality problems. Only cite a path and line that appear exactly as shown in the " +
  "diff — never a line you weren't given. If the diff has no issues worth flagging, return an empty " +
  "findings array rather than inventing minor nitpicks.";

// Real AI provider: sends the diff to Claude and asks for structured findings.
// GitHub's inline-comment API rejects line numbers that aren't part of the
// diff, so model-reported findings are validated against the same added-line
// set the prompt was built from before being returned.
export async function reviewFilesWithClaude(files: DiffFile[]): Promise<ReviewFinding[]> {
  const validLinesByPath = new Map<string, Set<number>>();
  for (const f of files) {
    if (!f.patch) continue;
    validLinesByPath.set(f.filename, new Set(parseAddedLines(f.patch).map((l) => l.newLineNumber)));
  }

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: REVIEW_SYSTEM_PROMPT,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: FINDINGS_SCHEMA },
    },
    messages: [{ role: "user", content: buildPrompt(files) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const parsed = JSON.parse(textBlock.text) as { findings: ReviewFinding[] };
  return parsed.findings.filter((f) => validLinesByPath.get(f.path)?.has(f.line) ?? false);
}
