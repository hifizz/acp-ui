import { memo } from "react";
import type { PendingPermission, PermissionOption, ToolCall } from "@acp-render/core";
import { cn } from "./cn";
import { Shield } from "./icons";
import { ToolKindIcon } from "./tool-call";

export interface PermissionPromptProps {
  request: PendingPermission;
  tool?: ToolCall;
  onRespond?: (requestId: string, optionId: string | null) => void;
  className?: string;
}

const order: PermissionOption["kind"][] = [
  "allow_once",
  "allow_always",
  "reject_once",
  "reject_always",
];

export const PermissionPrompt = memo(function PermissionPrompt({
  request,
  tool,
  onRespond,
  className,
}: PermissionPromptProps) {
  const options = [...request.options].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
  return (
    <div
      role="group"
      aria-label="Permission request"
      className={cn(
        "rounded-acp border border-acp-warning/40 bg-acp-surface px-3 py-2.5 text-[13px]",
        className,
      )}
      data-acp-row="permission"
    >
      <div className="mb-2 flex items-center gap-2 text-acp-fg">
        <Shield size={14} className="text-acp-warning" />
        <span className="text-acp-muted">Permission required</span>
      </div>
      {tool ? (
        <div className="mb-2.5 flex items-center gap-2 text-acp-fg">
          <ToolKindIcon kind={tool.kind} className="text-acp-subtle" />
          <span className="acp-mono truncate text-[12.5px]">{tool.title}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.optionId}
            type="button"
            onClick={() => onRespond?.(request.requestId, o.optionId)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition",
              o.kind.startsWith("allow")
                ? "border-acp-border-strong bg-acp-fg text-acp-bg hover:opacity-90"
                : "border-acp-border text-acp-muted hover:bg-acp-hover hover:text-acp-fg",
              o.kind === "allow_always" && "bg-transparent text-acp-fg",
            )}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
});
