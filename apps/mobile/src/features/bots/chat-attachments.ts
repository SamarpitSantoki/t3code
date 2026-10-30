import {
  clampFileAttachmentUploadBytes,
  fileAttachmentTooLargeMessage,
  formatAttachmentSize,
} from "@t3tools/client-runtime/state/attachments";
import { PROVIDER_SEND_TURN_MAX_ATTACHMENTS } from "@t3tools/contracts";
import { imageMimeType } from "@t3tools/shared/image";

import type { DraftComposerAttachment } from "../../lib/composerImages";

/** A photo or file as a chat bubble shows it. */
export interface ChatEntryAttachment {
  readonly id: string;
  readonly kind: "image" | "file";
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** The server's attachment id, once the message is sent. */
  readonly assetId?: string;
  /** A device preview, while the message is still sending. */
  readonly localUri?: string;
}

/** The attachment fields a server message carries. */
export interface MessageAttachmentFields {
  readonly type: string;
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** Same rule as the thread feed: an image type or an image file shows as a picture. */
export function entryAttachmentsFromMessage(
  attachments: ReadonlyArray<MessageAttachmentFields> | undefined,
): ReadonlyArray<ChatEntryAttachment> {
  return (attachments ?? []).map((attachment) => ({
    id: attachment.id,
    kind: attachment.type === "image" || imageMimeType(attachment) !== null ? "image" : "file",
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    assetId: attachment.id,
  }));
}

export function entryAttachmentsFromDrafts(
  attachments: ReadonlyArray<DraftComposerAttachment>,
): ReadonlyArray<ChatEntryAttachment> {
  return attachments.map((attachment) =>
    attachment.type === "image"
      ? {
          id: attachment.id,
          kind: "image",
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          localUri: attachment.previewUri,
        }
      : {
          id: attachment.id,
          kind: "file",
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        },
  );
}

/** Adds picked items up to the per-message limit; the rest come back so their files can go. */
export function appendChatAttachments<T extends { readonly id: string }>(
  current: ReadonlyArray<T>,
  picked: ReadonlyArray<T>,
  max: number = PROVIDER_SEND_TURN_MAX_ATTACHMENTS,
): { readonly attachments: ReadonlyArray<T>; readonly rejected: ReadonlyArray<T> } {
  const known = new Set(current.map((attachment) => attachment.id));
  const fresh = picked.filter((attachment) => !known.has(attachment.id));
  const room = Math.max(0, max - current.length);
  return {
    attachments: [...current, ...fresh.slice(0, room)],
    rejected: fresh.slice(room),
  };
}

export function attachmentLimitMessage(max: number = PROVIDER_SEND_TURN_MAX_ATTACHMENTS) {
  return `You can attach up to ${max} attachments per message.`;
}

/** A message needs text or an attachment. A new thread needs text, because the text names it. */
export function canSendChat(input: {
  readonly text: string;
  readonly attachmentCount: number;
  readonly requiresText?: boolean;
}): boolean {
  const hasText = input.text.trim().length > 0;
  if (input.requiresText) return hasText;
  return hasText || input.attachmentCount > 0;
}

export function attachmentSizeLabel(sizeBytes: number): string | null {
  return sizeBytes > 0 ? formatAttachmentSize(sizeBytes) : null;
}

/**
 * Why the server cannot take these files, or null when it can. Mirrors the outbox, which
 * would otherwise hold the message back after it left the composer.
 */
export function chatFileAttachmentProblem(input: {
  readonly attachments: ReadonlyArray<Pick<DraftComposerAttachment, "type" | "name" | "sizeBytes">>;
  readonly serverConfig: {
    readonly environment: {
      readonly capabilities: {
        readonly attachmentUploads?: boolean;
        readonly fileAttachments?: { readonly maxUploadBytes: number };
      };
    };
  } | null;
}): string | null {
  const files = input.attachments.filter((attachment) => attachment.type === "file");
  if (files.length === 0) return null;
  if (input.serverConfig === null) return "Server attachment support is still loading.";
  const capabilities = input.serverConfig.environment.capabilities;
  if (capabilities.attachmentUploads !== true || capabilities.fileAttachments === undefined) {
    return "This server does not support file attachments.";
  }
  const maxBytes = clampFileAttachmentUploadBytes(capabilities.fileAttachments.maxUploadBytes);
  const oversized = files.find((attachment) => attachment.sizeBytes > maxBytes);
  return oversized ? fileAttachmentTooLargeMessage(oversized.name, maxBytes) : null;
}
