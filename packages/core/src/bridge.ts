import type {
  ContentBlock,
  PromptResponseLike,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  StopReason,
} from "./acp";
import { acpNotificationToEvents, acpPermissionRequestToEvent } from "./adapter";
import { activeTurn } from "./reducer";
import type { ThreadStore } from "./store";

export interface AcpBridgeOptions {
  now?: () => number;
  /** Only accept notifications for this session id. */
  sessionId?: string;
}

/**
 * Glue between an ACP client connection and a ThreadStore.
 *
 * `sessionUpdate` and `requestPermission` match the ACP `Client` interface, so the
 * bridge can be spread into the client handlers passed to `ClientSideConnection`.
 */
export interface AcpBridge {
  sessionUpdate(params: SessionNotification): Promise<void>;
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  /** Resolve a pending permission request from the UI; `null` means cancelled. */
  respondPermission(requestId: string, optionId: string | null): void;
  /** Record a new prompt turn. Returns its id. */
  beginTurn(prompt: ContentBlock[], turnId?: string): string;
  /** Record `session/prompt` completion. */
  endTurn(response: PromptResponseLike | StopReason, turnId?: string): void;
  /** Record a turn error (the prompt request rejected). */
  failTurn(error: unknown, turnId?: string): void;
  /** Mark the active turn as cancelling; resolves pending permission requests as cancelled. */
  cancel(): void;
  /** Settle turns replayed by `session/load`. */
  loaded(): void;
}

export function createAcpBridge(store: ThreadStore, options: AcpBridgeOptions = {}): AcpBridge {
  const now = options.now ?? Date.now;
  const pending = new Map<string, (r: RequestPermissionResponse) => void>();
  let seq = 0;

  const respond = (requestId: string, optionId: string | null) => {
    const resolve = pending.get(requestId);
    if (!resolve) return;
    pending.delete(requestId);
    store.dispatch({ type: "permission.resolved", at: now(), requestId, optionId });
    resolve({
      outcome: optionId == null ? { outcome: "cancelled" } : { outcome: "selected", optionId },
    });
  };

  const cancelAll = () => {
    for (const id of [...pending.keys()]) respond(id, null);
  };

  return {
    async sessionUpdate(params) {
      if (options.sessionId && params.sessionId !== options.sessionId) return;
      store.dispatch(acpNotificationToEvents(params, now()));
    },
    requestPermission(params) {
      const requestId = `perm-${++seq}`;
      return new Promise<RequestPermissionResponse>((resolve) => {
        pending.set(requestId, resolve);
        store.dispatch(acpPermissionRequestToEvent(requestId, params, now()));
      });
    },
    respondPermission: respond,
    beginTurn(prompt, turnId) {
      const id = turnId ?? `turn-${now()}-${++seq}`;
      store.dispatch({ type: "turn.started", at: now(), turnId: id, prompt });
      return id;
    },
    endTurn(response, turnId) {
      const stopReason = typeof response === "string" ? response : response.stopReason;
      if (stopReason === "cancelled") cancelAll();
      store.dispatch({ type: "turn.ended", at: now(), turnId, stopReason });
    },
    failTurn(error, turnId) {
      cancelAll();
      const message = error instanceof Error ? error.message : String(error);
      store.dispatch({
        type: "turn.ended",
        at: now(),
        turnId,
        stopReason: "end_turn",
        error: message,
      });
    },
    cancel() {
      if (!activeTurn(store.getState())) return;
      cancelAll();
      store.dispatch({ type: "turn.cancelling", at: now() });
    },
    loaded() {
      store.dispatch({ type: "session.loaded", at: now() });
    },
  };
}
