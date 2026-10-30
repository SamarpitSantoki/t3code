import { useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import { uuidv4 } from "../../lib/uuid";
import { addBotThread, type Bot, type BotThread } from "./bots-model";
import { createBotThread, useBotThreadTarget, useUpdateBotRegistry } from "./bots-state";
import { entryAttachmentsFromDrafts } from "./chat-attachments";
import type { PendingChatMessage } from "./chat-pending";
import type { ChatAttachmentDraft } from "./use-chat-attachments";

type ThreadTarget = NonNullable<ReturnType<typeof useBotThreadTarget>>;

/** Starts a side thread from the first message, showing the task as sending meanwhile. */
export function useStartBotThread(input: {
  readonly text: string;
  readonly setText: (text: string) => void;
  /** Photos and files to send with the first task. */
  readonly attachments?: ChatAttachmentDraft;
}) {
  const updateRegistry = useUpdateBotRegistry();
  const [pending, setPending] = useState<ReadonlyArray<PendingChatMessage>>([]);
  const [starting, setStarting] = useState(false);

  const start = (bot: Bot, target: ThreadTarget | null, onStarted: (thread: BotThread) => void) => {
    const task = input.text.trim();
    if (task.length === 0 || starting) return;
    if (target === null) {
      Dialog.alert(
        "Still loading",
        `${bot.name}'s main chat is still loading. Try again in a moment.`,
      );
      return;
    }
    const attachments =
      (input.attachments?.attachments.length ?? 0) > 0 ? (input.attachments?.take() ?? null) : [];
    if (attachments === null) return;
    const message: PendingChatMessage = {
      id: uuidv4(),
      botId: bot.id,
      botName: bot.name,
      text: task,
      createdAt: new Date().toISOString(),
      attachments: entryAttachmentsFromDrafts(attachments),
    };
    const draft = input.text;
    setPending((current) => [...current, message]);
    setStarting(true);
    input.setText("");
    createBotThread({ bot, task, attachments, ...target })
      .then((thread) => {
        updateRegistry((registry) => addBotThread(registry, bot.id, thread));
        setStarting(false);
        onStarted(thread);
      })
      .catch((error: unknown) => {
        setPending((current) => current.filter((candidate) => candidate.id !== message.id));
        setStarting(false);
        input.setText(draft);
        if (attachments.length > 0) input.attachments?.restore(attachments);
        Dialog.alert("Could not start the thread", String(error));
      });
  };

  return { pending, starting, start };
}
