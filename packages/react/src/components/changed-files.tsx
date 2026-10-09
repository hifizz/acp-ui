import { memo } from "react";
import type { FileDiff } from "@acp-render/core";
import { cn } from "./cn";
import { DiffStat } from "./diff-view";
import { ChevronRight } from "./icons";

export interface ChangedFilesSummaryProps {
  files: FileDiff[];
  additions: number;
  deletions: number;
  expanded: boolean;
  onToggle?: () => void;
  onOpenDiff?: (path?: string) => void;
  className?: string;
}

const statusLetter: Record<FileDiff["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
};

export const ChangedFilesSummary = memo(function ChangedFilesSummary({
  files,
  additions,
  deletions,
  expanded,
  onToggle,
  onOpenDiff,
  className,
}: ChangedFilesSummaryProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-acp border border-acp-border bg-acp-surface text-[13px]",
        className,
      )}
      data-acp-row="changed-files"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 text-left text-acp-muted hover:text-acp-fg"
        >
          <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} />
          <span>
            {files.length} file{files.length === 1 ? "" : "s"} changed
          </span>
          <DiffStat additions={additions} deletions={deletions} />
        </button>
        {onOpenDiff ? (
          <button
            type="button"
            onClick={() => onOpenDiff()}
            className="rounded-md border border-acp-border px-2 py-0.5 text-xs text-acp-muted hover:bg-acp-hover hover:text-acp-fg"
          >
            Open diff
          </button>
        ) : null}
      </div>
      {expanded ? (
        <ul className="border-t border-acp-border py-1">
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => onOpenDiff?.(f.path)}
                className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-acp-hover"
              >
                <span
                  className={cn(
                    "acp-mono w-3 text-[11px]",
                    f.status === "added" && "text-acp-add",
                    f.status === "deleted" && "text-acp-del",
                    f.status === "modified" && "text-acp-warning",
                  )}
                >
                  {statusLetter[f.status]}
                </span>
                <span className="acp-mono min-w-0 flex-1 truncate text-[12px] text-acp-muted">
                  {f.path}
                </span>
                <DiffStat additions={f.additions} deletions={f.deletions} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
