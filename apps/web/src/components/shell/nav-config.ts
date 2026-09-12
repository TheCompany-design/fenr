/**
 * Sidebar navigation as data.
 *
 * New screens register here — one place to add/extend navigation. Items
 * without a destination yet are `disabled: true` placeholders (rendered
 * inert) instead of pointing at non-existent routes.
 */

import {
  Doc01Icon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export interface NavItem {
  id: string
  title: string
  icon: IconSvgElement
  /** Route path. Extend this union as real routes land. */
  to?: string
  /** Placeholder item — rendered but inert until its route exists.
   *  Inert by construction: NavItemButton renders no onClick for disabled
   *  items regardless of `to`, so a future route won't silently activate. */
  disabled?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", title: "Home", icon: Home01Icon, to: "/" },
  { id: "settings", title: "Settings", icon: Settings01Icon, disabled: true },
  { id: "document", title: "Document", icon: Doc01Icon, to: "/document" },
]
