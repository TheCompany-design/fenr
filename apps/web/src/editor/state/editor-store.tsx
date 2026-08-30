import { createStore, Provider as JotaiProvider, useStore } from "jotai"
import { type ReactNode, useRef } from "react"

export type EditorStore = ReturnType<typeof createStore>

export interface EditorProviderStoreProps {
  children: ReactNode
  store?: EditorStore
}

export const EditorProviderStore = ({
  children,
  store: externalStore,
}: EditorProviderStoreProps) => {
  const storeRef = useRef<EditorStore | null>(null)
  if (!storeRef.current) {
    storeRef.current = externalStore ?? createStore()
  }

  return <JotaiProvider store={storeRef.current}>{children}</JotaiProvider>
}

export const useEditorStore = (): EditorStore => {
  return useStore()
}
