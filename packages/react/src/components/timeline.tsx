import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import type { Row, RowOptions } from "@acp-render/core";
import { ChangedFilesSummary } from "./changed-files";
import { cn } from "./cn";
import { ArrowDown } from "./icons";
import { AssistantMessage, UserMessage } from "./messages";
import { PermissionPrompt } from "./permission-prompt";
import { PlanCard } from "./plan-card";
import { ReasoningBlock } from "./reasoning";
import { TurnStatus, WorkingIndicator } from "./status";
import { useRows, useThreadContext } from "./thread-context";
import { ToolCallRow } from "./tool-call";
import { ToolGroup } from "./tool-group";
import { TurnFold } from "./turn-fold";
import { useStickToBottom } from "./use-stick-to-bottom";

type SetKey =
  | "expandedTurns"
  | "expandedTools"
  | "expandedGroups"
  | "expandedReasoning"
  | "collapsedChangedFiles";
type ExpansionState = Record<SetKey, ReadonlySet<string>>;

const emptyExpansion: ExpansionState = {
  expandedTurns: new Set(),
  expandedTools: new Set(),
  expandedGroups: new Set(),
  expandedReasoning: new Set(),
  collapsedChangedFiles: new Set(),
};

export interface TimelineRowContext {
  toggle: (key: SetKey, id: string) => void;
  expandedTools: ReadonlySet<string>;
  onOpenDiff?: (turnId: string, path?: string) => void;
  onRespondPermission?: (requestId: string, optionId: string | null) => void;
}

export interface TimelineProps {
  /** Folding / grouping rules. Expansion sets are managed internally. */
  rowOptions?: Omit<RowOptions, SetKey>;
  onOpenDiff?: (turnId: string, path?: string) => void;
  /** Return a node to replace the default renderer for a row, or undefined to fall back. */
  renderRow?: (row: Row, ctx: TimelineRowContext) => ReactNode | undefined;
  empty?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Rendered after the rows inside the scroll area, e.g. a sticky <Composer />. */
  footer?: ReactNode;
}

export function Timeline({
  rowOptions,
  onOpenDiff,
  renderRow,
  empty,
  className,
  contentClassName,
  footer,
}: TimelineProps) {
  const { respondPermission } = useThreadContext();
  const [expansion, setExpansion] = useState<ExpansionState>(emptyExpansion);
  const toggle = useCallback((key: SetKey, id: string) => {
    setExpansion((prev) => {
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: next };
    });
  }, []);
  const options = useMemo(() => ({ ...rowOptions, ...expansion }), [rowOptions, expansion]);
  const rows = useRows(options);
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();
  const ctx: TimelineRowContext = useMemo(
    () => ({
      toggle,
      expandedTools: expansion.expandedTools,
      onOpenDiff,
      onRespondPermission: respondPermission,
    }),
    [toggle, expansion.expandedTools, onOpenDiff, respondPermission],
  );

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
        data-acp-timeline
      >
        <div
          ref={contentRef}
          className={cn("mx-auto flex max-w-3xl flex-col gap-3 px-5 py-6", contentClassName)}
        >
          {rows.length === 0 ? empty : null}
          {rows.map((row) => (
            <TimelineRow key={row.id} row={row} ctx={ctx} renderRow={renderRow} />
          ))}
        </div>
        {footer}
      </div>
      {!isAtBottom ? <JumpToLatest onClick={() => scrollToBottom("smooth")} /> : null}
    </div>
  );
}

export function JumpToLatest({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-acp-border-strong bg-acp-surface-2 px-3 py-1 text-xs text-acp-muted shadow-lg hover:text-acp-fg",
        className,
      )}
    >
      <ArrowDown size={12} /> Jump to latest
    </button>
  );
}

const TimelineRow = memo(function TimelineRow({
  row,
  ctx,
  renderRow,
}: {
  row: Row;
  ctx: TimelineRowContext;
  renderRow?: TimelineProps["renderRow"];
}) {
  const custom = renderRow?.(row, ctx);
  if (custom !== undefined) return <>{custom}</>;
  return <DefaultRow row={row} ctx={ctx} />;
});

export function DefaultRow({ row, ctx }: { row: Row; ctx: TimelineRowContext }) {
  const openFile = ctx.onOpenDiff
    ? (path: string) => ctx.onOpenDiff?.(row.turnId, path)
    : undefined;
  switch (row.kind) {
    case "user-message":
      return <UserMessage message={row.message} className="mt-2 first:mt-0" />;
    case "assistant-message":
      return (
        <AssistantMessage message={row.message} streaming={row.streaming} isFinal={row.isFinal} />
      );
    case "reasoning":
      return (
        <ReasoningBlock
          message={row.message}
          streaming={row.streaming}
          expanded={row.expanded}
          onToggle={() => ctx.toggle("expandedReasoning", row.id)}
        />
      );
    case "tool":
      return (
        <ToolCallRow
          tool={row.tool}
          expanded={row.expanded}
          onToggle={() => ctx.toggle("expandedTools", row.id)}
          onOpenFile={openFile}
        />
      );
    case "tool-group":
      return (
        <ToolGroup
          toolKind={row.toolKind}
          tools={row.tools}
          expanded={row.expanded}
          active={row.active}
          hasFailure={row.hasFailure}
          onToggle={() => ctx.toggle("expandedGroups", row.id)}
          expandedTools={ctx.expandedTools}
          onToggleTool={(id) => ctx.toggle("expandedTools", id)}
          onOpenFile={openFile}
        />
      );
    case "plan":
      return <PlanCard plan={row.plan} />;
    case "permission":
      return (
        <PermissionPrompt
          request={row.request}
          tool={row.tool}
          onRespond={ctx.onRespondPermission}
        />
      );
    case "turn-fold":
      return (
        <TurnFold
          expanded={row.expanded}
          durationMs={row.durationMs}
          hiddenCount={row.hiddenCount}
          toolCount={row.toolCount}
          onToggle={() => ctx.toggle("expandedTurns", row.turnId)}
        />
      );
    case "changed-files":
      return (
        <ChangedFilesSummary
          files={row.files}
          additions={row.additions}
          deletions={row.deletions}
          expanded={row.expanded}
          onToggle={() => ctx.toggle("collapsedChangedFiles", row.turnId)}
          onOpenDiff={ctx.onOpenDiff ? (path) => ctx.onOpenDiff?.(row.turnId, path) : undefined}
        />
      );
    case "working":
      return <WorkingIndicator startedAt={row.startedAt} cancelling={row.cancelling} />;
    case "turn-status":
      return <TurnStatus stopReason={row.stopReason} error={row.error} />;
  }
}
