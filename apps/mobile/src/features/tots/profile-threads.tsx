import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { formatBotTime, type BotStatus } from "../bots/bot-status";
import { removeBotThread, type Bot, type BotThread } from "../bots/bots-model";
import { useUpdateBotRegistry } from "../bots/bots-state";
import { useBotThreadStatus } from "./use-bot-activity";
import { TotsCard, TotsText } from "./ui";

function statusTone(kind: BotStatus["kind"]) {
  switch (kind) {
    case "working":
      return "blue" as const;
    case "needs_you":
      return "amber" as const;
    case "error":
      return "red" as const;
    default:
      return "muted" as const;
  }
}

function statusLine(status: BotStatus) {
  if (status.kind === "idle") return status.preview ?? status.label;
  return status.preview ? `${status.label} · ${status.preview}` : status.label;
}

export function ProfileThreads(props: { readonly bot: Bot }) {
  const threads = props.bot.threads ?? [];
  return (
    <>
      <MainChatRow bot={props.bot} />
      {threads.map((thread) => (
        <SideThreadRow key={thread.threadId} bot={props.bot} thread={thread} />
      ))}
      {threads.length > 0 ? (
        <TotsText variant="small" tone="muted" style={{ textAlign: "center", marginTop: 4 }}>
          Long-press a thread to remove it from Tots.
        </TotsText>
      ) : (
        <TotsText variant="small" tone="muted" style={{ textAlign: "center", marginTop: 4 }}>
          Start a new thread for a fresh task. The main chat keeps going.
        </TotsText>
      )}
    </>
  );
}

function MainChatRow(props: { readonly bot: Bot }) {
  const navigation = useNavigation();
  const status = useBotThreadStatus(props.bot, props.bot.threadId);
  return (
    <ThreadRow
      title="Main chat"
      status={status}
      time={formatBotTime(status.updatedAt)}
      onPress={() => navigation.navigate("BotChat", { botId: props.bot.id })}
    />
  );
}

function SideThreadRow(props: { readonly bot: Bot; readonly thread: BotThread }) {
  const navigation = useNavigation();
  const updateRegistry = useUpdateBotRegistry();
  const status = useBotThreadStatus(props.bot, props.thread.threadId);
  return (
    <ThreadRow
      title={props.thread.title}
      status={status}
      time={formatBotTime(status.updatedAt ?? props.thread.createdAt)}
      onPress={() =>
        navigation.navigate("BotChat", { botId: props.bot.id, threadId: props.thread.threadId })
      }
      onLongPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Dialog.confirm({
          title: "Remove from Tots?",
          message: "The thread stays in T3 Code. Only this list forgets it.",
          confirmText: "Remove",
          destructive: true,
          onConfirm: () =>
            updateRegistry((registry) =>
              removeBotThread(registry, props.bot.id, props.thread.threadId),
            ),
        });
      }}
    />
  );
}

function ThreadRow(props: {
  readonly title: string;
  readonly status: BotStatus;
  readonly time: string;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
}) {
  return (
    <TotsCard
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      accessibilityLabel={`${props.title}, ${props.status.label}`}
      style={{ gap: 4 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TotsText style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>
          {props.title}
        </TotsText>
        <TotsText variant="small" tone="muted">
          {props.time}
        </TotsText>
      </View>
      <TotsText variant="small" tone={statusTone(props.status.kind)} numberOfLines={1}>
        {statusLine(props.status)}
      </TotsText>
    </TotsCard>
  );
}
