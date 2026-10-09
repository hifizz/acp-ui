import type { StopReason, ToolKind } from "./acp";
import { aggregateFileDiffs, diffTotals, type FileDiff } from "./diff";
import { isTerminalToolStatus } from "./reducer";
import type { Message, PendingPermission, Plan, ThreadState, ToolCall, Turn } from "./types";

export type Row =
  | { kind: "user-message"; id: string; turnId: string; message: Message }
  | {
      kind: "assistant-message";
      id: string;
      turnId: string;
      message: Message;
      streaming: boolean;
      /** Last assistant message of a settled turn. */
      isFinal: boolean;
    }
  | {
      kind: "reasoning";
      id: string;
      turnId: string;
      message: Message;
      streaming: boolean;
      expanded: boolean;
    }
  | { kind: "tool"; id: string; turnId: string; tool: ToolCall; expanded: boolean }
  | {
      kind: "tool-group";
      id: string;
      turnId: string;
      toolKind: ToolKind;
      tools: ToolCall[];
      expanded: boolean;
      active: boolean;
      hasFailure: boolean;
    }
  | { kind: "plan"; id: string; turnId: string; plan: Plan }
  | {
      kind: "permission";
      id: string;
      turnId: string;
      request: PendingPermission;
      tool: ToolCall | undefined;
    }
  | {
      kind: "turn-fold";
      id: string;
      turnId: string;
      expanded: boolean;
      durationMs: number;
      hiddenCount: number;
      toolCount: number;
    }
  | {
      kind: "changed-files";
      id: string;
      turnId: string;
      files: FileDiff[];
      additions: number;
      deletions: number;
      expanded: boolean;
    }
  | { kind: "working"; id: string; turnId: string; startedAt: number; cancelling: boolean }
  | { kind: "turn-status"; id: string; turnId: string; stopReason: StopReason; error?: string };

export type RowKind = Row["kind"];

export interface RowOptions {
  /** Settled turns whose process is expanded. */
  expandedTurns?: ReadonlySet<string>;
  /** Tool call ids whose details are expanded. */
  expandedTools?: ReadonlySet<string>;
  /** Tool group ids that are expanded. */
  expandedGroups?: ReadonlySet<string>;
  /** Reasoning message ids that are expanded (streaming reasoning is always expanded). */
  expandedReasoning?: ReadonlySet<string>;
  /** Turn ids whose changed-files list is collapsed. */
  collapsedChangedFiles?: ReadonlySet<string>;
  /** Collapse the process of settled turns behind a "Worked for …" row. Default true. */
  foldSettledTurns?: boolean;
  /** Keep the first assistant message of a folded turn visible. Default true. */
  keepFirstAssistantMessage?: boolean;
  /** Keep failed tool calls visible in folded turns. Default true. */
  keepFailedTools?: boolean;
  /** Tool kinds that are merged when consecutive. Default read, search. */
  groupToolKinds?: readonly ToolKind[];
  /** Minimum run length to form a group. Default 2. */
  minGroupSize?: number;
}

type Item =
  | { kind: "message"; message: Message }
  | { kind: "tool"; tool: ToolCall }
  | { kind: "plan"; plan: Plan };

export function turnFoldId(turnId: string): string {
  return `${turnId}:fold`;
}

export function toolGroupId(firstToolId: string): string {
  return `group:${firstToolId}`;
}

function groupEntries(state: ThreadState): Map<string, Item[]> {
  const map = new Map<string, Item[]>();
  for (const e of state.entries) {
    let item: Item | undefined;
    if (e.kind === "message") {
      const m = state.messages[e.id];
      if (m) item = { kind: "message", message: m };
    } else if (e.kind === "tool") {
      const t = state.tools[e.id];
      if (t) item = { kind: "tool", tool: t };
    } else {
      const p = state.plans[e.id];
      if (p) item = { kind: "plan", plan: p };
    }
    if (!item) continue;
    let list = map.get(e.turnId);
    if (!list) map.set(e.turnId, (list = []));
    list.push(item);
  }
  return map;
}

export function deriveRows(state: ThreadState, options: RowOptions = {}): Row[] {
  const byTurn = groupEntries(state);
  const permissionsByTurn = new Map<string, PendingPermission[]>();
  for (const p of Object.values(state.permissions)) {
    const list = permissionsByTurn.get(p.turnId) ?? [];
    list.push(p);
    permissionsByTurn.set(p.turnId, list);
  }
  const rows: Row[] = [];
  for (const turnId of state.turnOrder) {
    const turn = state.turns[turnId];
    if (!turn) continue;
    deriveTurnRows(
      rows,
      state,
      turn,
      byTurn.get(turnId) ?? [],
      permissionsByTurn.get(turnId) ?? [],
      options,
    );
  }
  return rows;
}

function deriveTurnRows(
  rows: Row[],
  state: ThreadState,
  turn: Turn,
  items: Item[],
  permissions: PendingPermission[],
  o: RowOptions,
): void {
  const settled = turn.status === "ended";
  const assistantIdx: number[] = [];
  items.forEach((it, i) => {
    if (it.kind === "message" && it.message.role === "assistant") assistantIdx.push(i);
  });
  const lastAssistant = assistantIdx[assistantIdx.length - 1];
  const firstAssistant = assistantIdx[0];

  let visible = items;
  let foldAt = -1;
  let foldRow: Extract<Row, { kind: "turn-fold" }> | undefined;
  if (settled && (o.foldSettledTurns ?? true)) {
    const keep = (it: Item, i: number): boolean => {
      if (it.kind === "message") {
        if (it.message.role === "user") return true;
        if (i === lastAssistant) return true;
        if (i === firstAssistant && (o.keepFirstAssistantMessage ?? true)) return true;
        return false;
      }
      if (it.kind === "tool") return (o.keepFailedTools ?? true) && it.tool.status === "failed";
      return false;
    };
    const hidden = items.filter((it, i) => !keep(it, i));
    if (hidden.length > 0) {
      const expanded = o.expandedTurns?.has(turn.id) ?? false;
      foldAt = items.findIndex((it, i) => !keep(it, i));
      foldRow = {
        kind: "turn-fold",
        id: turnFoldId(turn.id),
        turnId: turn.id,
        expanded,
        durationMs: Math.max(0, (turn.endedAt ?? turn.startedAt) - turn.startedAt),
        hiddenCount: hidden.length,
        toolCount: hidden.filter((it) => it.kind === "tool").length,
      };
      if (!expanded) {
        const hiddenSet = new Set(hidden);
        const before = items.slice(0, foldAt);
        visible = [...before, ...items.slice(foldAt).filter((it) => !hiddenSet.has(it))];
      }
    }
  }

  const groupKinds = new Set<ToolKind>(o.groupToolKinds ?? ["read", "search"]);
  const minGroup = o.minGroupSize ?? 2;
  const lastItem = items[items.length - 1];
  const turnRows: Row[] = [];
  let finalRowIndex = -1;

  for (let i = 0; i < visible.length; i++) {
    if (foldRow && i === foldAt) turnRows.push(foldRow);
    const it = visible[i]!;
    if (it.kind === "tool" && groupKinds.has(it.tool.kind)) {
      let j = i;
      while (
        j + 1 < visible.length &&
        visible[j + 1]!.kind === "tool" &&
        (visible[j + 1] as { tool: ToolCall }).tool.kind === it.tool.kind
      )
        j++;
      if (j - i + 1 >= minGroup) {
        const tools = visible.slice(i, j + 1).map((x) => (x as { tool: ToolCall }).tool);
        const id = toolGroupId(it.tool.id);
        turnRows.push({
          kind: "tool-group",
          id,
          turnId: turn.id,
          toolKind: it.tool.kind,
          tools,
          expanded: o.expandedGroups?.has(id) ?? false,
          active: tools.some((t) => !isTerminalToolStatus(t.status)),
          hasFailure: tools.some((t) => t.status === "failed"),
        });
        i = j;
        continue;
      }
    }
    if (it.kind === "tool") {
      turnRows.push({
        kind: "tool",
        id: it.tool.id,
        turnId: turn.id,
        tool: it.tool,
        expanded: o.expandedTools?.has(it.tool.id) ?? false,
      });
    } else if (it.kind === "plan") {
      turnRows.push({ kind: "plan", id: it.plan.id, turnId: turn.id, plan: it.plan });
    } else {
      const m = it.message;
      const streaming = !settled && it === lastItem;
      if (m.role === "user") {
        turnRows.push({ kind: "user-message", id: m.id, turnId: turn.id, message: m });
      } else if (m.role === "reasoning") {
        turnRows.push({
          kind: "reasoning",
          id: m.id,
          turnId: turn.id,
          message: m,
          streaming,
          expanded: streaming || (o.expandedReasoning?.has(m.id) ?? false),
        });
      } else {
        const isFinal = settled && items.indexOf(it) === lastAssistant;
        turnRows.push({
          kind: "assistant-message",
          id: m.id,
          turnId: turn.id,
          message: m,
          streaming,
          isFinal,
        });
        if (isFinal) finalRowIndex = turnRows.length - 1;
      }
    }
  }
  if (foldRow && foldAt >= visible.length) turnRows.push(foldRow);

  for (const request of permissions) {
    turnRows.push({
      kind: "permission",
      id: `permission:${request.requestId}`,
      turnId: turn.id,
      request,
      tool: state.tools[request.toolCallId],
    });
  }

  const tools = items.filter((it): it is Extract<Item, { kind: "tool" }> => it.kind === "tool");
  const files = aggregateFileDiffs(tools.map((t) => t.tool));
  if (files.length > 0) {
    const totals = diffTotals(files);
    const row: Row = {
      kind: "changed-files",
      id: `${turn.id}:changed-files`,
      turnId: turn.id,
      files,
      additions: totals.additions,
      deletions: totals.deletions,
      expanded: !(o.collapsedChangedFiles?.has(turn.id) ?? false),
    };
    if (finalRowIndex >= 0) turnRows.splice(finalRowIndex + 1, 0, row);
    else turnRows.push(row);
  }

  if (settled && ((turn.stopReason && turn.stopReason !== "end_turn") || turn.error)) {
    turnRows.push({
      kind: "turn-status",
      id: `${turn.id}:status`,
      turnId: turn.id,
      stopReason: turn.stopReason ?? "end_turn",
      error: turn.error,
    });
  }
  if (!settled) {
    turnRows.push({
      kind: "working",
      id: `${turn.id}:working`,
      turnId: turn.id,
      startedAt: turn.startedAt,
      cancelling: turn.status === "cancelling",
    });
  }
  rows.push(...turnRows);
}
