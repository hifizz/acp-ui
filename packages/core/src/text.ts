import type { ContentBlock } from "./acp";

/** Plain-text projection of content blocks (for copy buttons, previews, search). */
export function contentToText(blocks: readonly ContentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "text":
          return b.text;
        case "resource_link":
          return b.title ?? b.name;
        case "resource":
          return "text" in b.resource ? b.resource.text : b.resource.uri;
        default:
          return "";
      }
    })
    .join("");
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}
