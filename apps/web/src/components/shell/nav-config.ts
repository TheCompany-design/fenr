import {
  AiChat02Icon,
  Doc01Icon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export interface NavItem {
  id: string
  title: string
  icon: IconSvgElement

  to?: string

  disabled?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", title: "Home", icon: Home01Icon, to: "/" },
  { id: "chat", title: "Chat", icon: AiChat02Icon, to: "/chat" },
  {
    id: "settings",
    title: "Settings",
    icon: Settings01Icon,
    to: "/settings",
  },
  { id: "document", title: "Document", icon: Doc01Icon, to: "/document" },
]
