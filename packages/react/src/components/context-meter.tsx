import type { Usage } from "@acp-render/core";
import { cn } from "./cn";

export interface ContextMeterProps {
  usage: Usage | undefined;
  className?: string;
}

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function ContextMeter({ usage, className }: ContextMeterProps) {
  if (!usage || usage.size <= 0) return null;
  const ratio = Math.min(1, usage.used / usage.size);
  const r = 6;
  const c = 2 * Math.PI * r;
  const title = `${compact(usage.used)} / ${compact(usage.size)} tokens${
    usage.cost ? ` · ${usage.cost.amount.toFixed(2)} ${usage.cost.currency}` : ""
  }`;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[11px] text-acp-subtle", className)}
      title={title}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r={r} fill="none" stroke="var(--acp-border-strong)" strokeWidth="2" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke={ratio > 0.9 ? "var(--acp-danger)" : "var(--acp-muted)"}
          strokeWidth="2"
          strokeDasharray={`${c * ratio} ${c}`}
          transform="rotate(-90 8 8)"
        />
      </svg>
      <span className="acp-mono">{Math.round(ratio * 100)}%</span>
    </span>
  );
}
