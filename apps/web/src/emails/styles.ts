import type React from "react"

export const emailStyles = {
  main: {
    backgroundColor: "#f4f4f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
    padding: "40px 0",
  } satisfies React.CSSProperties,

  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: "8px",
    margin: "0 auto",
    padding: "36px 32px",
    maxWidth: "560px",
  } satisfies React.CSSProperties,

  logo: {
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.5px",
    color: "#18181b",
    margin: "0 0 24px",
  } satisfies React.CSSProperties,

  heading: {
    fontSize: "20px",
    fontWeight: 600,
    lineHeight: "28px",
    color: "#18181b",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,

  paragraph: {
    fontSize: "14px",
    lineHeight: "24px",
    color: "#3f3f46",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,

  boldText: {
    fontWeight: 600,
    color: "#18181b",
  } satisfies React.CSSProperties,

  buttonContainer: {
    textAlign: "center",
    margin: "24px 0",
  } satisfies React.CSSProperties,

  button: {
    backgroundColor: "#18181b",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center",
    display: "inline-block",
    padding: "12px 24px",
  } satisfies React.CSSProperties,

  fallbackNotice: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "#71717a",
    margin: "0 0 8px",
  } satisfies React.CSSProperties,

  linkText: {
    color: "#2563eb",
    textDecoration: "underline",
    wordBreak: "break-all",
    fontSize: "13px",
    lineHeight: "20px",
  } satisfies React.CSSProperties,

  hr: {
    borderColor: "#e4e4e7",
    margin: "24px 0",
  } satisfies React.CSSProperties,

  footer: {
    color: "#71717a",
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0",
  } satisfies React.CSSProperties,
} as const
