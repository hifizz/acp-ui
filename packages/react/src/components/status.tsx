import { memo, useEffect, useState } from "react";
import { formatDuration, type StopReason } from "@acp-render/core";
import { cn } from "./cn";
import { Alert, Spinner } from "./icons";

export function useElapsed(startedAt: number, running = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return Math.max(0, now - startedAt);
}

export interface WorkingIndicatorProps {
  startedAt: number;
  cancelling?: boolean;
  label?: string;
  className?: string;
}

export const WorkingIndicator = memo(function WorkingIndicator({
  startedAt,
  cancelling,
  label,
  className,
}: WorkingIndicatorProps) {
  const elapsed = useElapsed(startedAt);
  return (
    <div
      role="status"
      className={cn("flex items-center gap-2 text-xs text-acp-subtle", className)}
      data-acp-row="working"
    >
      <Spinner size={12} />
      <span>{cancelling ? "Cancelling…" : (label ?? "Working…")}</span>
      <span className="acp-mono">{formatDuration(elapsed)}</span>
    </div>
  );
});

const stopReasonText: Record<StopReason, string> = {
  end_turn: "Stopped",
  cancelled: "Cancelled by user",
  max_tokens: "Stopped: reached the token limit",
  max_turn_requests: "Stopped: reached the request limit for this turn",
  refusal: "The agent refused to continue",
};

export interface TurnStatusProps {
  stopReason: StopReason;
  error?: string;
  className?: string;
}

export const TurnStatus = memo(function TurnStatus({
  stopReason,
  error,
  className,
}: TurnStatusProps) {
  const danger = Boolean(error) || stopReason === "refusal";
  return (
    <div
      role={danger ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
        danger ? "bg-acp-del-bg text-acp-danger" : "text-acp-subtle",
        className,
      )}
      data-acp-row="turn-status"
    >
      <Alert size={12} className="mt-px shrink-0" />
      <span>{error ?? stopReasonText[stopReason]}</span>
    </div>
  );
});
