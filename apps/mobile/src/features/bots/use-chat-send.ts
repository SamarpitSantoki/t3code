import { useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import { uuidv4 } from "../../lib/uuid";
import type { Bot } from "./bots-model";
import { sendToBot } from "./bots-state";
import type { PendingChatMessage } from "./chat-pending";

/** Clears the input at once and shows the message as sending until the server echoes it. */
export function useChatSend(input: {
  readonly text: string;
  readonly setText: (text: string) => void;
}) {
  const [pending, setPending] = useState<ReadonlyArray<PendingChatMessage>>([]);
  const send = (bot: Bot, text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const message: PendingChatMessage = {
      id: uuidv4(),
      botId: bot.id,
      botName: bot.name,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    const draft = input.text;
    setPending((current) => [...current, message]);
    input.setText("");
    sendToBot(bot, trimmed).catch((error: unknown) => {
      setPending((current) => current.filter((candidate) => candidate.id !== message.id));
      input.setText(draft);
      Dialog.alert("Could not send", String(error));
    });
  };
  return { pending, send };
}
