import type { ReactNode } from "react"
import "../styles"
import { EditorProviderStore, type EditorStore } from "../state/editor-store"

export interface EditorRootProps {
  children: ReactNode
  store?: EditorStore
}

export const EditorRoot = ({ children, store }: EditorRootProps) => {
  return <EditorProviderStore store={store}>{children}</EditorProviderStore>
}
