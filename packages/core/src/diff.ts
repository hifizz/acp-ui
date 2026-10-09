import { structuredPatch } from "diff";
import type { ToolCallContent } from "./acp";
import type { ThreadState, ToolCall } from "./types";

export type DiffContent = Extract<ToolCallContent, { type: "diff" }>;

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Lines prefixed with "+", "-" or " ". */
  lines: string[];
}

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted";
  oldText: string | null;
  newText: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffTotals {
  files: number;
  additions: number;
  deletions: number;
}

const cache = new WeakMap<DiffContent, WeakMap<DiffContent, FileDiff>>();

export function computeFileDiff(
  path: string,
  oldText: string | null,
  newText: string,
  deleted = false,
): FileDiff {
  const patch = structuredPatch(path, path, oldText ?? "", newText, "", "", { context: 3 });
  let additions = 0;
  let deletions = 0;
  const hunks: DiffHunk[] = patch.hunks.map((h) => {
    const lines = h.lines.filter((l) => !l.startsWith("\\"));
    for (const l of lines) {
      if (l.startsWith("+")) additions++;
      else if (l.startsWith("-")) deletions++;
    }
    return {
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      lines,
    };
  });
  const status = oldText == null ? "added" : deleted ? "deleted" : "modified";
  return { path, status, oldText, newText, additions, deletions, hunks };
}

function cachedDiff(first: DiffContent, last: DiffContent, deleted: boolean): FileDiff {
  let inner = cache.get(first);
  if (!inner) cache.set(first, (inner = new WeakMap()));
  let hit = inner.get(last);
  if (!hit || (hit.status === "deleted") !== deleted) {
    hit = computeFileDiff(first.path, first.oldText ?? null, last.newText, deleted);
    inner.set(last, hit);
  }
  return hit;
}

export function diffContents(tool: ToolCall): DiffContent[] {
  return tool.content.filter((c): c is DiffContent => c.type === "diff");
}

/** Per-tool diffs, exactly as reported by the agent in this tool call. */
export function toolFileDiffs(tool: ToolCall): FileDiff[] {
  return diffContents(tool).map((d) =>
    cachedDiff(d, d, tool.kind === "delete" && d.newText === ""),
  );
}

/**
 * Cumulative diff of a set of tool calls, grouped by path: the first `oldText`
 * seen for a path is diffed against the last `newText`, so repeated edits to a
 * file are not double counted.
 */
export function aggregateFileDiffs(tools: readonly ToolCall[]): FileDiff[] {
  const byPath = new Map<string, { first: DiffContent; last: DiffContent; deleted: boolean }>();
  for (const tool of tools) {
    if (tool.status === "failed") continue;
    for (const d of diffContents(tool)) {
      const prev = byPath.get(d.path);
      const deleted = tool.kind === "delete" && d.newText === "";
      if (prev) {
        prev.last = d;
        prev.deleted = deleted;
      } else byPath.set(d.path, { first: d, last: d, deleted });
    }
  }
  const out: FileDiff[] = [];
  for (const { first, last, deleted } of byPath.values()) {
    const f = cachedDiff(first, last, deleted);
    if (f.additions || f.deletions || f.status !== "modified") out.push(f);
  }
  return out;
}

export function turnTools(state: ThreadState, turnId: string): ToolCall[] {
  const tools: ToolCall[] = [];
  for (const e of state.entries) {
    if (e.kind === "tool" && e.turnId === turnId) {
      const t = state.tools[e.id];
      if (t) tools.push(t);
    }
  }
  return tools;
}

export function turnFileDiffs(state: ThreadState, turnId: string): FileDiff[] {
  return aggregateFileDiffs(turnTools(state, turnId));
}

export function diffTotals(files: readonly FileDiff[]): DiffTotals {
  let additions = 0;
  let deletions = 0;
  for (const f of files) {
    additions += f.additions;
    deletions += f.deletions;
  }
  return { files: files.length, additions, deletions };
}
