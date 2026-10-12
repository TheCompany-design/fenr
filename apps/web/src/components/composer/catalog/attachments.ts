/**
 * Composer-owned attachment model.
 *
 * This started as an import from the app's `lib/attachments`, which made the
 * folder impossible to lift into another project without also dragging that
 * module along. The shape the composer actually needs is small — an id, a
 * name, a size, a mime type, and an optional preview URL — so it is declared
 * here instead.
 *
 * Blob-URL lifetime is the subtle part and it is handled the same way the app
 * handles it: the composer owns the URLs it creates, revokes what it drops,
 * and registers a finalizer as a backstop for anything that falls through.
 * Without the finalizer, an attachment removed by a path that forgets to
 * revoke leaks its URL for the lifetime of the document.
 */

export type Attachment = {
  id: string
  name: string
  size: number
  mimeType: string
  /** Object URL for a local preview; absent once uploaded or for remote files. */
  url?: string
  /**
   * The file itself, kept so the host can read its content at send time. The
   * composer never opens it — reading, flattening, and uploading are host
   * decisions — but dropping it here would leave the send path holding a name
   * that points at nothing.
   */
  file?: File
}

const urlFinalizer =
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry<string>((url) => URL.revokeObjectURL(url))
    : null

export function createAttachments(files: readonly File[]): Attachment[] {
  return files.map((file) => {
    const url = URL.createObjectURL(file)
    const attachment: Attachment = {
      id: createAttachmentId(),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url,
      file,
    }
    urlFinalizer?.register(attachment, url)
    return attachment
  })
}

/** Releases the preview URLs of attachments that are about to disappear. */
export function revokeAttachments(
  attachments: readonly Attachment[] | undefined,
): void {
  if (!attachments) return
  for (const attachment of attachments) {
    if (!attachment.url) continue
    urlFinalizer?.unregister(attachment)
    URL.revokeObjectURL(attachment.url)
  }
}

export function isImageAttachment(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith("image/")
}

/**
 * Local, dependency-free id generation. `crypto.randomUUID` is used when
 * available because it is collision-free; the fallback is a counter plus a
 * random suffix, which only has to be unique within one composer instance.
 */
let sequence = 0

export function createAttachmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `att_${crypto.randomUUID()}`
  }
  sequence += 1
  return `att_${Date.now().toString(36)}_${sequence.toString(36)}`
}

export function createEntityId(prefix: string): string {
  sequence += 1
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}`
}
