/**
 * Sidebar navigation as data.
 *
 * New screens register here — one place to add/extend navigation. Items
 * without a destination yet are `disabled: true` placeholders (rendered
 * inert) instead of pointing at non-existent routes.
 */

import { Home01Icon, Settings01Icon } from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export interface NavItem {
  id: string
  title: string
  icon: IconSvgElement
  /** Route path. Extend this union as real routes land. */
  to?: "/"
  /** Placeholder item — rendered but inert until its route exists. */
  disabled?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", title: "Home", icon: Home01Icon, to: "/" },
  { id: "settings", title: "Settings", icon: Settings01Icon, disabled: true },
]
