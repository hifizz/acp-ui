import { memo, useMemo } from "react";
import type { DiffHunk, FileDiff } from "@acp-render/core";
import { cn } from "./cn";

export function DiffStat({
  additions,
  deletions,
  className,
}: {
  additions: number;
  deletions: number;
  className?: string;
}) {
  return (
    <span className={cn("acp-mono inline-flex gap-1.5 text-xs", className)}>
      <span className="text-acp-add">+{additions}</span>
      <span className="text-acp-del">-{deletions}</span>
    </span>
  );
}

export interface InlineDiffProps {
  file: FileDiff;
  /** Maximum lines rendered before truncation. */
  maxLines?: number;
  className?: string;
}

function clipHunks(file: FileDiff, maxLines: number): { hunks: DiffHunk[]; truncated: boolean } {
  const hunks: DiffHunk[] = [];
  let budget = maxLines;
  for (const h of file.hunks) {
    if (budget <= 0) return { hunks, truncated: true };
    const lines = h.lines.slice(0, budget);
    budget -= lines.length;
    hunks.push(lines.length === h.lines.length ? h : { ...h, lines });
    if (lines.length < h.lines.length) return { hunks, truncated: true };
  }
  return { hunks, truncated: false };
}

function hunkLines(
  h: DiffHunk,
): Array<{ sign: string; text: string; oldNo: number | ""; newNo: number | "" }> {
  let oldNo = h.oldStart;
  let newNo = h.newStart;
  return h.lines.map((line) => {
    const sign = line[0] ?? " ";
    return {
      sign,
      text: line.slice(1),
      oldNo: sign === "+" ? "" : oldNo++,
      newNo: sign === "-" ? "" : newNo++,
    };
  });
}

export const InlineDiff = memo(function InlineDiff({
  file,
  maxLines = 400,
  className,
}: InlineDiffProps) {
  const { hunks, truncated } = useMemo(() => clipHunks(file, maxLines), [file, maxLines]);
  return (
    <div
      className={cn(
        "acp-mono overflow-x-auto rounded-md border border-acp-border bg-acp-code-bg text-[12px] leading-[1.55]",
        className,
      )}
    >
      {hunks.map((h, hi) => (
        <div key={hi}>
          <div className="bg-acp-surface-2 px-2 py-0.5 text-acp-subtle">
            @@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
          </div>
          {hunkLines(h).map(({ sign, text, oldNo, newNo }, li) => (
            <div
              key={li}
              className={cn(
                "flex whitespace-pre",
                sign === "+" && "bg-acp-add-bg",
                sign === "-" && "bg-acp-del-bg",
              )}
            >
              <span className="w-10 shrink-0 select-none pr-1 text-right text-acp-subtle">
                {oldNo}
              </span>
              <span className="w-10 shrink-0 select-none pr-1 text-right text-acp-subtle">
                {newNo}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none text-center",
                  sign === "+" && "text-acp-add",
                  sign === "-" && "text-acp-del",
                )}
              >
                {sign === " " ? "" : sign}
              </span>
              <span className="pr-3">{text}</span>
            </div>
          ))}
        </div>
      ))}
      {truncated ? <div className="px-2 py-1 text-acp-subtle">… diff truncated</div> : null}
    </div>
  );
});
