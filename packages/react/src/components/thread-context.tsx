import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  deriveRows,
  type AcpBridge,
  type Row,
  type RowOptions,
  type ThreadState,
  type ThreadStore,
} from "@acp-render/core";

interface ThreadContextValue {
  store: ThreadStore;
  respondPermission?: (requestId: string, optionId: string | null) => void;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

export interface ThreadProviderProps {
  store: ThreadStore;
  /** Wires permission buttons to the ACP connection. */
  bridge?: Pick<AcpBridge, "respondPermission">;
  /** Alternative to `bridge` for custom permission handling. */
  onRespondPermission?: (requestId: string, optionId: string | null) => void;
  children: ReactNode;
}

export function ThreadProvider({
  store,
  bridge,
  onRespondPermission,
  children,
}: ThreadProviderProps) {
  const value = useMemo<ThreadContextValue>(
    () => ({ store, respondPermission: onRespondPermission ?? bridge?.respondPermission }),
    [store, bridge, onRespondPermission],
  );
  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
}

export function useThreadContext(): ThreadContextValue {
  const ctx = useContext(ThreadContext);
  if (!ctx) throw new Error("acp-render: wrap components in <ThreadProvider store={…}>");
  return ctx;
}

export function useThreadStore(): ThreadStore {
  return useThreadContext().store;
}

export function useThreadState(): ThreadState;
export function useThreadState<T>(selector: (s: ThreadState) => T): T;
export function useThreadState<T>(selector?: (s: ThreadState) => T): T | ThreadState {
  const store = useThreadStore();
  const get = () => (selector ? selector(store.getState()) : store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}

export function useRows(options: RowOptions = {}): Row[] {
  const state = useThreadState();
  return useMemo(() => deriveRows(state, options), [state, options]);
}
