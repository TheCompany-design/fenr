import type { ProviderId } from "./capabilities"

export interface CredentialStore {
  get(providerId: ProviderId): Promise<string | null>
  set(providerId: ProviderId, credential: string): Promise<void>
  clear(providerId: ProviderId): Promise<void>

  list(): Promise<ProviderId[]>
}

const STORAGE_KEY = "provider-credentials"

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
