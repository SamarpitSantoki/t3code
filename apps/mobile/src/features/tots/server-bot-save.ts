import * as Haptics from "expo-haptics";

import { uuidv4 } from "../../lib/uuid";
import { addBot, type Bot } from "../bots/bots-model";
import { useUpdateBotRegistry } from "../bots/bots-state";
import { serverBotToBot, type ServerBotEntry } from "../bots/server-bots-model";

/** Saves a bot found on the server to this phone and returns the saved bot. */
export function useSaveServerBot(): (entry: ServerBotEntry) => Bot {
  const updateRegistry = useUpdateBotRegistry();
  return (entry) => {
    // The face is seeded by the thread, so it matches the one shown before saving.
    const bot = { ...serverBotToBot(entry, entry.threadId), id: uuidv4() };
    updateRegistry((current) => addBot(current, bot));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return bot;
  };
}
