import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAcpBridge,
  createThreadStore,
  turnFileDiffs,
  activeTurn,
  basename,
  diffTotals,
} from "@acp-render/core";
import {
  Composer,
  ContextMeter,
  DiffStat,
  InlineDiff,
  ThreadProvider,
  Timeline,
  useThreadState,
  X,
  cn,
} from "@acp-render/react";
import { runMockTurn } from "./mock-agent";

export function App() {
  const store = useMemo(() => createThreadStore(), []);
  const bridge = useMemo(() => createAcpBridge(store), [store]);
  return (
    <ThreadProvider store={store} bridge={bridge}>
      <Workbench store={store} bridge={bridge} />
    </ThreadProvider>
  );
}

function Workbench({
  store,
  bridge,
}: {
  store: ReturnType<typeof createThreadStore>;
  bridge: ReturnType<typeof createAcpBridge>;
}) {
  const running = useThreadState((s) => activeTurn(s) !== undefined);
  const usage = useThreadState((s) => s.usage);
  const commands = useThreadState((s) => s.commands);
  const [diff, setDiff] = useState<{ turnId: string; path?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    (text: string) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      const turnId = bridge.beginTurn([{ type: "text", text }]);
      runMockTurn(
        bridge,
        (terminalId, output, exitCode) =>
          store.dispatch({ type: "terminal.output", at: Date.now(), terminalId, output, exitCode }),
        text,
        ctrl.signal,
      )
        .then(() => bridge.endTurn("end_turn", turnId))
        .catch(() => bridge.endTurn("cancelled", turnId));
    },
    [bridge, store],
  );

  const autoplayed = useRef(false);
  useEffect(() => {
    if (autoplayed.current || !new URLSearchParams(location.search).has("autoplay")) return;
    autoplayed.current = true;
    send("Add an empty state and close button to the diff panel");
  }, [send]);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("allow")) return;
    return store.subscribe(() => {
      for (const id of Object.keys(store.getState().permissions))
        bridge.respondPermission(id, "allow");
    });
  }, [store, bridge]);

  const cancel = useCallback(() => {
    bridge.cancel();
    abort.current?.abort();
  }, [bridge]);

  return (
    <div className="acp-root flex h-full bg-acp-bg text-acp-fg">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-acp-border px-4 text-[13px]">
          <span className="font-medium">acp-render</span>
          <span className="rounded border border-acp-border px-1.5 text-[11px] text-acp-subtle">
            playground · mock agent
          </span>
        </header>
        <Timeline
          onOpenDiff={(turnId, path) => setDiff({ turnId, path })}
          empty={
            <div className="py-24 text-center text-sm text-acp-subtle">
              Send a message to replay a scripted ACP session (tool calls, plan, permission, diff,
              terminal).
            </div>
          }
        />
        <div className="mx-auto w-full max-w-3xl px-5 pb-5">
          <Composer
            onSubmit={send}
            onCancel={cancel}
            running={running}
            commands={commands}
            placeholder={running ? "Queue a follow-up…" : "Ask the mock agent to change something"}
            toolbar={<span>Mock agent</span>}
            trailing={<ContextMeter usage={usage} />}
          />
        </div>
      </main>
      {diff ? (
        <DiffPanel
          turnId={diff.turnId}
          path={diff.path}
          onSelect={(p) => setDiff({ ...diff, path: p })}
          onClose={() => setDiff(null)}
        />
      ) : null}
    </div>
  );
}

function DiffPanel({
  turnId,
  path,
  onSelect,
  onClose,
}: {
  turnId: string;
  path?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const state = useThreadState();
  const files = useMemo(() => turnFileDiffs(state, turnId), [state, turnId]);
  const totals = diffTotals(files);
  const turn = state.turns[turnId];
  return (
    <aside
      className="flex w-[46%] min-w-[380px] flex-col border-l border-acp-border bg-acp-bg"
      aria-label="Turn diff"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-acp-border px-3 text-[13px]">
        <span>Turn {(turn?.index ?? 0) + 1}</span>
        <DiffStat additions={totals.additions} deletions={totals.deletions} />
        <button
          type="button"
          aria-label="Close diff"
          onClick={onClose}
          className="ml-auto rounded p-1 text-acp-subtle hover:bg-acp-hover hover:text-acp-fg"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        {files.map((f) => (
          <section key={f.path} id={f.path}>
            <button
              type="button"
              onClick={() => onSelect(f.path)}
              className={cn(
                "acp-mono mb-1.5 flex w-full items-center gap-2 text-left text-[12px]",
                f.path === path ? "text-acp-fg" : "text-acp-muted",
              )}
            >
              <span className="truncate" title={f.path}>
                {basename(f.path)}
              </span>
              <DiffStat additions={f.additions} deletions={f.deletions} />
            </button>
            <InlineDiff file={f} />
          </section>
        ))}
      </div>
    </aside>
  );
}
