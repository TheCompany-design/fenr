import { CheckmarkCircle02Icon, Copy01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Citation } from "@workspace/ui/components/citations"
import { cn } from "@workspace/ui/lib/utils"
import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import {
  type AppMentionApp,
  AppMentionPill,
  type AppMentionPillProps,
} from "./app-mention-pill"
import { remarkAppMentions } from "./remark-app-mentions"

export interface MessageMarkdownProps {
  readonly content: string
  readonly isStreaming?: boolean
  readonly variant?: "assistant" | "user" | "thinking"
  readonly className?: string
  /**
   * The prefix used to link inline citations to the citations list anchor.
   */
  readonly citationIdPrefix?: string
  /**
   * The apps whose `@Name` tokens render as pills. Omitted for messages
   * that are not the user's own draft — only a sent draft carries app
   * mentions worth recovering.
   */
  readonly appMentions?: readonly AppMentionApp[]
}

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

function extractTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join("")
  }
  if (
    node &&
    typeof node === "object" &&
    "props" in node &&
    node.props &&
    typeof node.props === "object" &&
    "children" in node.props
  ) {
    return extractTextContent((node.props as { children?: ReactNode }).children)
  }
  return ""
}

function CodeBlock({
  language,
  code,
}: {
  readonly language: string | null
  readonly code: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }, [code])

  return (
    <div
      data-slot="markdown-code-block"
      className="my-2.5 overflow-hidden rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/25"
    >
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/60 px-3 py-1.5 text-[11px] font-mono text-muted-foreground dark:bg-muted/40">
        <span className="truncate lowercase">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code"}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-sans text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
        >
          <HugeiconsIcon
            icon={copied ? CheckmarkCircle02Icon : Copy01Icon}
            size={12}
          />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children, ...props }: ComponentPropsWithoutRef<"p">) => (
    <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="mt-4 mb-2 text-lg font-semibold tracking-tight text-foreground first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-3.5 mb-1.5 text-base font-semibold tracking-tight text-foreground first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-3 mb-1 text-sm font-semibold tracking-tight text-foreground first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: ComponentPropsWithoutRef<"h4">) => (
    <h4
      className="mt-2.5 mb-1 text-[13px] font-semibold text-foreground first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </h4>
  ),
  ul: ({ children, ...props }: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="my-1.5 list-disc space-y-1 pl-5 first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="my-1.5 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-relaxed [&>p]:my-0.5" {...props}>
      {children}
    </li>
  ),
  blockquote: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="my-3 border-border/70" {...props} />
  ),
  a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => {
    // Check if link is an internal citation/footnote reference like "#source-1", "#preview-source-1", or "#fn-1"
    const citationHashMatch = href?.match(
      /^#([a-zA-Z0-9_-]+)-(\d+|[a-zA-Z0-9_-]+)$/,
    )
    const rawNumberMatch =
      typeof children === "string" || typeof children === "number"
        ? String(children).match(/^\[?(\d+)\]?$/)
        : null

    if (citationHashMatch && rawNumberMatch) {
      const idPrefix = citationHashMatch[1]
      const citationId = citationHashMatch[2]
      const index = parseInt(rawNumberMatch[1], 10)
      return (
        <Citation
          citationId={citationId}
          index={index}
          idPrefix={idPrefix}
          className="align-middle"
        />
      )
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
        {...props}
      >
        {children}
      </a>
    )
  },
  strong: ({ children, ...props }: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: ComponentPropsWithoutRef<"em">) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  del: ({ children, ...props }: ComponentPropsWithoutRef<"del">) => (
    <del className="text-muted-foreground line-through" {...props}>
      {children}
    </del>
  ),
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => <>{children}</>,
  code: ({
    className,
    children,
    node,
    ...props
  }: ComponentPropsWithoutRef<"code"> & { node?: unknown }) => {
    const match = /language-([\w-]+)/.exec(className ?? "")
    const rawCode = extractTextContent(children).replace(/\n$/, "")
    const isBlock = Boolean(match) || rawCode.includes("\n")

    if (isBlock) {
      return <CodeBlock language={match?.[1] ?? null} code={rawCode} />
    }

    return (
      <code
        data-slot="markdown-inline-code"
        className={cn(
          "rounded-md border border-border/60 bg-muted/70 px-1.25 py-0.5 font-mono text-[12px] text-foreground dark:bg-background/60",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  // The mention plugin's pills arrive as plain spans carrying data-app-*
  // attributes; everything else stays an ordinary span.
  span: ({
    node,
    children,
    ...props
  }: ComponentPropsWithoutRef<"span"> & { node?: unknown }) => {
    if ("data-app-mention" in props) {
      return (
        <AppMentionPill {...(props as AppMentionPillProps)}>
          {children}
        </AppMentionPill>
      )
    }
    return <span {...props}>{children}</span>
  },
  table: ({ children, ...props }: ComponentPropsWithoutRef<"table">) => (
    <div className="my-2.5 w-full overflow-x-auto rounded-lg border border-border/70 first:mt-0 last:mb-0">
      <table
        className="w-full border-collapse text-left text-[12.5px]"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: ComponentPropsWithoutRef<"thead">) => (
    <thead className="border-b border-border/70 bg-muted/50" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: ComponentPropsWithoutRef<"tbody">) => (
    <tbody className="divide-y divide-border/50" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: ComponentPropsWithoutRef<"tr">) => (
    <tr className="transition-colors hover:bg-muted/20" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: ComponentPropsWithoutRef<"th">) => (
    <th
      className="px-3 py-2 font-semibold text-foreground align-middle"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: ComponentPropsWithoutRef<"td">) => (
    <td className="px-3 py-2 text-foreground/90 align-top" {...props}>
      {children}
    </td>
  ),
}

export function MessageMarkdown({
  content,
  isStreaming = false,
  variant = "assistant",
  className,
  appMentions,
  citationIdPrefix,
}: MessageMarkdownProps) {
  // The plugin list's identity decides whether ReactMarkdown re-parses, so
  // it is stable unless the app registry itself changes. The plugin rides
  // as a [plugin, options] tuple — a bare transformer would be `.use()`d as
  // a plugin and never called with the registry.
  const remarkPlugins = useMemo(
    () =>
      appMentions && appMentions.length > 0
        ? [
            ...REMARK_PLUGINS,
            [remarkAppMentions, { apps: appMentions }] as [
              typeof remarkAppMentions,
              { apps: readonly AppMentionApp[] },
            ],
          ]
        : REMARK_PLUGINS,
    [appMentions],
  )

  const components: Components = useMemo(() => {
    if (!citationIdPrefix) return MARKDOWN_COMPONENTS

    return {
      ...MARKDOWN_COMPONENTS,
      a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => {
        const citationHashMatch = href?.match(
          /^#([a-zA-Z0-9_-]+)-(\d+|[a-zA-Z0-9_-]+)$/,
        )
        const rawNumberMatch =
          typeof children === "string" || typeof children === "number"
            ? String(children).match(/^\[?(\d+)\]?$/)
            : null

        if (citationHashMatch && rawNumberMatch) {
          const idPrefix = citationHashMatch[1]
          const citationId = citationHashMatch[2]
          const index = parseInt(rawNumberMatch[1], 10)
          return (
            <Citation
              citationId={citationId}
              index={index}
              idPrefix={idPrefix}
              className="align-middle"
            />
          )
        }

        // Also handle plain "#1" or "#citationId" with citationIdPrefix
        if (href?.startsWith("#") && rawNumberMatch) {
          const citationId = href.slice(1)
          const index = parseInt(rawNumberMatch[1], 10)
          return (
            <Citation
              citationId={citationId}
              index={index}
              idPrefix={citationIdPrefix}
              className="align-middle"
            />
          )
        }

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
            {...props}
          >
            {children}
          </a>
        )
      },
    }
  }, [citationIdPrefix])

  return (
    <div
      data-slot="message-markdown"
      data-variant={variant}
      className={cn(
        "min-w-0 max-w-none break-words text-[13px] leading-relaxed",
        variant === "thinking"
          ? "text-[12.5px] text-muted-foreground/90"
          : "text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span
          aria-hidden
          className="ml-1 inline-block h-3.5 w-1 translate-y-0.5 rounded-full bg-foreground animate-pulse"
        />
      )}
    </div>
  )
}
