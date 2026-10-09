import { initialThreadState, reduceThread } from "./reducer";
import type { ThreadEvent, ThreadState } from "./types";

export type Listener = () => void;

/** Minimal external store, compatible with React's `useSyncExternalStore`. */
export interface ThreadStore {
  getState(): ThreadState;
  subscribe(listener: Listener): () => void;
  dispatch(event: ThreadEvent | readonly ThreadEvent[]): void;
  reset(state?: ThreadState): void;
}

export function createThreadStore(initial: ThreadState = initialThreadState): ThreadStore {
  let state = initial;
  const listeners = new Set<Listener>();
  const emit = () => {
    for (const l of [...listeners]) l();
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(event) {
      const events = Array.isArray(event) ? event : [event as ThreadEvent];
      let next = state;
      for (const e of events) next = reduceThread(next, e);
      if (next !== state) {
        state = next;
        emit();
      }
    },
    reset(next = initialThreadState) {
      state = next;
      emit();
    },
  };
}
