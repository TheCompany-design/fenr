import { createStore, Provider as JotaiProvider, useStore } from "jotai"
import { type ReactNode, useState } from "react"

export type EditorStore = ReturnType<typeof createStore>

export interface EditorProviderStoreProps {
  children: ReactNode
  store?: EditorStore
}

export const EditorProviderStore = ({
  children,
  store: externalStore,
}: EditorProviderStoreProps) => {
  const [internalStore] = useState(() => externalStore ?? createStore())
  const store = externalStore ?? internalStore

  return <JotaiProvider store={store}>{children}</JotaiProvider>
}

export const useEditorStore = (): EditorStore => {
  return useStore()
}
