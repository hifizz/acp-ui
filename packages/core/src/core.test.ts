import { describe, expect, it } from "vitest";
import {
  acpUpdateToEvents,
  aggregateFileDiffs,
  createAcpBridge,
  createThreadStore,
  deriveRows,
  initialThreadState,
  reduceThreadEvents,
  type SessionUpdate,
  type ThreadEvent,
  type ThreadState,
} from "./index";

let t = 0;
const at = () => ++t * 1000;
const u = (update: SessionUpdate): ThreadEvent[] => acpUpdateToEvents(update, at());
const text = (s: string) => ({ type: "text" as const, text: s });

function run(events: ThreadEvent[]): ThreadState {
  return reduceThreadEvents(initialThreadState, events);
}

describe("reducer", () => {
  it("merges consecutive chunks of the same role and splits on role changes", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at(), prompt: [text("hi")] },
      ...u({ sessionUpdate: "agent_thought_chunk", content: text("think ") }),
      ...u({ sessionUpdate: "agent_thought_chunk", content: text("more") }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("Hel") }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("lo") }),
    ]);
    const msgs = s.entries.map((e) => s.messages[e.id]!);
    expect(msgs.map((m) => m.role)).toEqual(["user", "reasoning", "assistant"]);
    expect(msgs[1]!.content).toEqual([text("think more")]);
    expect(msgs[2]!.content).toEqual([text("Hello")]);
  });

  it("honours messageId and starts a new message after a tool call", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({ sessionUpdate: "agent_message_chunk", content: text("a"), messageId: "m1" }),
      ...u({ sessionUpdate: "tool_call", toolCallId: "c1", title: "Read", kind: "read" }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("b") }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("!"), messageId: "m1" }),
    ]);
    expect(s.entries.map((e) => e.kind)).toEqual(["message", "tool", "message"]);
    expect(s.messages.m1!.content).toEqual([text("a!")]);
  });

  it("updates a tool call in place and ignores null fields", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({
        sessionUpdate: "tool_call",
        toolCallId: "c1",
        title: "Run tests",
        kind: "execute",
        status: "pending",
      }),
      ...u({
        sessionUpdate: "tool_call_update",
        toolCallId: "c1",
        status: "in_progress",
        title: null,
      }),
      ...u({
        sessionUpdate: "tool_call_update",
        toolCallId: "c1",
        status: "completed",
        content: [{ type: "content", content: text("ok") }],
      }),
    ]);
    expect(s.entries).toHaveLength(1);
    expect(s.tools.c1).toMatchObject({ title: "Run tests", kind: "execute", status: "completed" });
    expect(s.tools.c1!.endedAt).toBeDefined();
  });

  it("replaces the plan in place", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({
        sessionUpdate: "plan",
        entries: [{ content: "a", priority: "high", status: "pending" }],
      }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("x") }),
      ...u({
        sessionUpdate: "plan",
        entries: [{ content: "a", priority: "high", status: "completed" }],
      }),
    ]);
    expect(s.entries.map((e) => e.kind)).toEqual(["plan", "message"]);
    expect(s.plans["t1:plan"]!.entries[0]!.status).toBe("completed");
  });

  it("marks open tools cancelled and drops permissions when cancelling", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({ sessionUpdate: "tool_call", toolCallId: "c1", title: "a", status: "in_progress" }),
      ...u({ sessionUpdate: "tool_call", toolCallId: "c2", title: "b", status: "completed" }),
      {
        type: "permission.requested",
        at: at(),
        requestId: "p1",
        toolCall: { toolCallId: "c1" },
        options: [{ optionId: "y", name: "Allow", kind: "allow_once" }],
      },
      { type: "turn.cancelling", at: at() },
      { type: "turn.ended", at: at(), stopReason: "cancelled" },
    ]);
    expect(s.tools.c1!.status).toBe("cancelled");
    expect(s.tools.c2!.status).toBe("completed");
    expect(s.permissions).toEqual({});
    expect(s.turns.t1).toMatchObject({ status: "ended", stopReason: "cancelled" });
  });

  it("reconstructs implicit turns from session/load replay", () => {
    const s = run([
      ...u({ sessionUpdate: "user_message_chunk", content: text("q1") }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("a1") }),
      ...u({ sessionUpdate: "user_message_chunk", content: text("q2") }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("a2") }),
      { type: "session.loaded", at: at() },
    ]);
    expect(s.turnOrder).toHaveLength(2);
    expect(Object.values(s.turns).every((x) => x.status === "ended" && x.implicit)).toBe(true);
  });

  it("keeps untouched objects referentially stable", () => {
    const a = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({ sessionUpdate: "tool_call", toolCallId: "c1", title: "a" }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("x") }),
    ]);
    const b = reduceThreadEvents(
      a,
      u({ sessionUpdate: "agent_message_chunk", content: text("y") }),
    );
    expect(b.tools.c1).toBe(a.tools.c1);
  });
});

const diffTool = (
  id: string,
  path: string,
  oldText: string | null,
  newText: string,
): ThreadEvent[] =>
  u({
    sessionUpdate: "tool_call",
    toolCallId: id,
    title: `Edit ${path}`,
    kind: "edit",
    status: "completed",
    content: [{ type: "diff", path, oldText, newText }],
  });

describe("diff aggregation", () => {
  it("diffs first oldText against last newText per path", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...diffTool("e1", "/a.ts", "one\ntwo\n", "one\nTWO\n"),
      ...diffTool("e2", "/a.ts", "one\nTWO\n", "one\ntwo\n"),
      ...diffTool("e3", "/b.ts", "x\n", "x\ny\n"),
      ...diffTool("e4", "/c.ts", null, "new\n"),
    ]);
    const files = aggregateFileDiffs(Object.values(s.tools));
    expect(files.map((f) => [f.path, f.status, f.additions, f.deletions])).toEqual([
      ["/b.ts", "modified", 1, 0],
      ["/c.ts", "added", 1, 0],
    ]);
  });
});

describe("rows", () => {
  const settledTurn = (): ThreadState =>
    run([
      { type: "turn.started", turnId: "t1", at: 0, prompt: [text("fix it")] },
      ...u({ sessionUpdate: "agent_message_chunk", content: text("Looking.") }),
      ...u({
        sessionUpdate: "tool_call",
        toolCallId: "r1",
        title: "Read a",
        kind: "read",
        status: "completed",
      }),
      ...u({
        sessionUpdate: "tool_call",
        toolCallId: "r2",
        title: "Read b",
        kind: "read",
        status: "completed",
      }),
      ...u({
        sessionUpdate: "tool_call",
        toolCallId: "x1",
        title: "npm test",
        kind: "execute",
        status: "failed",
      }),
      ...diffTool("e1", "/a.ts", "a\n", "b\n"),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("Middle") }),
      ...u({
        sessionUpdate: "tool_call",
        toolCallId: "x2",
        title: "npm test",
        kind: "execute",
        status: "completed",
      }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("Done.") }),
      { type: "turn.ended", at: 60_000, stopReason: "end_turn" },
    ]);

  it("folds settled turns, keeping first/last assistant and failed tools", () => {
    const rows = deriveRows(settledTurn());
    expect(rows.map((r) => r.kind)).toEqual([
      "user-message",
      "assistant-message",
      "turn-fold",
      "tool",
      "assistant-message",
      "changed-files",
    ]);
    const fold = rows.find((r) => r.kind === "turn-fold");
    expect(fold).toMatchObject({ durationMs: 60_000, hiddenCount: 5, toolCount: 4 });
  });

  it("expands a folded turn and groups consecutive reads", () => {
    const rows = deriveRows(settledTurn(), { expandedTurns: new Set(["t1"]) });
    expect(rows.map((r) => r.kind)).toEqual([
      "user-message",
      "assistant-message",
      "turn-fold",
      "tool-group",
      "tool",
      "tool",
      "assistant-message",
      "tool",
      "assistant-message",
      "changed-files",
    ]);
  });

  it("never folds a running turn and marks the tail message streaming", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({ sessionUpdate: "tool_call", toolCallId: "c1", title: "a", kind: "execute" }),
      ...u({ sessionUpdate: "agent_message_chunk", content: text("partial") }),
    ]);
    const rows = deriveRows(s);
    expect(rows.map((r) => r.kind)).toEqual(["tool", "assistant-message", "working"]);
    expect(rows[1]).toMatchObject({ streaming: true, isFinal: false });
  });

  it("shows a status row for non end_turn stop reasons", () => {
    const s = run([
      { type: "turn.started", turnId: "t1", at: at() },
      ...u({ sessionUpdate: "agent_message_chunk", content: text("no") }),
      { type: "turn.ended", at: at(), stopReason: "refusal" },
    ]);
    expect(deriveRows(s).at(-1)).toMatchObject({ kind: "turn-status", stopReason: "refusal" });
  });
});

describe("bridge", () => {
  it("resolves permission requests through the store", async () => {
    const store = createThreadStore();
    const bridge = createAcpBridge(store);
    bridge.beginTurn([text("go")], "t1");
    const pending = bridge.requestPermission({
      sessionId: "s",
      toolCall: { toolCallId: "c1", title: "rm -rf build", kind: "execute" },
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" },
        { optionId: "deny", name: "Deny", kind: "reject_once" },
      ],
    });
    const [request] = Object.values(store.getState().permissions);
    expect(request?.toolCallId).toBe("c1");
    bridge.respondPermission(request!.requestId, "allow");
    await expect(pending).resolves.toEqual({ outcome: { outcome: "selected", optionId: "allow" } });
    expect(store.getState().permissions).toEqual({});
  });

  it("answers pending permissions with cancelled on cancel", async () => {
    const store = createThreadStore();
    const bridge = createAcpBridge(store);
    bridge.beginTurn([text("go")]);
    const pending = bridge.requestPermission({
      sessionId: "s",
      toolCall: { toolCallId: "c1" },
      options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
    });
    bridge.cancel();
    await expect(pending).resolves.toEqual({ outcome: { outcome: "cancelled" } });
  });
});
