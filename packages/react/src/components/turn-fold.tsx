import { memo } from "react";
import { formatDuration } from "@acp-render/core";
import { cn } from "./cn";
import { ChevronRight } from "./icons";

export interface TurnFoldProps {
  expanded: boolean;
  durationMs: number;
  hiddenCount: number;
  toolCount: number;
  onToggle?: () => void;
  className?: string;
}

export const TurnFold = memo(function TurnFold({
  expanded,
  durationMs,
  toolCount,
  onToggle,
  className,
}: TurnFoldProps) {
  return (
    <div
      className={cn("flex items-center gap-3 text-xs text-acp-subtle", className)}
      data-acp-row="turn-fold"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="inline-flex shrink-0 items-center gap-1 rounded py-0.5 hover:text-acp-fg"
      >
        <span>Worked for {formatDuration(durationMs)}</span>
        {toolCount > 0 ? (
          <span className="text-acp-subtle">
            · {toolCount} tool call{toolCount === 1 ? "" : "s"}
          </span>
        ) : null}
        <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} />
      </button>
      <div className="h-px flex-1 bg-acp-border" />
    </div>
  );
});
