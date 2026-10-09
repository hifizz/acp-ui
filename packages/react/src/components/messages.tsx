import { memo, useState } from "react";
import { contentToText, type Message } from "@acp-render/core";
import { cn } from "./cn";
import { ContentBlocks } from "./content-blocks";
import { Check, Copy } from "./icons";

export interface UserMessageProps {
  message: Message;
  className?: string;
}

export const UserMessage = memo(function UserMessage({ message, className }: UserMessageProps) {
  return (
    <div className={cn("flex justify-end", className)} data-acp-row="user-message">
      <div className="max-w-[85%] rounded-acp border border-acp-border bg-acp-surface-2 px-3.5 py-2.5 text-sm text-acp-fg">
        <ContentBlocks blocks={message.content} markdown={false} />
      </div>
    </div>
  );
});

export interface AssistantMessageProps {
  message: Message;
  streaming?: boolean;
  /** Final message of a settled turn: shows the copy action. */
  isFinal?: boolean;
  className?: string;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  streaming,
  isFinal,
  className,
}: AssistantMessageProps) {
  return (
    <div
      className={cn("group text-sm leading-relaxed text-acp-fg", className)}
      data-acp-row="assistant-message"
      aria-busy={streaming || undefined}
    >
      <ContentBlocks blocks={message.content} streaming={streaming} />
      {streaming ? <span className="acp-caret text-acp-muted" aria-hidden="true" /> : null}
      {isFinal ? <CopyButton text={contentToText(message.content)} /> : null}
    </div>
  );
});

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy message"
      className={cn(
        "mt-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-acp-subtle opacity-0 transition hover:bg-acp-hover hover:text-acp-fg focus-visible:opacity-100 group-hover:opacity-100",
        className,
      )}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}
