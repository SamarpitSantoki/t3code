import { isServerConnected, type ServerSummary } from "../tots/server-model";
import type { Bot, BotRegistry } from "./bots-model";

export interface RestartedSetup {
  readonly environmentId: string;
  readonly threadId: string;
  readonly setupMessageId: string;
  readonly createdAt: string;
}

/**
 * Points a bot at the thread that replaced `oldThreadId`. The main chat may change server;
 * a side thread keeps the bot's server, so only its own ids change.
 */
export function replaceBotSetup(
  registry: BotRegistry,
  botId: string,
  oldThreadId: string,
  next: RestartedSetup,
): BotRegistry {
  return {
    ...registry,
    bots: registry.bots.map((bot): Bot => {
      if (bot.id !== botId) return bot;
      if (bot.threadId === oldThreadId) {
        return {
          ...bot,
          environmentId: next.environmentId,
          threadId: next.threadId,
          setupMessageId: next.setupMessageId,
        };
      }
      return {
        ...bot,
        threads: bot.threads?.map((thread) =>
          thread.threadId === oldThreadId
            ? {
                ...thread,
                threadId: next.threadId,
                setupMessageId: next.setupMessageId,
                createdAt: next.createdAt,
              }
            : thread,
        ),
      };
    }),
  };
}

/** A bot can only change server while nothing else ties it to the old one. */
export function canMoveBot(registry: BotRegistry, bot: Bot): boolean {
  if ((bot.threads?.length ?? 0) > 0) return false;
  return !registry.teams.some(
    (team) => team.leadBotId === bot.id || team.memberBotIds.includes(bot.id),
  );
}

interface ProjectLike {
  readonly environmentId: string;
}

/** Projects a setup can restart on: connected servers only, optionally skipping one. */
export function restartProjects<P extends ProjectLike>(input: {
  readonly projects: ReadonlyArray<P>;
  readonly servers: ReadonlyArray<ServerSummary>;
  readonly excludeEnvironmentId?: string;
}): ReadonlyArray<P> {
  const connected = new Set(
    input.servers.filter(isServerConnected).map((server) => server.environmentId),
  );
  return input.projects.filter(
    (project) =>
      connected.has(project.environmentId) && project.environmentId !== input.excludeEnvironmentId,
  );
}
