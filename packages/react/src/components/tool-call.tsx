import { memo } from "react";
import {
  basename,
  toolFileDiffs,
  type ToolCall,
  type ToolKind,
  type ToolStatus,
} from "@acp-render/core";
import { cn } from "./cn";
import { ContentBlockView } from "./content-blocks";
import { DiffStat, InlineDiff } from "./diff-view";
import {
  Brain,
  Check,
  ChevronRight,
  Circle,
  FileText,
  Globe,
  Move,
  Pencil,
  Search,
  Spinner,
  Terminal,
  Toggle,
  Trash,
  Wrench,
  X,
} from "./icons";
import { TerminalOutput } from "./terminal-output";
import { useThreadState } from "./thread-context";

const kindIcons: Record<ToolKind, typeof Wrench> = {
  read: FileText,
  edit: Pencil,
  delete: Trash,
  move: Move,
  search: Search,
  execute: Terminal,
  think: Brain,
  fetch: Globe,
  switch_mode: Toggle,
  other: Wrench,
};

export function ToolKindIcon({
  kind,
  size = 13,
  className,
}: {
  kind: ToolKind;
  size?: number;
  className?: string;
}) {
  const Icon = kindIcons[kind] ?? Wrench;
  return <Icon size={size} className={className} />;
}

const statusLabel: Record<ToolStatus, string> = {
  pending: "Pending",
  in_progress: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function ToolStatusIcon({ status, size = 12 }: { status: ToolStatus; size?: number }) {
  const label = statusLabel[status];
  switch (status) {
    case "pending":
      return <Circle size={size} className="text-acp-subtle" aria-label={label} />;
    case "in_progress":
      return <Spinner size={size} className="text-acp-accent" aria-label={label} />;
    case "completed":
      return <Check size={size} className="text-acp-success" aria-label={label} />;
    case "failed":
      return <X size={size} className="text-acp-danger" aria-label={label} />;
    case "cancelled":
      return <X size={size} className="text-acp-subtle" aria-label={label} />;
  }
}

export interface ToolCallRowProps {
  tool: ToolCall;
  expanded: boolean;
  onToggle?: () => void;
  onOpenFile?: (path: string) => void;
  className?: string;
}

export const ToolCallRow = memo(function ToolCallRow({
  tool,
  expanded,
  onToggle,
  onOpenFile,
  className,
}: ToolCallRowProps) {
  const diffs = toolFileDiffs(tool);
  const additions = diffs.reduce((n, d) => n + d.additions, 0);
  const deletions = diffs.reduce((n, d) => n + d.deletions, 0);
  const hasDetails =
    tool.content.length > 0 || tool.rawInput !== undefined || tool.rawOutput !== undefined;
  return (
    <div
      className={cn("text-[13px]", className)}
      data-acp-row="tool"
      data-acp-tool-status={tool.status}
      data-acp-tool-id={tool.id}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasDetails}
        aria-expanded={hasDetails ? expanded : undefined}
        className="group flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-acp-muted enabled:hover:bg-acp-hover enabled:hover:text-acp-fg"
      >
        <ToolStatusIcon status={tool.status} />
        <ToolKindIcon kind={tool.kind} className="shrink-0 text-acp-subtle" />
        <span
          className={cn("min-w-0 flex-1 truncate", tool.status === "failed" && "text-acp-danger")}
        >
          {tool.title}
        </span>
        {diffs.length > 0 ? <DiffStat additions={additions} deletions={deletions} /> : null}
        {hasDetails ? (
          <ChevronRight
            size={12}
            className={cn("shrink-0 text-acp-subtle transition-transform", expanded && "rotate-90")}
          />
        ) : null}
      </button>
      {expanded && hasDetails ? <ToolCallDetails tool={tool} onOpenFile={onOpenFile} /> : null}
    </div>
  );
});

export interface ToolCallDetailsProps {
  tool: ToolCall;
  onOpenFile?: (path: string) => void;
  className?: string;
}

export function ToolCallDetails({ tool, onOpenFile, className }: ToolCallDetailsProps) {
  const diffs = toolFileDiffs(tool);
  let diffIndex = 0;
  return (
    <div className={cn("ml-6 mt-1 space-y-2 border-l border-acp-border pb-1 pl-3", className)}>
      {tool.locations.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tool.locations.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onOpenFile?.(l.path)}
              className="acp-mono rounded border border-acp-border px-1.5 py-0.5 text-[11px] text-acp-muted hover:text-acp-fg"
              title={l.path}
            >
              {basename(l.path)}
              {l.line != null ? `:${l.line}` : ""}
            </button>
          ))}
        </div>
      ) : null}
      {tool.rawInput !== undefined ? <JsonBlock label="Input" value={tool.rawInput} /> : null}
      {tool.content.map((c, i) => {
        if (c.type === "diff") {
          const file = diffs[diffIndex++];
          return file ? (
            <div key={i}>
              <button
                type="button"
                onClick={() => onOpenFile?.(file.path)}
                className="acp-mono mb-1 text-[11px] text-acp-muted hover:text-acp-fg"
              >
                {file.path}
              </button>
              <InlineDiff file={file} maxLines={200} />
            </div>
          ) : null;
        }
        if (c.type === "terminal") return <ToolTerminal key={i} terminalId={c.terminalId} />;
        if (c.content.type === "text") {
          return (
            <pre
              key={i}
              className="acp-mono max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-acp-border bg-acp-code-bg p-2.5 text-[12px] text-acp-muted"
            >
              {c.content.text}
            </pre>
          );
        }
        return <ContentBlockView key={i} block={c.content} />;
      })}
      {tool.rawOutput !== undefined ? <JsonBlock label="Output" value={tool.rawOutput} /> : null}
    </div>
  );
}

function ToolTerminal({ terminalId }: { terminalId: string }) {
  const terminal = useThreadState((s) => s.terminals[terminalId]);
  return <TerminalOutput output={terminal?.output ?? ""} exitCode={terminal?.exitCode} />;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="mb-0.5 text-[11px] uppercase tracking-wide text-acp-subtle">{label}</div>
      <pre className="acp-mono max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-acp-border bg-acp-code-bg p-2 text-[12px] text-acp-muted">
        {text}
      </pre>
    </div>
  );
}
