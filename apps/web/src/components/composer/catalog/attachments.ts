export type Attachment = {
  id: string
  name: string
  size: number
  mimeType: string

  url?: string

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
