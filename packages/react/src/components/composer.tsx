import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { AvailableCommand, ContentBlock } from "@acp-render/core";
import { cn } from "./cn";
import { ArrowUp, Square } from "./icons";

export interface ComposerProps {
  /** Called with the trimmed text and ACP prompt blocks. */
  onSubmit: (text: string, blocks: ContentBlock[]) => void;
  onCancel?: () => void;
  /** A turn is running: shows the stop button. Submitting while running is still allowed (queues). */
  running?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Slash commands from `available_commands_update`. */
  commands?: readonly AvailableCommand[];
  /** Left side of the toolbar (mode picker, model, attachments…). */
  toolbar?: ReactNode;
  /** Right side of the toolbar, before the send button (e.g. <ContextMeter />). */
  trailing?: ReactNode;
  maxRows?: number;
  className?: string;
}

export function Composer({
  onSubmit,
  onCancel,
  running,
  disabled,
  placeholder = "Ask for follow-up changes",
  commands = [],
  toolbar,
  trailing,
  maxRows = 10,
  className,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [activeCommand, setActiveCommand] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows)}px`;
  }, [value, maxRows]);

  const slash = /^\/(\S*)$/.exec(value);
  const matches = useMemo(
    () => (slash ? commands.filter((c) => c.name.startsWith(slash[1] ?? "")) : []),
    [commands, slash],
  );

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text, [{ type: "text", text }]);
    setValue("");
  };

  const pickCommand = (c: AvailableCommand) => {
    setValue(`/${c.name} `);
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (matches.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setActiveCommand((i) => (i + d + matches.length) % matches.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        pickCommand(matches[Math.min(activeCommand, matches.length - 1)]!);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && running) {
      onCancel?.();
    }
  };

  return (
    <form
      className={cn(
        "relative rounded-[14px] border border-acp-border-strong bg-acp-surface px-3 pb-2 pt-2.5 shadow-sm focus-within:border-acp-subtle",
        className,
      )}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
    >
      {matches.length > 0 ? (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 mb-1.5 max-h-56 w-full overflow-auto rounded-acp border border-acp-border bg-acp-surface-2 py-1 text-[13px] shadow-lg"
        >
          {matches.map((c, i) => (
            <li key={c.name} role="option" aria-selected={i === activeCommand}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickCommand(c)}
                className={cn(
                  "flex w-full gap-2 px-3 py-1 text-left",
                  i === activeCommand ? "bg-acp-hover text-acp-fg" : "text-acp-muted",
                )}
              >
                <span className="acp-mono">/{c.name}</span>
                <span className="truncate text-acp-subtle">{c.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Message"
        onChange={(e) => {
          setValue(e.target.value);
          setActiveCommand(0);
        }}
        onKeyDown={onKeyDown}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => (composing.current = false)}
        className="block w-full resize-none bg-transparent text-sm leading-5 text-acp-fg outline-none placeholder:text-acp-subtle"
      />
      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-acp-subtle">
          {toolbar}
        </div>
        {trailing}
        {running && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-acp-fg text-acp-bg hover:opacity-90"
          >
            <Square size={12} />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            disabled={disabled || !value.trim()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-acp-fg text-acp-bg transition enabled:hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp size={14} />
          </button>
        )}
      </div>
    </form>
  );
}
