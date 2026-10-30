import { useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import type { DraftComposerAttachment } from "../../lib/composerImages";
import { uuidv4 } from "../../lib/uuid";
import type { Bot } from "./bots-model";
import { sendToBot } from "./bots-state";
import { entryAttachmentsFromDrafts } from "./chat-attachments";
import type { PendingChatMessage } from "./chat-pending";
import type { ChatAttachmentDraft } from "./use-chat-attachments";

/** Clears the input at once and shows the message as sending until the server echoes it. */
export function useChatSend(input: {
  readonly text: string;
  readonly setText: (text: string) => void;
  /** The picked photos and files; they go with the message and the tray empties. */
  readonly attachments?: ChatAttachmentDraft;
}) {
  const [pending, setPending] = useState<ReadonlyArray<PendingChatMessage>>([]);
  const send = (bot: Bot, text: string) => {
    const trimmed = text.trim();
    const hasAttachments = (input.attachments?.attachments.length ?? 0) > 0;
    if (trimmed.length === 0 && !hasAttachments) return;
    const attachments: ReadonlyArray<DraftComposerAttachment> | null = hasAttachments
      ? (input.attachments?.take() ?? null)
      : [];
    if (attachments === null) return;
    const message: PendingChatMessage = {
      id: uuidv4(),
      botId: bot.id,
      botName: bot.name,
      text: trimmed,
      createdAt: new Date().toISOString(),
      attachments: entryAttachmentsFromDrafts(attachments),
    };
    const draft = input.text;
    setPending((current) => [...current, message]);
    input.setText("");
    sendToBot(bot, trimmed, bot.threadId, attachments).catch((error: unknown) => {
      setPending((current) => current.filter((candidate) => candidate.id !== message.id));
      input.setText(draft);
      if (attachments.length > 0) input.attachments?.restore(attachments);
      Dialog.alert("Could not send", String(error));
    });
  };
  return { pending, send };
}
