import { memo } from "react";
import type { ToolCall, ToolKind } from "@acp-render/core";
import { cn } from "./cn";
import { ChevronRight, Spinner } from "./icons";
import { ToolCallRow, ToolKindIcon } from "./tool-call";

const verbs: Partial<Record<ToolKind, [string, string]>> = {
  read: ["Reading", "Read"],
  search: ["Searching", "Searched"],
  fetch: ["Fetching", "Fetched"],
  execute: ["Running", "Ran"],
  edit: ["Editing", "Edited"],
};

const nouns: Partial<Record<ToolKind, string>> = {
  read: "file",
  search: "search",
  fetch: "page",
  execute: "command",
  edit: "file",
};

export function toolGroupSummary(kind: ToolKind, count: number, active: boolean): string {
  const [ing, ed] = verbs[kind] ?? ["Running", "Ran"];
  const noun = nouns[kind] ?? "tool call";
  const plural =
    kind === "search" ? (count === 1 ? "search" : "searches") : `${noun}${count === 1 ? "" : "s"}`;
  return `${active ? ing : ed} ${count} ${plural}`;
}

export interface ToolGroupProps {
  toolKind: ToolKind;
  tools: ToolCall[];
  expanded: boolean;
  active: boolean;
  hasFailure: boolean;
  onToggle?: () => void;
  expandedTools?: ReadonlySet<string>;
  onToggleTool?: (id: string) => void;
  onOpenFile?: (path: string) => void;
  className?: string;
}

export const ToolGroup = memo(function ToolGroup({
  toolKind,
  tools,
  expanded,
  active,
  hasFailure,
  onToggle,
  expandedTools,
  onToggleTool,
  onOpenFile,
  className,
}: ToolGroupProps) {
  return (
    <div className={cn("text-[13px]", className)} data-acp-row="tool-group">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-acp-muted hover:bg-acp-hover hover:text-acp-fg"
      >
        {active ? (
          <Spinner size={12} className="text-acp-accent" />
        ) : (
          <ToolKindIcon kind={toolKind} className="text-acp-subtle" />
        )}
        <span className={cn("flex-1", hasFailure && "text-acp-danger")}>
          {toolGroupSummary(toolKind, tools.length, active)}
        </span>
        <ChevronRight
          size={12}
          className={cn("text-acp-subtle transition-transform", expanded && "rotate-90")}
        />
      </button>
      {expanded ? (
        <div className="ml-3 border-l border-acp-border pl-2">
          {tools.map((t) => (
            <ToolCallRow
              key={t.id}
              tool={t}
              expanded={expandedTools?.has(t.id) ?? false}
              onToggle={() => onToggleTool?.(t.id)}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});
