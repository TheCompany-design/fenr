import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react"
import { CalloutView } from "./callout-view"

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

/**
 * Notion-style callout: a tinted block introduced by a pickable emoji.
 * The emoji is an attribute (document data); the body is ordinary block
 * content, so any node can live inside a callout.
 */
export const Callout = Node.create<CalloutOptions>({
  name: "callout",

  group: "block",
  content: "block+",
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (element) => element.getAttribute("data-emoji") ?? "💡",
        renderHTML: (attributes) => ({ "data-emoji": attributes.emoji }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-callout": "" },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }) =>
          commands.clearNodes() && commands.wrapIn(this.name),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    }
  },
})

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Convert the current block into a callout */
      setCallout: () => ReturnType
      /** Unwrap the current callout back into plain blocks */
      unsetCallout: () => ReturnType
    }
  }
}
