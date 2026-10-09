import { createContext, lazy, memo, Suspense, useContext, type ReactNode } from "react";
import { cn } from "./cn";

export interface MarkdownProps {
  children: string;
  streaming?: boolean;
  className?: string;
}

const LazyMarkdown = lazy(() => import("./markdown-renderer"));

export type RenderMarkdown = (props: MarkdownProps) => ReactNode;

const MarkdownOverride = createContext<RenderMarkdown | null>(null);

/** Replace the built-in (lazy loaded react-markdown) renderer with a render function. */
export const MarkdownProvider = MarkdownOverride.Provider;

/** Close an unterminated code fence so partial streams render as code, not prose. */
export function closeOpenFences(text: string): string {
  const fences = text.match(/^\s*(```|~~~)/gm)?.length ?? 0;
  return fences % 2 === 1 ? `${text}\n\`\`\`` : text;
}

function PlainText({ children, className }: MarkdownProps) {
  return <div className={cn("whitespace-pre-wrap break-words", className)}>{children}</div>;
}

export const Markdown = memo(function Markdown(props: MarkdownProps) {
  const renderOverride = useContext(MarkdownOverride);
  const text = props.streaming ? closeOpenFences(props.children) : props.children;
  if (renderOverride) return <>{renderOverride({ ...props, children: text })}</>;
  return (
    <Suspense fallback={<PlainText {...props}>{props.children}</PlainText>}>
      <LazyMarkdown {...props}>{text}</LazyMarkdown>
    </Suspense>
  );
});
