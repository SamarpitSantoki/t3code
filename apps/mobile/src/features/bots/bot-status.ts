import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { useThreadShell } from "../../state/entities";
import { deriveBotStatus, type BotStatus } from "./bot-status-model";
import type { Bot } from "./bots-model";

export {
  BOT_STATUS_COLORS,
  deriveBotStatus,
  formatBotTime,
  type BotStatus,
  type BotStatusKind,
} from "./bot-status-model";

export function useBotStatus(bot: Pick<Bot, "environmentId" | "threadId">): BotStatus {
  const shell = useThreadShell(
    scopeThreadRef(EnvironmentId.make(bot.environmentId), ThreadId.make(bot.threadId)),
  );
  return deriveBotStatus(
    shell === null
      ? null
      : {
          ...shell,
          source: {
            latestVisibleMessage: shell.source.latestVisibleMessage
              ? {
                  role: shell.source.latestVisibleMessage.role,
                  text: shell.source.latestVisibleMessage.text,
                }
              : null,
          },
        },
  );
}
