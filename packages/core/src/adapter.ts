import type {
  PromptResponseLike,
  RequestPermissionRequest,
  SessionNotification,
  SessionUpdate,
} from "./acp";
import type { ThreadEvent } from "./types";

/** Maps one ACP `session/update` payload to normalized thread events. */
export function acpUpdateToEvents(update: SessionUpdate, at: number = Date.now()): ThreadEvent[] {
  switch (update.sessionUpdate) {
    case "user_message_chunk":
      return [
        {
          type: "message.chunk",
          at,
          role: "user",
          content: update.content,
          messageId: update.messageId,
        },
      ];
    case "agent_message_chunk":
      return [
        {
          type: "message.chunk",
          at,
          role: "assistant",
          content: update.content,
          messageId: update.messageId,
        },
      ];
    case "agent_thought_chunk":
      return [
        {
          type: "message.chunk",
          at,
          role: "reasoning",
          content: update.content,
          messageId: update.messageId,
        },
      ];
    case "tool_call":
    case "tool_call_update": {
      const { sessionUpdate: _kind, ...patch } = update;
      return [{ type: "tool.upsert", at, patch }];
    }
    case "plan":
      return [{ type: "plan.replaced", at, entries: update.entries }];
    case "available_commands_update":
      return [{ type: "commands.updated", at, commands: update.availableCommands }];
    case "current_mode_update":
      return [{ type: "mode.changed", at, modeId: update.currentModeId }];
    case "session_info_update":
      return [{ type: "session.info", at, title: update.title, updatedAt: update.updatedAt }];
    case "usage_update":
      return [
        { type: "usage.updated", at, used: update.used, size: update.size, cost: update.cost },
      ];
    case "config_option_update":
      return [];
    default:
      return [];
  }
}

export function acpNotificationToEvents(n: SessionNotification, at?: number): ThreadEvent[] {
  return acpUpdateToEvents(n.update, at);
}

export function acpPermissionRequestToEvent(
  requestId: string,
  request: RequestPermissionRequest,
  at: number = Date.now(),
): ThreadEvent {
  return {
    type: "permission.requested",
    at,
    requestId,
    toolCall: request.toolCall,
    options: request.options,
  };
}

export function acpPromptResponseToEvent(
  response: PromptResponseLike,
  turnId?: string,
  at: number = Date.now(),
): ThreadEvent {
  return { type: "turn.ended", at, turnId, stopReason: response.stopReason };
}
