import type { AcpBridge, SessionUpdate } from "@acp-render/core";

/**
 * Local, scripted stand-in for an ACP agent. It speaks real ACP `session/update`
 * payloads to the bridge so the UI path is identical to a live connection.
 */
type Step =
  | { delay: number; update: SessionUpdate }
  | { delay: number; stream: string; role: "agent" | "thought"; chunk?: number }
  | { delay: number; permission: { toolCallId: string; title: string } }
  | { delay: number; terminal: { id: string; lines: string[]; exitCode: number } };

const oldPanel = `export function DiffPanel({ turn }: Props) {
  const files = turn.files;
  return (
    <aside className="diff">
      {files.map((f) => <File key={f.path} file={f} />)}
    </aside>
  );
}
`;
const newPanel = `export function DiffPanel({ turn, onClose }: Props) {
  const files = useTurnFiles(turn.id);
  if (files.length === 0) return <Empty />;
  return (
    <aside className="diff" aria-label="Turn diff">
      <Header turn={turn} onClose={onClose} />
      {files.map((f) => <File key={f.path} file={f} />)}
    </aside>
  );
}
`;
const newPanel2 = newPanel.replace(
  'aria-label="Turn diff"',
  "aria-label={`Diff for turn ${turn.index + 1}`}",
);

function script(prompt: string): Step[] {
  const n = Math.floor(Math.random() * 1e6);
  const id = (s: string) => `${s}-${n}`;
  return [
    {
      delay: 300,
      stream:
        "The user wants: " + prompt + ". I should inspect the diff panel, then run the tests.",
      role: "thought",
      chunk: 6,
    },
    {
      delay: 200,
      update: {
        sessionUpdate: "plan",
        entries: [
          {
            content: "Inspect DiffPanel and turn file state",
            priority: "high",
            status: "in_progress",
          },
          {
            content: "Implement empty state and close button",
            priority: "medium",
            status: "pending",
          },
          { content: "Run the test suite", priority: "medium", status: "pending" },
        ],
      },
    },
    {
      delay: 250,
      stream: "I'll start by reading the diff panel and the hook that feeds it.",
      role: "agent",
    },
    {
      delay: 200,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("r1"),
        title: "Read src/DiffPanel.tsx",
        kind: "read",
        status: "in_progress",
        locations: [{ path: "/repo/src/DiffPanel.tsx" }],
      },
    },
    {
      delay: 350,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: id("r1"),
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: oldPanel } }],
      },
    },
    {
      delay: 150,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("r2"),
        title: "Read src/useTurnFiles.ts",
        kind: "read",
        status: "in_progress",
        locations: [{ path: "/repo/src/useTurnFiles.ts", line: 12 }],
      },
    },
    {
      delay: 300,
      update: { sessionUpdate: "tool_call_update", toolCallId: id("r2"), status: "completed" },
    },
    {
      delay: 150,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("s1"),
        title: 'Search "turn.files"',
        kind: "search",
        status: "completed",
        content: [
          {
            type: "content",
            content: { type: "text", text: "src/DiffPanel.tsx:2\nsrc/Timeline.tsx:88" },
          },
        ],
      },
    },
    {
      delay: 250,
      update: {
        sessionUpdate: "plan",
        entries: [
          {
            content: "Inspect DiffPanel and turn file state",
            priority: "high",
            status: "completed",
          },
          {
            content: "Implement empty state and close button",
            priority: "medium",
            status: "in_progress",
          },
          { content: "Run the test suite", priority: "medium", status: "pending" },
        ],
      },
    },
    {
      delay: 200,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("e1"),
        title: "Edit src/DiffPanel.tsx",
        kind: "edit",
        status: "pending",
        locations: [{ path: "/repo/src/DiffPanel.tsx" }],
      },
    },
    { delay: 200, permission: { toolCallId: id("e1"), title: "Edit src/DiffPanel.tsx" } },
    {
      delay: 300,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: id("e1"),
        status: "completed",
        content: [
          { type: "diff", path: "/repo/src/DiffPanel.tsx", oldText: oldPanel, newText: newPanel },
        ],
      },
    },
    {
      delay: 200,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("e2"),
        title: "Edit src/DiffPanel.tsx",
        kind: "edit",
        status: "completed",
        content: [
          { type: "diff", path: "/repo/src/DiffPanel.tsx", oldText: newPanel, newText: newPanel2 },
        ],
      },
    },
    {
      delay: 200,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("e3"),
        title: "Create src/Empty.tsx",
        kind: "edit",
        status: "completed",
        content: [
          {
            type: "diff",
            path: "/repo/src/Empty.tsx",
            oldText: null,
            newText:
              'export const Empty = () => <p className="muted">No changes in this turn</p>;\n',
          },
        ],
      },
    },
    {
      delay: 200,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: id("x1"),
        title: "pnpm test",
        kind: "execute",
        status: "in_progress",
        content: [{ type: "terminal", terminalId: id("term") }],
      },
    },
    {
      delay: 100,
      terminal: {
        id: id("term"),
        exitCode: 0,
        lines: [
          "> vitest run",
          "",
          " ✓ DiffPanel.test.tsx (4 tests)",
          " ✓ turnFiles.test.ts (6 tests)",
          "",
          " Test Files  2 passed (2)",
          "      Tests  10 passed (10)",
        ],
      },
    },
    {
      delay: 100,
      update: { sessionUpdate: "tool_call_update", toolCallId: id("x1"), status: "completed" },
    },
    {
      delay: 150,
      update: {
        sessionUpdate: "plan",
        entries: [
          {
            content: "Inspect DiffPanel and turn file state",
            priority: "high",
            status: "completed",
          },
          {
            content: "Implement empty state and close button",
            priority: "medium",
            status: "completed",
          },
          { content: "Run the test suite", priority: "medium", status: "completed" },
        ],
      },
    },
    {
      delay: 100,
      update: { sessionUpdate: "usage_update", used: 48200 + (n % 20000), size: 200000 },
    },
    {
      delay: 250,
      stream:
        "Done. `DiffPanel` now reads files through `useTurnFiles`, renders an empty state, and has a close button:\n\n" +
        "- **Empty state** when the turn has no file changes\n- **Header** with turn label and close action\n- Accessible label per turn\n\n" +
        "```tsx\nif (files.length === 0) return <Empty />;\n```\n\nAll 10 tests pass.",
      role: "agent",
    },
  ];
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

export async function runMockTurn(
  bridge: AcpBridge,
  dispatchTerminal: (id: string, output: string, exitCode?: number) => void,
  prompt: string,
  signal: AbortSignal,
  speed = 1,
): Promise<void> {
  const send = (update: SessionUpdate) => bridge.sessionUpdate({ sessionId: "demo", update });
  for (const step of script(prompt)) {
    await sleep(step.delay / speed, signal);
    if ("update" in step) await send(step.update);
    else if ("stream" in step) {
      const words = step.stream.split(/(?<=\s)/);
      const size = step.chunk ?? 2;
      for (let i = 0; i < words.length; i += size) {
        await sleep(35 / speed, signal);
        await send({
          sessionUpdate: step.role === "agent" ? "agent_message_chunk" : "agent_thought_chunk",
          content: { type: "text", text: words.slice(i, i + size).join("") },
        });
      }
    } else if ("permission" in step) {
      const res = await bridge.requestPermission({
        sessionId: "demo",
        toolCall: {
          toolCallId: step.permission.toolCallId,
          title: step.permission.title,
          kind: "edit",
        },
        options: [
          { optionId: "allow", name: "Allow", kind: "allow_once" },
          { optionId: "always", name: "Always allow", kind: "allow_always" },
          { optionId: "reject", name: "Reject", kind: "reject_once" },
        ],
      });
      if (res.outcome.outcome !== "selected" || res.outcome.optionId === "reject") {
        await send({
          sessionUpdate: "tool_call_update",
          toolCallId: step.permission.toolCallId,
          status: "failed",
          content: [{ type: "content", content: { type: "text", text: "Rejected by user" } }],
        });
        await send({
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Understood — I left the file untouched." },
        });
        return;
      }
    } else {
      let out = "";
      for (const line of step.terminal.lines) {
        await sleep(120 / speed, signal);
        out += line + "\n";
        dispatchTerminal(step.terminal.id, out);
      }
      dispatchTerminal(step.terminal.id, out, step.terminal.exitCode);
    }
  }
}
