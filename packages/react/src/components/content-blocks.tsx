import type { ContentBlock } from "@acp-render/core";
import { FileText } from "./icons";
import { Markdown } from "./markdown";
import { cn } from "./cn";

export interface ContentBlocksProps {
  blocks: readonly ContentBlock[];
  /** Render text blocks as markdown (assistant) or plain text (user). */
  markdown?: boolean;
  streaming?: boolean;
  className?: string;
}

export function ContentBlocks({
  blocks,
  markdown = true,
  streaming,
  className,
}: ContentBlocksProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((b, i) => (
        <ContentBlockView
          key={i}
          block={b}
          markdown={markdown}
          streaming={streaming && i === blocks.length - 1}
        />
      ))}
    </div>
  );
}

export function ContentBlockView({
  block,
  markdown,
  streaming,
}: {
  block: ContentBlock;
  markdown?: boolean;
  streaming?: boolean;
}) {
  switch (block.type) {
    case "text":
      return markdown ? (
        <Markdown streaming={streaming}>{block.text}</Markdown>
      ) : (
        <div className="whitespace-pre-wrap break-words">{block.text}</div>
      );
    case "image":
      return (
        <img
          src={block.uri ?? `data:${block.mimeType};base64,${block.data}`}
          alt=""
          className="max-h-64 rounded-md border border-acp-border"
        />
      );
    case "audio":
      return <audio controls src={`data:${block.mimeType};base64,${block.data}`} />;
    case "resource_link":
      return (
        <a
          href={block.uri}
          className="inline-flex items-center gap-1.5 rounded-md border border-acp-border bg-acp-surface px-2 py-1 text-xs text-acp-muted hover:text-acp-fg"
          title={block.description ?? block.uri}
        >
          <FileText size={12} />
          <span className="acp-mono">{block.title ?? block.name}</span>
        </a>
      );
    case "resource":
      return (
        <details className="rounded-md border border-acp-border bg-acp-surface text-xs">
          <summary className="acp-mono cursor-pointer px-2 py-1 text-acp-muted">
            {block.resource.uri}
          </summary>
          {"text" in block.resource ? (
            <pre className="acp-mono max-h-64 overflow-auto border-t border-acp-border p-2">
              {block.resource.text}
            </pre>
          ) : null}
        </details>
      );
  }
}
