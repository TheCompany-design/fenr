/**
 * The shared SVG logo service, named exactly once.
 *
 * Every brand mark this app draws — model vendors in the picker and settings,
 * sign-in providers on the auth screens — is fetched from one third-party
 * service. The service's address and its URL shape live here and nowhere
 * else, so the service can move in one edit; a structural test pins that no
 * other source file names its host.
 *
 * What this module deliberately does *not* decide is which mark belongs to
 * whom. That is `provider-identity`'s record for model vendors and
 * `social.ts`'s table for sign-in providers, because "Google's models" and
 * "Sign in with Google" are different products and may legitimately carry
 * different artwork. What must never happen is a consumer building its own
 * URL — that is how a mark ends up decided in two places that disagree.
 */

/** The service's address. The only place this string appears. */
const SERVICE = "https://logos.lndev.me/logos"

/**
 * The URL of one mark on the shared logo service.
 *
 * `markId` is the id **the service** files the mark under, which is not always
 * the vendor's own id: Google the vendor draws `google-antigravity`, the
 * Antigravity pinwheel. Passing a vendor id straight through gets you the
 * wrong file whenever those two differ, so the caller's record names the mark
 * it wants explicitly.
 */
export function logoUrl(markId: string): string {
  return `${SERVICE}/${markId}.svg`
}
