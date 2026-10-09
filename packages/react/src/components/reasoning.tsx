import { memo } from "react";
import { formatDuration, type Message } from "@acp-render/core";
import { cn } from "./cn";
import { ContentBlocks } from "./content-blocks";
import { ChevronRight } from "./icons";

export interface ReasoningBlockProps {
  message: Message;
  streaming?: boolean;
  expanded: boolean;
  onToggle?: () => void;
  className?: string;
}

export const ReasoningBlock = memo(function ReasoningBlock({
  message,
  streaming,
  expanded,
  onToggle,
  className,
}: ReasoningBlockProps) {
  const duration = message.updatedAt - message.createdAt;
  return (
    <div className={cn("text-[13px] text-acp-muted", className)} data-acp-row="reasoning">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1 rounded py-0.5 hover:text-acp-fg"
      >
        <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} />
        {streaming ? "Thinking…" : `Thought for ${formatDuration(duration)}`}
      </button>
      {expanded ? (
        <div className="mt-1 border-l border-acp-border pl-3 italic">
          <ContentBlocks blocks={message.content} streaming={streaming} />
        </div>
      ) : null}
    </div>
  );
});
