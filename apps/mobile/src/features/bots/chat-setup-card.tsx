import { useNavigation } from "@react-navigation/native";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { DEFAULT_RUNTIME_MODE, type ModelSelection } from "@t3tools/contracts";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import {
  buildModelOptions,
  resolveDefaultableModelSelection,
  resolveNewTaskModelSelection,
} from "../../lib/modelOptions";
import { scopedProjectKey } from "../../lib/scopedEntities";
import { useProjects } from "../../state/entities";
import { useNewTaskProjectDefaults } from "../threads/use-new-task-project-defaults";
import { BotFace } from "../tots/BotFace";
import { serverName, setupCardFor, SETUP_SLOW_MS, type ServerSummary } from "../tots/server-model";
import { ServerDot, useServers } from "../tots/server-ui";
import { TotsButton, TotsCard, TotsText } from "../tots/ui";
import { buildBotSetupMessage, type Bot } from "./bots-model";
import {
  restartBotSetup,
  useBotRegistry,
  useBotThreadTarget,
  useQueuedBotSetup,
  useUpdateBotRegistry,
} from "./bots-state";
import { canMoveBot, replaceBotSetup, restartProjects } from "./chat-setup";

type ThreadTarget = NonNullable<ReturnType<typeof useBotThreadTarget>>;

const keyOf = (project: EnvironmentProject) => scopedProjectKey(project.environmentId, project.id);

/** Shown while a bot thread has not reached the app: says why and offers a way out. */
export function BotSetupCard(props: {
  readonly bot: Bot;
  readonly threadId: string;
  readonly isMain: boolean;
  /** Called with the replacement thread once setup has been queued again. */
  readonly onRestarted: (threadId: string) => void;
}) {
  const { bot, threadId, isMain } = props;
  const navigation = useNavigation();
  const servers = useServers();
  const projects = useProjects();
  const { registry } = useBotRegistry();
  const updateRegistry = useUpdateBotRegistry();
  const setup = useQueuedBotSetup(bot.environmentId, threadId);
  const mainTarget = useBotThreadTarget(isMain ? null : bot);
  const [since, setSince] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  const server = servers.find((candidate) => candidate.environmentId === bot.environmentId);
  const queuedAt = isMain
    ? bot.createdAt
    : (bot.threads?.find((thread) => thread.threadId === threadId)?.createdAt ?? bot.createdAt);
  const card = setupCardFor({
    hasThread: false,
    server,
    queuedAt,
    since,
    now,
    failedReason: setup.failedReason,
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One timer flips "starting" to "slow"; no app event marks a setup message as overdue.
  useEffect(() => {
    if (card.kind !== "starting") return;
    const startedAt = Math.max(Date.parse(queuedAt) || 0, since);
    const timer = setTimeout(() => setNow(Date.now()), startedAt + SETUP_SLOW_MS - Date.now());
    return () => clearTimeout(timer);
  }, [card.kind, queuedAt, since]);

  const message = setup.message;
  const text = message?.text ?? (isMain ? buildBotSetupMessage(bot) : null);
  const sourceProject =
    message?.creation === undefined || message === null
      ? null
      : (projects.find(
          (project) =>
            project.environmentId === message.environmentId &&
            project.id === message.creation?.projectId,
        ) ?? null);
  const sameTarget: ThreadTarget | null =
    sourceProject !== null && message?.modelSelection
      ? {
          project: sourceProject,
          modelSelection: message.modelSelection,
          runtimeMode: message.runtimeMode ?? DEFAULT_RUNTIME_MODE,
        }
      : (mainTarget ?? null);
  const otherProjects = canMoveBot(registry, bot)
    ? restartProjects({ projects, servers, excludeEnvironmentId: bot.environmentId })
    : [];
  const anyProjects = isMain ? restartProjects({ projects, servers }) : [];
  const chosen = projects.find((project) => keyOf(project) === chosenKey) ?? null;

  const restart = (target: ThreadTarget) => {
    if (restarting || text === null) return;
    setRestarting(true);
    restartBotSetup({ ...target, text, previous: message })
      .then((metadata) => {
        updateRegistry((current) =>
          replaceBotSetup(current, bot.id, threadId, {
            environmentId: target.project.environmentId,
            threadId: metadata.threadId,
            setupMessageId: metadata.messageId,
            createdAt: metadata.createdAt,
          }),
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRestarting(false);
        setChosenKey(null);
        setSince(Date.now());
        setNow(Date.now());
        props.onRestarted(metadata.threadId);
      })
      .catch((error: unknown) => {
        setRestarting(false);
        Dialog.alert(
          "Could not start again",
          error instanceof Error ? error.message : String(error),
        );
      });
  };

  if (card.kind === "none") return null;
  if (card.kind === "starting") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
        <BotFace bot={bot} size={20} mood="setup" />
        <TotsText variant="small" tone="muted">{`Setting up ${bot.name}…`}</TotsText>
      </View>
    );
  }

  const openServers = (
    <TotsButton
      label="Open servers"
      kind="light"
      size="small"
      onPress={() => navigation.navigate("SettingsEnvironments")}
    />
  );

  return (
    <TotsCard tone="amber" style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ServerDot server={server} />
        <TotsText style={{ fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
          {card.kind === "waiting" ? `Waiting for ${card.serverName}.` : "Still setting up…"}
        </TotsText>
      </View>
      <TotsText variant="small" tone="inkSoft">
        {card.kind === "waiting"
          ? `${bot.name} starts as soon as the server is online.`
          : (card.reason ??
            `${serverName(server)} is online, but ${bot.name} has not started yet.`)}
      </TotsText>
      {chosen !== null ? (
        <ConfirmRestart
          project={chosen}
          server={servers.find((candidate) => candidate.environmentId === chosen.environmentId)}
          preferred={message?.modelSelection ?? null}
          busy={restarting}
          onConfirm={restart}
          onCancel={() => setChosenKey(null)}
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {card.kind === "slow" && text !== null && sameTarget !== null ? (
            <TotsButton
              label="Try again"
              size="small"
              loading={restarting}
              onPress={() => restart(sameTarget)}
            />
          ) : null}
          {card.kind === "slow" &&
          text !== null &&
          sameTarget === null &&
          anyProjects.length > 0 ? (
            <ProjectMenu
              label="Try again"
              projects={anyProjects}
              servers={servers}
              onPick={setChosenKey}
            />
          ) : null}
          {otherProjects.length > 0 && text !== null ? (
            <ProjectMenu
              label="Start on another server"
              projects={otherProjects}
              servers={servers}
              onPick={setChosenKey}
            />
          ) : null}
          {openServers}
        </View>
      )}
    </TotsCard>
  );
}

function ProjectMenu(props: {
  readonly label: string;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly servers: ReadonlyArray<ServerSummary>;
  readonly onPick: (key: string) => void;
}) {
  return (
    <Menu
      accessibilityLabel={props.label}
      actions={props.projects.map((project) => ({
        id: keyOf(project),
        title: project.title,
        subtitle: serverName(
          props.servers.find((server) => server.environmentId === project.environmentId),
        ),
      }))}
      onPressAction={({ nativeEvent }) => props.onPick(nativeEvent.event)}
    >
      <TotsButton label={props.label} kind="light" size="small" onPress={() => undefined} />
    </Menu>
  );
}

/** Resolves the picked project's default model, keeping the bot's model when that server has it. */
function ConfirmRestart(props: {
  readonly project: EnvironmentProject;
  readonly server: ServerSummary | undefined;
  readonly preferred: ModelSelection | null;
  readonly busy: boolean;
  readonly onConfirm: (target: ThreadTarget) => void;
  readonly onCancel: () => void;
}) {
  const defaults = useNewTaskProjectDefaults(props.project);
  const options = buildModelOptions(
    defaults.serverConfig,
    null,
    undefined,
    props.project.id,
  ).filter((option) => !option.isUnavailable && !option.isHidden);
  const preferred = props.preferred;
  const model =
    (preferred === null
      ? undefined
      : options.find(
          (option) =>
            option.selection.instanceId === preferred.instanceId &&
            option.selection.model === preferred.model,
        )?.selection) ??
    resolveNewTaskModelSelection({
      draftSelection: null,
      projectDefaultSelection: resolveDefaultableModelSelection(
        defaults.serverConfig,
        defaults.projectSettings.settings.defaultModelSelection,
        props.project.id,
      ),
      stickySelection: null,
      modelOptions: options,
    });
  return (
    <View style={{ gap: 8 }}>
      <TotsText variant="small" tone="inkSoft">
        {`Start on ${props.project.title} · ${serverName(props.server)}?`}
      </TotsText>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TotsButton
          label={model ? "Start" : "No models on this server"}
          size="small"
          loading={props.busy}
          disabled={!model}
          onPress={() => {
            if (!model) return;
            props.onConfirm({
              project: props.project,
              modelSelection: model,
              runtimeMode: defaults.projectSettings.settings.defaultRuntimeMode,
            });
          }}
        />
        <TotsButton label="Cancel" kind="light" size="small" onPress={props.onCancel} />
      </View>
    </View>
  );
}
