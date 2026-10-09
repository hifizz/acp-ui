import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "./cn";
import type { MarkdownProps } from "./markdown";

const components: Components = {
  a: ({ node: _n, ...p }) => (
    <a
      {...p}
      target="_blank"
      rel="noreferrer"
      className="text-acp-accent underline-offset-2 hover:underline"
    />
  ),
  p: ({ node: _n, ...p }) => <p {...p} className="my-2 first:mt-0 last:mb-0" />,
  ul: ({ node: _n, ...p }) => <ul {...p} className="my-2 list-disc pl-5" />,
  ol: ({ node: _n, ...p }) => <ol {...p} className="my-2 list-decimal pl-5" />,
  li: ({ node: _n, ...p }) => <li {...p} className="my-0.5" />,
  h1: ({ node: _n, ...p }) => <h1 {...p} className="mt-4 mb-2 text-lg font-semibold" />,
  h2: ({ node: _n, ...p }) => <h2 {...p} className="mt-4 mb-2 text-base font-semibold" />,
  h3: ({ node: _n, ...p }) => <h3 {...p} className="mt-3 mb-1.5 text-sm font-semibold" />,
  blockquote: ({ node: _n, ...p }) => (
    <blockquote {...p} className="my-2 border-l-2 border-acp-border-strong pl-3 text-acp-muted" />
  ),
  table: ({ node: _n, ...p }) => (
    <div className="my-2 overflow-x-auto">
      <table {...p} className="w-full border-collapse text-[13px]" />
    </div>
  ),
  th: ({ node: _n, ...p }) => (
    <th {...p} className="border border-acp-border px-2 py-1 text-left font-medium" />
  ),
  td: ({ node: _n, ...p }) => <td {...p} className="border border-acp-border px-2 py-1" />,
  pre: ({ node: _n, ...p }) => (
    <pre
      {...p}
      className="acp-mono my-2 overflow-x-auto rounded-md border border-acp-border bg-acp-code-bg p-3 text-[12.5px] leading-relaxed"
    />
  ),
  code: ({ node: _n, className, ...p }) => {
    const block = /language-/.test(className ?? "");
    return (
      <code
        {...p}
        className={cn(
          "acp-mono",
          block ? className : "rounded bg-acp-surface-2 px-1 py-0.5 text-[0.9em]",
        )}
      />
    );
  },
};

export default function MarkdownRenderer({ children, className }: MarkdownProps) {
  return (
    <div className={cn("break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
