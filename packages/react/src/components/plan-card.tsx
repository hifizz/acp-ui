import { memo } from "react";
import type { Plan } from "@acp-render/core";
import { cn } from "./cn";
import { Check, Circle, ListChecks, Spinner } from "./icons";

export interface PlanCardProps {
  plan: Plan;
  className?: string;
}

export const PlanCard = memo(function PlanCard({ plan, className }: PlanCardProps) {
  const done = plan.entries.filter((e) => e.status === "completed").length;
  return (
    <div
      className={cn(
        "rounded-acp border border-acp-border bg-acp-surface px-3 py-2.5 text-[13px]",
        className,
      )}
      data-acp-row="plan"
    >
      <div className="mb-1.5 flex items-center gap-2 text-xs text-acp-muted">
        <ListChecks size={13} />
        <span>Plan</span>
        <span className="ml-auto text-acp-subtle">
          {done}/{plan.entries.length}
        </span>
      </div>
      <ol className="space-y-1">
        {plan.entries.map((e, i) => (
          <li key={i} className="flex items-start gap-2" data-acp-plan-status={e.status}>
            <span className="mt-[3px] shrink-0">
              {e.status === "completed" ? (
                <Check size={12} className="text-acp-success" />
              ) : e.status === "in_progress" ? (
                <Spinner size={12} className="text-acp-accent" />
              ) : (
                <Circle size={12} className="text-acp-subtle" />
              )}
            </span>
            <span
              className={cn(
                e.status === "completed" && "text-acp-subtle line-through",
                e.status === "in_progress" && "text-acp-fg",
                e.status === "pending" && "text-acp-muted",
              )}
            >
              {e.content}
            </span>
            {e.priority === "high" ? (
              <span className="ml-auto shrink-0 text-[10px] uppercase text-acp-warning">high</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
});
