import type { AcpToolCallUpdate, ContentBlock } from "./acp";
import type {
  EntryRef,
  Message,
  ThreadEvent,
  ThreadState,
  ToolCall,
  ToolStatus,
  Turn,
} from "./types";

export const initialThreadState: ThreadState = {
  turns: {},
  turnOrder: [],
  messages: {},
  tools: {},
  plans: {},
  entries: [],
  permissions: {},
  terminals: {},
  commands: [],
  seq: 0,
};

export function createThreadState(): ThreadState {
  return initialThreadState;
}

export function isTerminalToolStatus(status: ToolStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function activeTurn(state: ThreadState): Turn | undefined {
  const id = state.turnOrder[state.turnOrder.length - 1];
  const turn = id === undefined ? undefined : state.turns[id];
  return turn && turn.status !== "ended" ? turn : undefined;
}

function nextId(state: ThreadState, prefix: string): [ThreadState, string] {
  const seq = state.seq + 1;
  return [{ ...state, seq }, `${prefix}-${seq}`];
}

function endTurn(
  state: ThreadState,
  turn: Turn,
  at: number,
  patch: Partial<Pick<Turn, "stopReason" | "error">>,
): ThreadState {
  const cancelled = patch.stopReason === "cancelled";
  let tools = state.tools;
  if (cancelled) tools = cancelOpenTools(state, turn.id, at);
  return {
    ...state,
    tools,
    permissions: dropTurnPermissions(state, turn.id),
    turns: { ...state.turns, [turn.id]: { ...turn, ...patch, status: "ended", endedAt: at } },
  };
}

function cancelOpenTools(state: ThreadState, turnId: string, at: number): ThreadState["tools"] {
  let tools = state.tools;
  for (const tool of Object.values(state.tools)) {
    if (tool.turnId === turnId && !isTerminalToolStatus(tool.status)) {
      if (tools === state.tools) tools = { ...state.tools };
      (tools as Record<string, ToolCall>)[tool.id] = {
        ...tool,
        status: "cancelled",
        updatedAt: at,
        endedAt: at,
      };
    }
  }
  return tools;
}

function dropTurnPermissions(state: ThreadState, turnId: string): ThreadState["permissions"] {
  const entries = Object.entries(state.permissions);
  if (!entries.some(([, p]) => p.turnId === turnId)) return state.permissions;
  return Object.fromEntries(entries.filter(([, p]) => p.turnId !== turnId));
}

function startTurn(state: ThreadState, id: string, at: number, implicit: boolean): ThreadState {
  const turn: Turn = {
    id,
    index: state.turnOrder.length,
    status: "running",
    startedAt: at,
    implicit,
  };
  return { ...state, turns: { ...state.turns, [id]: turn }, turnOrder: [...state.turnOrder, id] };
}

/** Returns the running turn, opening an implicit one (history replay) if necessary. */
function ensureTurn(state: ThreadState, at: number, forUserMessage: boolean): [ThreadState, Turn] {
  const current = activeTurn(state);
  if (current) {
    if (!(forUserMessage && current.implicit && turnHasNonUserEntries(state, current.id))) {
      return [state, current];
    }
    state = endTurn(state, current, at, { stopReason: "end_turn" });
  }
  const [s, id] = nextId(state, "turn");
  const next = startTurn(s, id, at, true);
  return [next, next.turns[id]!];
}

function turnHasNonUserEntries(state: ThreadState, turnId: string): boolean {
  return state.entries.some(
    (e) => e.turnId === turnId && !(e.kind === "message" && state.messages[e.id]?.role === "user"),
  );
}

export function appendContent(
  content: readonly ContentBlock[],
  block: ContentBlock,
): ContentBlock[] {
  const last = content[content.length - 1];
  if (last && last.type === "text" && block.type === "text") {
    return [...content.slice(0, -1), { ...last, text: last.text + block.text }];
  }
  return [...content, block];
}

function applyChunk(
  state: ThreadState,
  e: Extract<ThreadEvent, { type: "message.chunk" }>,
): ThreadState {
  if (e.messageId && state.messages[e.messageId]) {
    const msg = state.messages[e.messageId]!;
    return {
      ...state,
      messages: {
        ...state.messages,
        [msg.id]: { ...msg, content: appendContent(msg.content, e.content), updatedAt: e.at },
      },
    };
  }
  let turn: Turn;
  [state, turn] = ensureTurn(state, e.at, e.role === "user");
  const last = state.entries[state.entries.length - 1];
  const open = last?.kind === "message" ? state.messages[last.id] : undefined;
  if (open && open.turnId === turn.id && open.role === e.role && !e.messageId) {
    return {
      ...state,
      messages: {
        ...state.messages,
        [open.id]: { ...open, content: appendContent(open.content, e.content), updatedAt: e.at },
      },
    };
  }
  let id = e.messageId ?? undefined;
  if (!id) [state, id] = nextId(state, "msg");
  const msg: Message = {
    id,
    turnId: turn.id,
    role: e.role,
    content: [e.content],
    createdAt: e.at,
    updatedAt: e.at,
  };
  return {
    ...state,
    messages: { ...state.messages, [id]: msg },
    entries: [...state.entries, { kind: "message", id, turnId: turn.id }],
  };
}

function applyToolPatch(state: ThreadState, patch: AcpToolCallUpdate, at: number): ThreadState {
  const prev = state.tools[patch.toolCallId];
  if (prev) {
    const status = patch.status ?? prev.status;
    const next: ToolCall = {
      ...prev,
      title: patch.title ?? prev.title,
      name: patch.name ?? prev.name,
      kind: patch.kind ?? prev.kind,
      status,
      content: patch.content ?? prev.content,
      locations: patch.locations ?? prev.locations,
      rawInput: patch.rawInput !== undefined ? patch.rawInput : prev.rawInput,
      rawOutput: patch.rawOutput !== undefined ? patch.rawOutput : prev.rawOutput,
      updatedAt: at,
      endedAt: isTerminalToolStatus(status) ? (prev.endedAt ?? at) : undefined,
    };
    return { ...state, tools: { ...state.tools, [prev.id]: next } };
  }
  let turn: Turn;
  [state, turn] = ensureTurn(state, at, false);
  const status = patch.status ?? "pending";
  const tool: ToolCall = {
    id: patch.toolCallId,
    turnId: turn.id,
    title: patch.title ?? patch.name ?? "Tool call",
    name: patch.name ?? undefined,
    kind: patch.kind ?? "other",
    status,
    content: patch.content ?? [],
    locations: patch.locations ?? [],
    rawInput: patch.rawInput,
    rawOutput: patch.rawOutput,
    createdAt: at,
    updatedAt: at,
    endedAt: isTerminalToolStatus(status) ? at : undefined,
  };
  const ref: EntryRef = { kind: "tool", id: tool.id, turnId: turn.id };
  return { ...state, tools: { ...state.tools, [tool.id]: tool }, entries: [...state.entries, ref] };
}

export function reduceThread(state: ThreadState, e: ThreadEvent): ThreadState {
  switch (e.type) {
    case "turn.started": {
      const current = activeTurn(state);
      if (current) state = endTurn(state, current, e.at, { stopReason: "end_turn" });
      if (state.turns[e.turnId]) return state;
      state = startTurn(state, e.turnId, e.at, false);
      if (e.prompt?.length) {
        const id = `${e.turnId}:prompt`;
        const msg: Message = {
          id,
          turnId: e.turnId,
          role: "user",
          content: e.prompt.reduce<ContentBlock[]>((acc, b) => appendContent(acc, b), []),
          createdAt: e.at,
          updatedAt: e.at,
        };
        state = {
          ...state,
          messages: { ...state.messages, [id]: msg },
          entries: [...state.entries, { kind: "message", id, turnId: e.turnId }],
        };
      }
      return state;
    }
    case "turn.cancelling": {
      const turn = e.turnId ? state.turns[e.turnId] : activeTurn(state);
      if (!turn || turn.status === "ended") return state;
      return {
        ...state,
        tools: cancelOpenTools(state, turn.id, e.at),
        permissions: dropTurnPermissions(state, turn.id),
        turns: { ...state.turns, [turn.id]: { ...turn, status: "cancelling" } },
      };
    }
    case "turn.ended": {
      const turn = e.turnId ? state.turns[e.turnId] : activeTurn(state);
      if (!turn || turn.status === "ended") return state;
      return endTurn(state, turn, e.at, { stopReason: e.stopReason, error: e.error });
    }
    case "session.loaded": {
      const turn = activeTurn(state);
      return turn?.implicit ? endTurn(state, turn, e.at, { stopReason: "end_turn" }) : state;
    }
    case "message.chunk":
      return applyChunk(state, e);
    case "tool.upsert":
      return applyToolPatch(state, e.patch, e.at);
    case "plan.replaced": {
      let turn: Turn;
      [state, turn] = ensureTurn(state, e.at, false);
      const id = `${turn.id}:plan`;
      const exists = state.plans[id];
      return {
        ...state,
        plans: {
          ...state.plans,
          [id]: { id, turnId: turn.id, entries: e.entries, updatedAt: e.at },
        },
        entries: exists ? state.entries : [...state.entries, { kind: "plan", id, turnId: turn.id }],
      };
    }
    case "permission.requested": {
      state = applyToolPatch(state, e.toolCall, e.at);
      const tool = state.tools[e.toolCall.toolCallId]!;
      return {
        ...state,
        permissions: {
          ...state.permissions,
          [e.requestId]: {
            requestId: e.requestId,
            turnId: tool.turnId,
            toolCallId: tool.id,
            options: e.options,
            requestedAt: e.at,
          },
        },
      };
    }
    case "permission.resolved": {
      if (!state.permissions[e.requestId]) return state;
      const { [e.requestId]: _removed, ...rest } = state.permissions;
      return { ...state, permissions: rest };
    }
    case "terminal.output": {
      const prev = state.terminals[e.terminalId];
      const output = e.append && prev ? prev.output + e.output : e.output;
      return {
        ...state,
        terminals: {
          ...state.terminals,
          [e.terminalId]: {
            terminalId: e.terminalId,
            output,
            exitCode: e.exitCode !== undefined ? e.exitCode : prev?.exitCode,
          },
        },
      };
    }
    case "usage.updated":
      return { ...state, usage: { used: e.used, size: e.size, cost: e.cost } };
    case "mode.changed":
      return { ...state, modeId: e.modeId };
    case "commands.updated":
      return { ...state, commands: e.commands };
    case "session.info":
      return e.title != null ? { ...state, title: e.title } : state;
  }
}

export function reduceThreadEvents(state: ThreadState, events: Iterable<ThreadEvent>): ThreadState {
  for (const e of events) state = reduceThread(state, e);
  return state;
}
