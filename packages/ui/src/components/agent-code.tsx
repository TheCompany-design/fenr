"use client"

import { cn } from "@workspace/ui/lib/utils"
import { type CSSProperties, Fragment } from "react"

export type AgentCodeLanguage =
  | "bash"
  | "diff"
  | "json"
  | "text"
  | "tsx"
  | "typescript"

export interface AgentCodeToken {
  content: string
  offset: number
  light?: string
  dark?: string
}

export type AgentCodeTokenLines = AgentCodeToken[][]

export interface AgentCodeProps {
  code: string
  language?: AgentCodeLanguage
  className?: string
}

export interface AgentCodeLineProps {
  code: string
  tokens?: AgentCodeToken[]
  className?: string
}

const JSON_TOKEN_REGEX =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g

function tokenizeLine(
  line: string,
  lineOffset: number,
  language: AgentCodeLanguage,
): AgentCodeToken[] {
  if (!line) return []

  if (language === "diff") {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return [
        {
          content: line,
          offset: lineOffset,
          light: "#116329",
          dark: "#3fb950",
        },
      ]
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      return [
        {
          content: line,
          offset: lineOffset,
          light: "#cf222e",
          dark: "#f85149",
        },
      ]
    }
    return [{ content: line, offset: lineOffset }]
  }

  if (language === "json") {
    const tokens: AgentCodeToken[] = []
    let cursor = 0
    for (const match of line.matchAll(JSON_TOKEN_REGEX)) {
      const index = match.index ?? 0
      if (index > cursor) {
        tokens.push({
          content: line.slice(cursor, index),
          offset: lineOffset + cursor,
        })
      }
      const value = match[0]
      const isKey = Boolean(match[2])
      let light: string | undefined
      let dark: string | undefined

      if (isKey) {
        light = "#0550ae"
        dark = "#79c0ff"
      } else if (value.startsWith('"')) {
        light = "#0a3069"
        dark = "#a5d6ff"
      } else if (value === "true" || value === "false" || value === "null") {
        light = "#cf222e"
        dark = "#ff7b72"
      } else {
        light = "#0550ae"
        dark = "#79c0ff"
      }

      tokens.push({
        content: value,
        offset: lineOffset + index,
        light,
        dark,
      })
      cursor = index + value.length
    }
    if (cursor < line.length) {
      tokens.push({
        content: line.slice(cursor),
        offset: lineOffset + cursor,
      })
    }
    return tokens
  }

  return [{ content: line, offset: lineOffset }]
}

export function useAgentCodeTokens(
  code: string,
  language: AgentCodeLanguage,
): AgentCodeTokenLines {
  let offset = 0
  return code.split("\n").map((line) => {
    const tokens = tokenizeLine(line, offset, language)
    offset += line.length + 1
    return tokens
  })
}

export function AgentCodeLine({ code, tokens, className }: AgentCodeLineProps) {
  return (
    <span className={className}>
      {tokens
        ? tokens.map((token) => (
            <span
              key={`${token.offset}-${token.content}`}
              style={
                {
                  "--agent-code-light": token.light ?? "currentColor",
                  "--agent-code-dark":
                    token.dark ?? token.light ?? "currentColor",
                } as CSSProperties
              }
              className="text-(--agent-code-light) dark:text-(--agent-code-dark)"
            >
              {token.content}
            </span>
          ))
        : code}
    </span>
  )
}

export function AgentCode({
  code,
  language = "bash",
  className,
}: AgentCodeProps) {
  const tokens = useAgentCodeTokens(code, language)
  let offset = 0
  const lines = code.split("\n").map((content) => {
    const line = { content, offset }
    offset += content.length + 1
    return line
  })

  return (
    <pre
      className={cn(
        "m-0 overflow-x-auto whitespace-pre font-mono text-xs leading-5 text-foreground/85",
        className,
      )}
    >
      <code>
        {lines.map((line, index) => (
          <Fragment key={line.offset}>
            <AgentCodeLine code={line.content} tokens={tokens[index]} />
            {index < lines.length - 1 ? "\n" : null}
          </Fragment>
        ))}
      </code>
    </pre>
  )
}
