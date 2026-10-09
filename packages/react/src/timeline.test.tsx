import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAcpBridge, createThreadStore, type ThreadStore } from "@acp-render/core";
import { Composer, MarkdownProvider, ThreadProvider, Timeline, closeOpenFences } from "./index";

afterEach(cleanup);

const Plain = ({ children }: { children: string }) => <div>{children}</div>;

function mount(store: ThreadStore, bridge = createAcpBridge(store)) {
  return render(
    <MarkdownProvider value={Plain}>
      <ThreadProvider store={store} bridge={bridge}>
        <Timeline />
      </ThreadProvider>
    </MarkdownProvider>,
  );
}

describe("Timeline", () => {
  it("updates a tool row in place and folds the turn once settled", async () => {
    const store = createThreadStore();
    const bridge = createAcpBridge(store);
    mount(store, bridge);
    act(() => {
      bridge.beginTurn([{ type: "text", text: "Fix the bug" }], "t1");
      void bridge.sessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "c1",
          title: "npm test",
          kind: "execute",
          status: "in_progress",
        },
      });
    });
    expect(screen.getByText("Fix the bug")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Working");
    act(() => {
      void bridge.sessionUpdate({
        sessionId: "s",
        update: { sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed" },
      });
    });
    const rows = document.querySelectorAll('[data-acp-tool-id="c1"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-acp-tool-status")).toBe("completed");

    act(() => {
      void bridge.sessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "All green." },
        },
      });
      bridge.endTurn({ stopReason: "end_turn" });
    });
    expect(document.querySelector('[data-acp-tool-id="c1"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Worked for/ }));
    expect(document.querySelector('[data-acp-tool-id="c1"]')).not.toBeNull();
  });

  it("routes permission clicks to the bridge", async () => {
    const store = createThreadStore();
    const bridge = createAcpBridge(store);
    mount(store, bridge);
    let pending!: Promise<unknown>;
    act(() => {
      bridge.beginTurn([{ type: "text", text: "go" }]);
      pending = bridge.requestPermission({
        sessionId: "s",
        toolCall: { toolCallId: "c1", title: "rm file", kind: "delete" },
        options: [
          { optionId: "ok", name: "Allow once", kind: "allow_once" },
          { optionId: "no", name: "Reject", kind: "reject_once" },
        ],
      });
    });
    act(() => fireEvent.click(screen.getByRole("button", { name: "Allow once" })));
    await expect(pending).resolves.toEqual({ outcome: { outcome: "selected", optionId: "ok" } });
    expect(screen.queryByRole("group", { name: "Permission request" })).toBeNull();
  });
});

describe("Composer", () => {
  it("submits on Enter, keeps newline on Shift+Enter and ignores IME composition", () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionStart(box);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(box);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("hello", [{ type: "text", text: "hello" }]);
  });

  it("shows stop while running", () => {
    const onCancel = vi.fn();
    render(<Composer onSubmit={() => {}} onCancel={onCancel} running />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("closeOpenFences", () => {
  it("closes an unterminated code fence", () => {
    expect(closeOpenFences("a\n```ts\nx")).toBe("a\n```ts\nx\n```");
    expect(closeOpenFences("```\nx\n```")).toBe("```\nx\n```");
  });
});
