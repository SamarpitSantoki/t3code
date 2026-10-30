import { EnvironmentId, PROVIDER_SEND_TURN_MAX_ATTACHMENTS } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import {
  pickComposerFiles,
  pickComposerMedia,
  type DraftComposerAttachment,
} from "../../lib/composerImages";
import { useEnvironmentServerConfig } from "../../state/entities";
import { scheduleUnusedComposerAttachmentCleanup } from "../../state/use-composer-drafts";
import {
  appendChatAttachments,
  attachmentLimitMessage,
  chatFileAttachmentProblem,
} from "./chat-attachments";

export type ChatAttachmentDraft = ReturnType<typeof useChatAttachments>;

/**
 * Photos and files picked for the next message. Uses the thread composer's pickers, so the
 * same count and size limits apply. The outbox uploads them when the message is delivered.
 */
export function useChatAttachments(environmentId: string | null) {
  const serverConfig = useEnvironmentServerConfig(
    environmentId ? EnvironmentId.make(environmentId) : null,
  );
  const [attachments, setAttachments] = useState<ReadonlyArray<DraftComposerAttachment>>([]);
  const [picking, setPicking] = useState(false);
  // Pickers finish after awaits; read the list from a ref so a stale render does not drop items.
  const current = useRef<ReadonlyArray<DraftComposerAttachment>>([]);
  const mounted = useRef(true);

  const update = (next: ReadonlyArray<DraftComposerAttachment>) => {
    current.current = next;
    setAttachments(next);
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Leaving the screen must free files of an unsent draft; no handler runs then.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Files of an unsent draft are not owned by any queued message, so this removes them.
      scheduleUnusedComposerAttachmentCleanup(current.current);
    };
  }, []);

  const add = (
    title: string,
    picked: ReadonlyArray<DraftComposerAttachment>,
    error: string | null,
  ) => {
    if (!mounted.current) {
      scheduleUnusedComposerAttachmentCleanup(picked);
      return;
    }
    const result = appendChatAttachments(current.current, picked);
    update(result.attachments);
    scheduleUnusedComposerAttachmentCleanup(result.rejected);
    const problems = [
      ...(error ? [error] : []),
      ...(result.rejected.length > 0 && !error ? [attachmentLimitMessage()] : []),
    ];
    if (problems.length > 0) Dialog.alert(title, problems.join("\n\n"));
  };

  const pick = async (work: () => Promise<void>) => {
    if (picking) return;
    setPicking(true);
    // No `finally`: the React Compiler cannot lower it, and this hook must compile.
    await work().catch((error: unknown) => {
      Dialog.alert("Could not attach", error instanceof Error ? error.message : "Try again.");
    });
    if (mounted.current) setPicking(false);
  };

  const pickPhotos = () =>
    pick(async () => {
      // No video limit is passed, so the library offers photos only.
      const result = await pickComposerMedia({ existingCount: current.current.length });
      add("Could not attach photo", result.attachments, result.error);
    });

  const pickFiles = () =>
    pick(async () => {
      const maxBytes = serverConfig?.environment.capabilities.fileAttachments?.maxUploadBytes;
      if (maxBytes === undefined) {
        Dialog.alert("Could not attach file", "This server does not support file attachments.");
        return;
      }
      const result = await pickComposerFiles({
        existingCount: current.current.length,
        maxBytes,
      });
      add("Could not attach file", result.files, result.error);
    });

  const remove = (id: string) => {
    const removed = current.current.filter((attachment) => attachment.id === id);
    update(current.current.filter((attachment) => attachment.id !== id));
    scheduleUnusedComposerAttachmentCleanup(removed);
  };

  /** Empties the tray for sending. Returns null, after an alert, when the server cannot take the files. */
  const take = (): ReadonlyArray<DraftComposerAttachment> | null => {
    const taken = current.current;
    // A restore after a failed send can go over the limit; the outbox would refuse it.
    if (taken.length > PROVIDER_SEND_TURN_MAX_ATTACHMENTS) {
      Dialog.alert("Too many attachments", attachmentLimitMessage());
      return null;
    }
    const blocked = chatFileAttachmentProblem({ attachments: taken, serverConfig });
    if (blocked !== null) {
      Dialog.alert("Could not send", blocked);
      return null;
    }
    update([]);
    return taken;
  };

  /** Puts attachments back after a failed send, before anything picked meanwhile. */
  const restore = (restored: ReadonlyArray<DraftComposerAttachment>) => {
    if (!mounted.current) {
      scheduleUnusedComposerAttachmentCleanup(restored);
      return;
    }
    const known = new Set(restored.map((attachment) => attachment.id));
    update([...restored, ...current.current.filter((attachment) => !known.has(attachment.id))]);
  };

  return { attachments, picking, pickPhotos, pickFiles, remove, take, restore };
}
