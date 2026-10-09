import type {
  AcpToolCallUpdate,
  AvailableCommand,
  ContentBlock,
  Cost,
  PermissionOption,
  PlanEntry,
  StopReason,
  ToolCallContent,
  ToolCallLocation,
  ToolCallStatus,
  ToolKind,
} from "./acp";

export type MessageRole = "user" | "assistant" | "reasoning";

/** Normalized, transport-agnostic events consumed by the reducer. */
export type ThreadEvent =
  | { type: "turn.started"; turnId: string; at: number; prompt?: ContentBlock[] }
  | { type: "turn.cancelling"; turnId?: string; at: number }
  | { type: "turn.ended"; turnId?: string; at: number; stopReason: StopReason; error?: string }
  | {
      type: "message.chunk";
      at: number;
      role: MessageRole;
      content: ContentBlock;
      messageId?: string | null;
    }
  | { type: "tool.upsert"; at: number; patch: AcpToolCallUpdate }
  | { type: "plan.replaced"; at: number; entries: PlanEntry[] }
  | {
      type: "permission.requested";
      at: number;
      requestId: string;
      toolCall: AcpToolCallUpdate;
      options: PermissionOption[];
    }
  | { type: "permission.resolved"; at: number; requestId: string; optionId: string | null }
  | {
      type: "terminal.output";
      at: number;
      terminalId: string;
      output: string;
      append?: boolean;
      exitCode?: number | null;
    }
  | { type: "usage.updated"; at: number; used: number; size: number; cost?: Cost | null }
  | { type: "mode.changed"; at: number; modeId: string }
  | { type: "commands.updated"; at: number; commands: AvailableCommand[] }
  | { type: "session.info"; at: number; title?: string | null; updatedAt?: string | null }
  | { type: "session.loaded"; at: number };

export type TurnStatus = "running" | "cancelling" | "ended";

export interface Turn {
  id: string;
  index: number;
  status: TurnStatus;
  startedAt: number;
  endedAt?: number;
  stopReason?: StopReason;
  error?: string;
  /** Turn reconstructed from replayed history (session/load) rather than a live prompt. */
  implicit: boolean;
}

export interface Message {
  id: string;
  turnId: string;
  role: MessageRole;
  /** Content blocks with adjacent text chunks merged. */
  content: ContentBlock[];
  createdAt: number;
  updatedAt: number;
}

/** UI-level tool status; `cancelled` is derived locally when a turn is cancelled. */
export type ToolStatus = ToolCallStatus | "cancelled";

export interface ToolCall {
  id: string;
  turnId: string;
  title: string;
  name?: string;
  kind: ToolKind;
  status: ToolStatus;
  content: ToolCallContent[];
  locations: ToolCallLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
}

export interface Plan {
  id: string;
  turnId: string;
  entries: PlanEntry[];
  updatedAt: number;
}

export interface PendingPermission {
  requestId: string;
  turnId: string;
  toolCallId: string;
  options: PermissionOption[];
  requestedAt: number;
}

export interface TerminalState {
  terminalId: string;
  output: string;
  exitCode?: number | null;
}

export interface Usage {
  used: number;
  size: number;
  cost?: Cost | null;
}

export type EntryRef =
  | { kind: "message"; id: string; turnId: string }
  | { kind: "tool"; id: string; turnId: string }
  | { kind: "plan"; id: string; turnId: string };

export interface ThreadState {
  turns: Readonly<Record<string, Turn>>;
  turnOrder: readonly string[];
  messages: Readonly<Record<string, Message>>;
  tools: Readonly<Record<string, ToolCall>>;
  plans: Readonly<Record<string, Plan>>;
  entries: readonly EntryRef[];
  permissions: Readonly<Record<string, PendingPermission>>;
  terminals: Readonly<Record<string, TerminalState>>;
  usage?: Usage;
  modeId?: string;
  commands: readonly AvailableCommand[];
  title?: string;
  /** Monotonic counter used for generated ids. */
  seq: number;
}
