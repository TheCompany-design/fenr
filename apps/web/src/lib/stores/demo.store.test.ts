// Minimal Storage polyfill so zustand's persist middleware works under `bun test`
// (no DOM available in the Bun runtime).
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

const g = globalThis as Record<string, unknown> & { localStorage?: Storage }
g.window ??= { localStorage: new MemoryStorage() }
g.localStorage ??= (g.window as { localStorage: Storage }).localStorage

const { useDemoStore } = await import("./demo.store")

import { beforeEach, describe, expect, test } from "bun:test"

describe("demo store (zustand + persist)", () => {
  beforeEach(() => {
    useDemoStore.getState().reset()
  })

  test("increments and decrements", () => {
    const { increment, decrement } = useDemoStore.getState()
    increment()
    increment()
    expect(useDemoStore.getState().count).toBe(2)
    decrement()
    expect(useDemoStore.getState().count).toBe(1)
  })

  test("persists state to storage under its key", () => {
    useDemoStore.getState().increment()
    const raw = window.localStorage.getItem("fenr.demo-counter")
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).state.count).toBe(1)
  })
})
