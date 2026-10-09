# acp-render

React UI components for [Agent Client Protocol (ACP)](https://agentclientprotocol.com) sessions: the
conversation timeline, streaming markdown, reasoning, tool calls with in-place updates, tool groups,
plans, permission prompts, per-tool and per-turn diffs, terminal output and the prompt composer.

| Package             | What                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `@acp-render/core`  | Framework-agnostic: ACP → event adapter, immutable reducer, presentation rows (folding / grouping), diff aggregation, ACP client bridge. |
| `@acp-render/react` | React components, Tailwind v4 theme / v3 preset, lazy built-in markdown.                                                                 |
| shadcn registry     | Copy the component sources into your app (`npx shadcn add …`).                                                                           |

```text
ACP session/update ─► acpUpdateToEvents ─► reduceThread (ThreadState) ─► deriveRows (Row[]) ─► <Timeline/>
```

## Install

```sh
pnpm add @acp-render/core @acp-render/react
```

Tailwind v4 (`app.css`):

```css
@import "tailwindcss";
@import "@acp-render/react/theme.css";
```

Tailwind v3: add `presets: [require("@acp-render/react/tailwind-preset").default]`, include
`node_modules/@acp-render/react/dist/**/*.js` in `content`, and import `@acp-render/react/tokens.css`.

## Usage with an ACP connection

```tsx
import { ClientSideConnection } from "@agentclientprotocol/sdk";
import { createAcpBridge, createThreadStore } from "@acp-render/core";
import { Composer, ThreadProvider, Timeline, useThreadState } from "@acp-render/react";

const store = createThreadStore();
const bridge = createAcpBridge(store, { sessionId });

const connection = new ClientSideConnection(
  () => ({
    ...otherClientHandlers,
    sessionUpdate: bridge.sessionUpdate,
    requestPermission: bridge.requestPermission,
  }),
  stream,
);

async function prompt(blocks) {
  const turnId = bridge.beginTurn(blocks);
  try {
    bridge.endTurn(await connection.prompt({ sessionId, prompt: blocks }), turnId);
  } catch (err) {
    bridge.failTurn(err, turnId);
  }
}

function Session() {
  const running = useThreadState(
    (s) => s.turnOrder.length > 0 && s.turns[s.turnOrder.at(-1)!]!.status !== "ended",
  );
  return (
    <div className="acp-root flex h-full flex-col bg-acp-bg text-acp-fg">
      <Timeline onOpenDiff={(turnId, path) => openDiffPanel(turnId, path)} />
      <Composer
        running={running}
        onSubmit={(_text, blocks) => prompt(blocks)}
        onCancel={() => {
          bridge.cancel();
          void connection.cancel({ sessionId });
        }}
      />
    </div>
  );
}

<ThreadProvider store={store} bridge={bridge}>
  <Session />
</ThreadProvider>;
```

`@acp-render/core` only depends on ACP's JSON shapes (structural types), not on the SDK, so any
transport works: dispatch `acpUpdateToEvents(update)` into the store yourself.

## Behaviour

- **Stable tool identity** – `tool_call` / `tool_call_update` upsert by `toolCallId`; `null`/omitted fields keep the previous value.
- **Messages** – consecutive chunks of the same role merge; `messageId` is honoured when present; `session/load` replays reconstruct implicit turns (`bridge.loaded()` settles them).
- **Folding** – settled turns collapse behind “Worked for …”, keeping user messages, the first and last assistant message and failed tool calls. Running turns and streaming messages never fold. Configure via `<Timeline rowOptions={…}>`.
- **Grouping** – consecutive `read` / `search` tool calls merge into one expandable row.
- **Diffs** – per-tool diffs come from ACP `diff` content; the per-turn summary diffs the first `oldText` against the last `newText` per path, so repeated edits are not double counted.
- **Cancel** – `bridge.cancel()` marks open tool calls cancelled and answers pending permission requests with `cancelled`, as required by ACP.
- **Scrolling** – the timeline follows new output until the user scrolls up, then shows “Jump to latest”.
- **Markdown** – built in via `react-markdown` + `remark-gfm`, loaded lazily on first render; unterminated code fences are closed while streaming. Replace it with `<MarkdownProvider value={(props) => …}>`.

## Customising

Every row is a standalone component (`UserMessage`, `AssistantMessage`, `ReasoningBlock`, `ToolCallRow`,
`ToolGroup`, `PlanCard`, `PermissionPrompt`, `ChangedFilesSummary`, `TurnFold`, `WorkingIndicator`,
`TurnStatus`, `InlineDiff`, `TerminalOutput`, `ContextMeter`, `Composer`). Override a row type with
`<Timeline renderRow={(row, ctx) => row.kind === "plan" ? <MyPlan plan={row.plan} /> : undefined} />`,
or build your own list from `useRows()`. Theme by overriding the `--acp-*` CSS variables.

## Copy the source (shadcn)

```sh
npx shadcn add https://hifizz.github.io/acp-render/r/acp-timeline.json
npx shadcn add https://hifizz.github.io/acp-render/r/acp-composer.json
```

Files land in `components/acp-render/`; they depend on `@acp-render/core` only for state and types.

## Development

```sh
pnpm install
pnpm dev             # playground with a scripted mock agent (no real model)
pnpm test && pnpm lint && pnpm typecheck && pnpm build
pnpm registry:build  # shadcn registry → apps/playground/public/r
```

## License

MIT
