import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useEffectEvent } from "react";

import { appAtomRegistry } from "../../state/atom-registry";
import { useThreadShell } from "../../state/entities";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import {
  chatThreadKey,
  messageTime,
  readTimeFor,
  toggleChatMute,
  withChatRead,
  type ChatReads,
} from "./chat-read-model";

const NO_READS: ChatReads = {};
const NO_MUTED: ReadonlyArray<string> = [];

/** When each chat was last opened, and which chats are muted. */
export function useChatReadState(): {
  readonly reads: ChatReads;
  readonly muted: ReadonlyArray<string>;
} {
  const preferences = useAtomValue(mobilePreferencesAtom);
  if (!AsyncResult.isSuccess(preferences)) return { reads: NO_READS, muted: NO_MUTED };
  return {
    reads: preferences.value.totsChatReads ?? NO_READS,
    muted: preferences.value.totsMutedChats ?? NO_MUTED,
  };
}

/** Saves that the chat `environmentId:threadId` was read up to now and its latest message. */
export function markChatRead(key: string, latestMessageMs: number | null) {
  const readAt = readTimeFor(Date.now(), latestMessageMs);
  appAtomRegistry.set(updateMobilePreferencesAtom, {
    transform: (current) => {
      const reads = current.totsChatReads ?? NO_READS;
      const next = withChatRead(reads, key, readAt);
      return next === reads ? {} : { totsChatReads: next };
    },
  });
}

/** Mutes a chat when it is not muted, and unmutes it when it is. */
export function toggleChatMuted(key: string) {
  appAtomRegistry.set(updateMobilePreferencesAtom, {
    transform: (current) => ({
      totsMutedChats: toggleChatMute(current.totsMutedChats ?? NO_MUTED, key),
    }),
  });
}

/**
 * Marks a chat read while it is on screen: when it opens, each time a new message lands, and when
 * it closes, so a reply that finished streaming on screen is read too. Pass a null thread while the
 * chat has none yet.
 */
export function useMarkChatRead(environmentId: string, threadId: string | null): void {
  const shell = useThreadShell(
    threadId === null
      ? null
      : scopeThreadRef(EnvironmentId.make(environmentId), ThreadId.make(threadId)),
  );
  const latest = shell?.source.latestVisibleMessage ?? null;
  const latestId = latest?.id ?? null;
  const latestMs = messageTime(latest?.updatedAt);
  // Reads the newest message time when it runs, so streaming text does not save on every token.
  const key = threadId === null ? null : chatThreadKey(environmentId, threadId);
  const markRead = useEffectEvent((chatKey: string, _messageId: string | null) => {
    markChatRead(chatKey, latestMs);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- saves the read time as the chat opens, as each new message lands, and as it closes.
  useEffect(() => {
    if (key === null) return;
    markRead(key, latestId);
    return () => markRead(key, latestId);
  }, [key, latestId]);
}
