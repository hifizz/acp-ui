import { useCallback, useEffect, useRef, useState } from "react";

export interface StickToBottom {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

/**
 * Keeps a scroll container pinned to the bottom while content grows, and stops
 * following as soon as the user scrolls up.
 */
export function useStickToBottom(threshold = 48): StickToBottom {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = true;
    setIsAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    let lastTop = el.scrollTop;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance <= threshold;
      if (el.scrollTop < lastTop - 1 && !atBottom) stick.current = false;
      else if (atBottom) stick.current = true;
      lastTop = el.scrollTop;
      setIsAtBottom(stick.current);
    };
    const follow = () => {
      if (stick.current) {
        el.scrollTop = el.scrollHeight;
        lastTop = el.scrollTop;
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(follow) : undefined;
    ro?.observe(content);
    follow();
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [threshold]);

  return { scrollRef, contentRef, isAtBottom, scrollToBottom };
}
