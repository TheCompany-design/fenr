import type { ProviderId } from "./capabilities"

/**
 * The only place in the app that knows how credentials are kept.
 *
 * The playground ships `LocalCredentialStore`; the real app swaps in whatever
 * it already has. Nothing above this interface may read `localStorage`, reach
 * for `indexedDB`, or hold a key in a closure — the store is the seam.
 */
export interface CredentialStore {
  /** Resolve a credential, or `null` when the provider has never been set up. */
  get(providerId: ProviderId): Promise<string | null>
  set(providerId: ProviderId, credential: string): Promise<void>
  clear(providerId: ProviderId): Promise<void>
  /** Ids known to the store, including ones whose value has not been read. */
  list(): Promise<ProviderId[]>
}

const STORAGE_KEY = "provider-credentials"

/**
 * Deliberately the weakest possible implementation. The playground has no
 * security posture to protect, and an honest `localStorage` implementation is
 * easier to reason about than a fake-encrypted one.
 */
export class LocalCredentialStore implements CredentialStore {
  private readAll(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  }

  private writeAll(all: Record<string, string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }

  get(providerId: ProviderId): Promise<string | null> {
    return Promise.resolve(this.readAll()[providerId] ?? null)
  }

  set(providerId: ProviderId, credential: string): Promise<void> {
    const all = this.readAll()
    all[providerId] = credential
    this.writeAll(all)
    return Promise.resolve()
  }

  clear(providerId: ProviderId): Promise<void> {
    const all = this.readAll()
    delete all[providerId]
    this.writeAll(all)
    return Promise.resolve()
  }

  list(): Promise<ProviderId[]> {
    return Promise.resolve(Object.keys(this.readAll()))
  }
}
