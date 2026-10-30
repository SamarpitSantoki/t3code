import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { removeBot, removeBotThread, type BotRegistry } from "../bots/bots-model";
import { useUpdateBotRegistry } from "../bots/bots-state";
import { useArchivedThreadListActions, useThreadListActions } from "../home/useThreadListActions";
import { toggleChatMuted } from "./chat-read-state";
import type { ChatSwipeAction } from "./chat-swipe-row";
import type { ChatRow } from "./chats-model";

export interface ChatRowActions {
  readonly left: ReadonlyArray<ChatSwipeAction>;
  readonly right: ReadonlyArray<ChatSwipeAction>;
}

/** A deleted thread leaves the phone too: a side thread drops off its bot, a main chat its bot. */
function forgetThread(registry: BotRegistry, thread: EnvironmentThreadShell): BotRegistry {
  const owner = registry.bots.find(
    (bot) =>
      bot.environmentId === thread.environmentId &&
      (bot.threadId === thread.id || bot.threads?.some((item) => item.threadId === thread.id)),
  );
  if (owner === undefined) return registry;
  return owner.threadId === thread.id
    ? removeBot(registry, owner.id)
    : removeBotThread(registry, owner.id, thread.id);
}

/**
 * Swipe actions for a chat row, run through the T3 thread list's own commands. `shells` holds the
 * live threads and `archived` the hidden ones, both by `environmentId:threadId`.
 */
export function useChatRowActions(input: {
  readonly shells: ReadonlyMap<string, EnvironmentThreadShell>;
  readonly archived: ReadonlyMap<string, EnvironmentThreadShell>;
}): (row: ChatRow) => ChatRowActions {
  const updateRegistry = useUpdateBotRegistry();
  const { archiveThread, pinThread, settleThread, unpinThread, unsettleThread } =
    useThreadListActions();
  const { confirmDeleteThread } = useArchivedThreadListActions((thread) =>
    updateRegistry((current) => forgetThread(current, thread)),
  );
  const { unarchiveThread } = useArchivedThreadListActions(() => undefined);

  return (row) => {
    const mute: ChatSwipeAction = {
      id: "mute",
      label: row.muted ? "Unmute" : "Mute",
      icon: "moon",
      tone: "ink",
      onPress: () => toggleChatMuted(row.muteKey),
    };
    const key = row.target === null ? null : row.readKey;
    const live = key === null ? undefined : input.shells.get(key);
    const hidden = key === null ? undefined : input.archived.get(key);
    const remove = (thread: EnvironmentThreadShell): ChatSwipeAction => ({
      id: "delete",
      label: "Delete",
      icon: "trash",
      tone: "red",
      onPress: () => confirmDeleteThread(thread),
    });

    if (row.hidden) {
      return {
        left: [mute],
        right: hidden
          ? [
              {
                id: "show",
                label: "Show",
                icon: "eye",
                tone: "blue",
                onPress: () => unarchiveThread(hidden),
              },
              remove(hidden),
            ]
          : [],
      };
    }
    if (live === undefined) return { left: [mute], right: [] };
    return {
      left: [
        row.pinned
          ? {
              id: "unpin",
              label: "Unpin",
              icon: "pin.slash",
              tone: "amber",
              onPress: () => void unpinThread(live),
            }
          : {
              id: "pin",
              label: "Pin",
              icon: "pin",
              tone: "amber",
              onPress: () => void pinThread(live),
            },
        mute,
      ],
      right: [
        row.settled
          ? {
              id: "unsettle",
              label: "Unsettle",
              icon: "arrow.uturn.backward",
              tone: "blue",
              onPress: () => void unsettleThread(live),
            }
          : {
              id: "settle",
              label: "Settle",
              icon: "checkmark",
              tone: "green",
              onPress: () => void settleThread(live),
            },
        {
          id: "hide",
          label: "Hide",
          icon: "eye.slash",
          tone: "ink",
          onPress: () => void archiveThread(live),
        },
        remove(live),
      ],
    };
  };
}
