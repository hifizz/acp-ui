import { memo } from "react";
import { cn } from "./cn";

export interface TerminalOutputProps {
  output: string;
  exitCode?: number | null;
  maxHeight?: number;
  className?: string;
}

export const TerminalOutput = memo(function TerminalOutput({
  output,
  exitCode,
  maxHeight = 280,
  className,
}: TerminalOutputProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-acp-border bg-acp-code-bg",
        className,
      )}
    >
      <pre
        className="acp-mono overflow-auto whitespace-pre-wrap p-2.5 text-[12px] leading-[1.55] text-acp-muted"
        style={{ maxHeight }}
      >
        {output || " "}
      </pre>
      {exitCode != null ? (
        <div
          className={cn(
            "border-t border-acp-border px-2.5 py-1 text-[11px]",
            exitCode === 0 ? "text-acp-subtle" : "text-acp-danger",
          )}
        >
          exit {exitCode}
        </div>
      ) : null}
    </div>
  );
});
