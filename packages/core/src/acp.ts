/**
 * Structural subset of the ACP v1 wire types that acp-render consumes.
 * Objects produced by `@agentclientprotocol/sdk` are assignable to these.
 */

export type Meta = Record<string, unknown> | null | undefined;

export interface TextContent {
  type: "text";
  text: string;
  annotations?: unknown;
  _meta?: Meta;
}
export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
  uri?: string | null;
  annotations?: unknown;
  _meta?: Meta;
}
export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
  annotations?: unknown;
  _meta?: Meta;
}
export interface ResourceLink {
  type: "resource_link";
  uri: string;
  name: string;
  title?: string | null;
  description?: string | null;
  mimeType?: string | null;
  size?: number | null;
  annotations?: unknown;
  _meta?: Meta;
}
export interface EmbeddedResource {
  type: "resource";
  resource:
    | { uri: string; text: string; mimeType?: string | null; _meta?: Meta }
    | { uri: string; blob: string; mimeType?: string | null; _meta?: Meta };
  annotations?: unknown;
  _meta?: Meta;
}
export type ContentBlock =
  TextContent | ImageContent | AudioContent | ResourceLink | EmbeddedResource;

export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

export type ToolCallContent =
  | { type: "content"; content: ContentBlock; _meta?: Meta }
  | { type: "diff"; path: string; oldText?: string | null; newText: string; _meta?: Meta }
  | { type: "terminal"; terminalId: string; _meta?: Meta };

export interface ToolCallLocation {
  path: string;
  line?: number | null;
  _meta?: Meta;
}

export interface AcpToolCall {
  toolCallId: string;
  title: string;
  name?: string | null;
  kind?: ToolKind;
  status?: ToolCallStatus;
  content?: ToolCallContent[];
  locations?: ToolCallLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
  _meta?: Meta;
}

export interface AcpToolCallUpdate {
  toolCallId: string;
  title?: string | null;
  name?: string | null;
  kind?: ToolKind | null;
  status?: ToolCallStatus | null;
  content?: ToolCallContent[] | null;
  locations?: ToolCallLocation[] | null;
  rawInput?: unknown;
  rawOutput?: unknown;
  _meta?: Meta;
}

export interface PlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
  _meta?: Meta;
}

export interface AvailableCommand {
  name: string;
  description: string;
  input?: { hint: string } | null;
  _meta?: Meta;
}

export interface Cost {
  amount: number;
  currency: string;
}

export type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";

export interface ContentChunk {
  content: ContentBlock;
  messageId?: string | null;
  _meta?: Meta;
}

export type SessionUpdate =
  | ({ sessionUpdate: "user_message_chunk" } & ContentChunk)
  | ({ sessionUpdate: "agent_message_chunk" } & ContentChunk)
  | ({ sessionUpdate: "agent_thought_chunk" } & ContentChunk)
  | ({ sessionUpdate: "tool_call" } & AcpToolCall)
  | ({ sessionUpdate: "tool_call_update" } & AcpToolCallUpdate)
  | { sessionUpdate: "plan"; entries: PlanEntry[]; _meta?: Meta }
  | {
      sessionUpdate: "available_commands_update";
      availableCommands: AvailableCommand[];
      _meta?: Meta;
    }
  | { sessionUpdate: "current_mode_update"; currentModeId: string; _meta?: Meta }
  | { sessionUpdate: "config_option_update"; configOptions: unknown[]; _meta?: Meta }
  | {
      sessionUpdate: "session_info_update";
      title?: string | null;
      updatedAt?: string | null;
      _meta?: Meta;
    }
  | { sessionUpdate: "usage_update"; used: number; size: number; cost?: Cost | null; _meta?: Meta };

export interface SessionNotification {
  sessionId: string;
  update: SessionUpdate;
  _meta?: Meta;
}

export type PermissionOptionKind = "allow_once" | "allow_always" | "reject_once" | "reject_always";

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: PermissionOptionKind;
  _meta?: Meta;
}

export interface RequestPermissionRequest {
  sessionId: string;
  toolCall: AcpToolCallUpdate;
  options: PermissionOption[];
  _meta?: Meta;
}

export type RequestPermissionOutcome =
  { outcome: "cancelled" } | { outcome: "selected"; optionId: string };

export interface RequestPermissionResponse {
  outcome: RequestPermissionOutcome;
  _meta?: Meta;
}

export interface PromptResponseLike {
  stopReason: StopReason;
  _meta?: Meta;
}
