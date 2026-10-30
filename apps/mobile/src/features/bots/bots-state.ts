import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  CommandId,
  EnvironmentId,
  MessageId,
  ThreadId,
  type ModelSelection,
  type RuntimeMode,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { AsyncResult, Atom } from "effect/reactivity";

import type { DraftComposerAttachment } from "../../lib/composerImages";
import { makeQueuedMessageMetadata, makeTurnCommandMetadata } from "../../lib/commandMetadata";
import { uuidv4 } from "../../lib/uuid";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { appAtomRegistry } from "../../state/atom-registry";
import {
  clearPendingThreadCreationOutcome,
  pendingThreadCreationOutcomesAtom,
} from "../../state/pending-thread-creation";
import { enqueueThreadOutboxMessage, threadOutboxManager } from "../../state/thread-outbox";
import type { QueuedThreadMessage } from "../../state/thread-outbox-model";
import { removeThreadOutboxMessage } from "../../state/thread-outbox-removal";
import { dispatchingQueuedMessageIdAtom } from "../../state/use-thread-outbox";
import { scopedThreadKey } from "../../lib/scopedEntities";
import { useProject, useThreadShell } from "../../state/entities";
import { environmentThreadDetails } from "../../state/threads";
import { botChatCardItems } from "./chat-request-items";
import {
  buildBotSetupMessage,
  buildBotThreadOpening,
  type BotThread,
  buildTeamBriefMessage,
  buildTeamTimeline,
  EMPTY_BOT_REGISTRY,
  type Bot,
  type BotRegistry,
  type BotTeam,
  type TeamTimelineEntry,
} from "./bots-model";

export function useBotRegistry() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return {
    loaded: AsyncResult.isSuccess(preferences),
    registry: AsyncResult.isSuccess(preferences)
      ? (preferences.value.bots ?? EMPTY_BOT_REGISTRY)
      : EMPTY_BOT_REGISTRY,
  };
}

export function useUpdateBotRegistry() {
  const save = useAtomSet(updateMobilePreferencesAtom);
  // Transforms read optimistic state, so back-to-back edits compose.
  return (transform: (registry: BotRegistry) => BotRegistry) =>
    save({ transform: (current) => ({ bots: transform(current.bots ?? EMPTY_BOT_REGISTRY) }) });
}

interface NewThreadTarget {
  readonly project: EnvironmentProject;
  readonly modelSelection: ModelSelection;
  readonly runtimeMode: RuntimeMode;
}

async function startBotThread(
  target: NewThreadTarget,
  text: string,
  attachments: ReadonlyArray<DraftComposerAttachment> = [],
) {
  const metadata = makeTurnCommandMetadata();
  await enqueueThreadOutboxMessage({
    environmentId: target.project.environmentId,
    threadId: ThreadId.make(metadata.threadId),
    messageId: MessageId.make(metadata.messageId),
    commandId: CommandId.make(metadata.commandId),
    text,
    attachments,
    modelSelection: target.modelSelection,
    runtimeMode: target.runtimeMode,
    interactionMode: "default",
    // Bots share the project checkout, like teammates sharing one computer.
    creation: {
      projectId: target.project.id,
      projectTitle: target.project.title,
      projectCwd: target.project.workspaceRoot,
      workspaceMode: "local",
      branch: null,
      worktreePath: null,
    },
    createdAt: metadata.createdAt,
  });
  return metadata;
}

export async function createBot(
  input: NewThreadTarget & {
    readonly name: string;
    readonly role: string;
    readonly emoji: string;
    readonly color: string;
    readonly accessory?: string;
    /** The template the bot started from, if any. */
    readonly template?: string | null;
  },
): Promise<Bot> {
  const name = input.name.trim();
  const role = input.role.trim();
  const metadata = await startBotThread(
    input,
    buildBotSetupMessage({
      name,
      role,
      emoji: input.emoji,
      color: input.color,
      template: input.template ?? undefined,
    }),
  );
  return {
    id: uuidv4(),
    name,
    role,
    environmentId: input.project.environmentId,
    threadId: metadata.threadId,
    setupMessageId: metadata.messageId,
    createdAt: metadata.createdAt,
    emoji: input.emoji,
    color: input.color,
    ...(input.accessory ? { accessory: input.accessory } : {}),
  };
}

/** Opens a fresh thread with the same bot; the task starts it working right away. */
export async function createBotThread(
  input: NewThreadTarget & {
    readonly bot: Bot;
    readonly task: string;
    readonly attachments?: ReadonlyArray<DraftComposerAttachment>;
  },
): Promise<BotThread> {
  const task = input.task.trim();
  const metadata = await startBotThread(
    input,
    buildBotThreadOpening({
      name: input.bot.name,
      role: input.bot.role,
      mainThreadId: input.bot.threadId,
      task,
    }),
    input.attachments,
  );
  return {
    threadId: metadata.threadId,
    title: task.length > 60 ? `${task.slice(0, 57).trimEnd()}...` : task,
    setupMessageId: metadata.messageId,
    createdAt: metadata.createdAt,
  };
}

/** Where a new thread for this bot runs: its main chat's project, model and mode. */
export function useBotThreadTarget(bot: Bot | null): NewThreadTarget | null {
  const shell = useThreadShell(
    bot === null
      ? null
      : scopeThreadRef(EnvironmentId.make(bot.environmentId), ThreadId.make(bot.threadId)),
  );
  const project = useProject(
    shell === null ? null : scopeProjectRef(shell.environmentId, shell.projectId),
  );
  if (shell === null || project === null) return null;
  return { project, modelSelection: shell.modelSelection, runtimeMode: shell.runtimeMode };
}

/** The setup message still waiting in the outbox for a thread, or the reason the server refused it. */
export function useQueuedBotSetup(environmentId: string, threadId: string) {
  const key = scopedThreadKey(EnvironmentId.make(environmentId), ThreadId.make(threadId));
  const queued =
    useAtomValue(threadOutboxManager.queuedMessagesByThreadKeyAtom)[key]?.find(
      (message) => message.creation !== undefined,
    ) ?? null;
  const outcome = useAtomValue(pendingThreadCreationOutcomesAtom)[key];
  const failed = outcome?.kind === "failed" ? outcome : null;
  return {
    message: queued ?? failed?.message ?? null,
    failedReason: queued === null && failed !== null ? failed.reason : null,
  };
}

/**
 * Starts a bot thread again, dropping the old setup message if it never left the device.
 * Rejects while that message is mid-send, so the server never gets both.
 */
export async function restartBotSetup(
  input: NewThreadTarget & { readonly text: string; readonly previous: QueuedThreadMessage | null },
) {
  const previous = input.previous;
  if (previous !== null) {
    const removed = await removeThreadOutboxMessage(
      previous,
      undefined,
      () => appAtomRegistry.get(dispatchingQueuedMessageIdAtom) !== previous.messageId,
    );
    const stillQueued = Object.values(
      appAtomRegistry.get(threadOutboxManager.queuedMessagesByThreadKeyAtom),
    ).some((queue) => queue.some((message) => message.messageId === previous.messageId));
    if (!removed && stillQueued) {
      throw new Error("The first try is being sent right now. Wait a moment and look again.");
    }
    clearPendingThreadCreationOutcome(scopedThreadKey(previous.environmentId, previous.threadId));
  }
  return startBotThread(input, input.text);
}

/** Returns the queued message id. The outbox uploads attachments when it delivers. */
export async function sendToBot(
  bot: Bot,
  text: string,
  threadId = bot.threadId,
  attachments: ReadonlyArray<DraftComposerAttachment> = [],
): Promise<string> {
  const metadata = makeQueuedMessageMetadata();
  await enqueueThreadOutboxMessage({
    environmentId: EnvironmentId.make(bot.environmentId),
    threadId: ThreadId.make(threadId),
    messageId: MessageId.make(metadata.messageId),
    commandId: CommandId.make(metadata.commandId),
    text,
    attachments,
    createdAt: metadata.createdAt,
  });
  return metadata.messageId;
}

export async function createTeam(input: {
  readonly name: string;
  readonly lead: Bot;
  readonly members: ReadonlyArray<Bot>;
}): Promise<BotTeam> {
  const name = input.name.trim();
  const briefMessageId = await sendToBot(
    input.lead,
    buildTeamBriefMessage({ teamName: name, lead: input.lead, members: input.members }),
  );
  return {
    id: uuidv4(),
    name,
    environmentId: input.lead.environmentId,
    leadBotId: input.lead.id,
    memberBotIds: input.members.map((member) => member.id),
    briefMessageIds: [briefMessageId],
    createdAt: new Date().toISOString(),
  };
}

interface TeamTimelineKey {
  readonly bots: ReadonlyArray<
    Pick<Bot, "id" | "name" | "environmentId" | "threadId" | "setupMessageId">
  >;
  readonly hiddenMessageIds: ReadonlyArray<string>;
  readonly senders: ReadonlyArray<Pick<Bot, "threadId" | "name">>;
}

const EMPTY_TIMELINE: TeamTimelineEntry[] = [];

const teamTimelineAtom = Atom.family((key: string) => {
  const { bots, hiddenMessageIds, senders } = JSON.parse(key) as TeamTimelineKey;
  return Atom.make((get) =>
    buildTeamTimeline({
      hiddenMessageIds,
      senders,
      sources: bots.map((bot) => {
        const ref = scopeThreadRef(
          EnvironmentId.make(bot.environmentId),
          ThreadId.make(bot.threadId),
        );
        const thread = get(environmentThreadDetails.threadAtom(ref));
        return {
          bot,
          cardItems: botChatCardItems(get(environmentThreadDetails.visibleTurnItemsAtom(ref))),
          messages: (thread?.projection.messages ?? []).map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            createdAt: DateTime.formatIso(message.createdAt),
            streaming: message.streaming,
            senderThreadId: message.senderThreadId,
            attachments: message.attachments,
          })),
        };
      }),
    }),
  ).pipe(Atom.withLabel(`mobile-bot-team-timeline:${key}`));
});

const EMPTY_TIMELINE_ATOM = Atom.make(EMPTY_TIMELINE).pipe(
  Atom.withLabel("mobile-bot-team-timeline:empty"),
);

function timelineKey(
  bots: ReadonlyArray<Bot>,
  hiddenMessageIds: ReadonlyArray<string>,
  senders: ReadonlyArray<Bot>,
): string {
  const key: TeamTimelineKey = {
    bots: bots.map(({ id, name, environmentId, threadId, setupMessageId }) => ({
      id,
      name,
      environmentId,
      threadId,
      setupMessageId,
    })),
    hiddenMessageIds,
    senders: senders.map(({ threadId, name }) => ({ threadId, name })),
  };
  return JSON.stringify(key);
}

export function useTeamTimeline(team: BotTeam | null, bots: ReadonlyArray<Bot>) {
  const members =
    team === null
      ? []
      : [team.leadBotId, ...team.memberBotIds].flatMap((id) => {
          const bot = bots.find((candidate) => candidate.id === id);
          return bot ? [bot] : [];
        });
  return useAtomValue(
    team === null
      ? EMPTY_TIMELINE_ATOM
      : teamTimelineAtom(timelineKey(members, team.briefMessageIds, [])),
  );
}

/** One bot's chat; team briefs it received as a lead stay hidden here too. */
export function useBotTimeline(bot: Bot | null, registry: BotRegistry, threadId?: string) {
  const thread = bot?.threads?.find((candidate) => candidate.threadId === threadId);
  // A side thread removed from the list must still show its own messages, not the main chat.
  const source =
    bot && threadId !== undefined && threadId !== bot.threadId
      ? { ...bot, threadId, setupMessageId: thread?.setupMessageId ?? "" }
      : bot;
  return useAtomValue(
    source === null
      ? EMPTY_TIMELINE_ATOM
      : teamTimelineAtom(
          timelineKey(
            [source],
            registry.teams.flatMap((team) => team.briefMessageIds),
            registry.bots,
          ),
        ),
  );
}
