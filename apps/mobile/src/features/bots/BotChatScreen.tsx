import {
  StackActions,
  useNavigation,
  useRoute,
  type RouteProp,
  type StaticScreenProps,
} from "@react-navigation/native";
import { useRef, useState } from "react";
import { Pressable, Text, View, type TextInputInstance } from "react-native";

import { EmptyState } from "../../components/ui/EmptyState";
import { Menu } from "../../components/ui/Menu";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { BotFace, moodForStatus } from "../tots/BotFace";
import { TOTS_FONT, TOTS_RADIUS, useTotsColors, type TotsColors } from "../tots/theme";
import { TotsGlyph, TotsText } from "../tots/ui";
import { offlineSendNote } from "../tots/server-model";
import { useServer } from "../tots/server-ui";
import { useMarkChatRead } from "../tots/chat-read-state";
import { useBotThreadStatus } from "../tots/use-bot-activity";
import { useOpenThreadSteps } from "./chat-open-steps";
import {
  BotChatView,
  ChatSendButton,
  ChatStopButton,
  ChatSuggestions,
  type ChatBot,
} from "./BotChatView";
import { BotRequests } from "./BotRequestCard";
import { ChatAttachMenu } from "./ChatAttachments";
import type { Bot } from "./bots-model";
import { useBotRegistry, useBotThreadTarget, useBotTimeline } from "./bots-state";
import { useStartBotThread } from "./chat-new-thread";
import { BotSetupCard } from "./chat-setup-card";
import { mergePendingMessages } from "./chat-pending";
import { chatStatusLine, resolveShownChat, type ChatStatusTone } from "./chat-thread";
import { layoutTeamTimeline } from "./team-timeline-layout";
import { useBotRequests } from "./use-bot-requests";
import { useChatAttachments } from "./use-chat-attachments";
import { useChatSend } from "./use-chat-send";

type BotChatParams = {
  readonly botId: string;
  readonly threadId?: string;
  /** Opens an empty composer; the first message starts a new thread. */
  readonly newThread?: boolean;
};

type BotChatScreenProps = StaticScreenProps<BotChatParams>;

const SUGGESTIONS = [
  { label: "What can you do?", draft: "What can you help me with in this project?" },
  { label: "Status update", draft: "Give me a short status update on your current work." },
  { label: "Plan next steps", draft: "Look at the project and suggest the next 3 tasks." },
];

export function BotChatScreen({ route }: BotChatScreenProps) {
  const navigation = useNavigation();
  const openThreadSteps = useOpenThreadSteps();
  const colors = useTotsColors();
  const { registry, loaded } = useBotRegistry();
  const bot = registry.bots.find((candidate) => candidate.id === route.params.botId) ?? null;
  const shown = bot ? resolveShownChat(bot, route.params) : null;
  const timeline = useBotTimeline(
    shown?.kind === "new" ? null : bot,
    registry,
    shown?.kind === "side" ? shown.threadId : undefined,
  );
  const target = useBotThreadTarget(bot);
  const [text, setText] = useState("");
  const attachments = useChatAttachments(bot?.environmentId ?? null);
  const { pending, send } = useChatSend({ text, setText, attachments });
  const thread = useStartBotThread({ text, setText, attachments });
  const inputRef = useRef<TextInputInstance>(null);
  const threadStatus = useBotThreadStatus(
    { environmentId: bot?.environmentId ?? "" },
    shown?.threadId ?? "",
  );
  const server = useServer(bot?.environmentId ?? null);
  useMarkChatRead(
    bot?.environmentId ?? "",
    bot && shown && shown.kind !== "new" ? (shown.threadId ?? bot.threadId) : null,
  );

  if (!bot || !shown) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NativeStackScreenOptions options={{ title: "Bot" }} />
        <EmptyState
          variant="plain"
          title={loaded ? "Bot not found" : "Loading bot"}
          detail={loaded ? "This bot was removed from your list." : ""}
        />
      </View>
    );
  }

  const isNew = shown.kind === "new";
  const settingUp = !isNew && threadStatus.kind === "setting_up";
  const sendNote =
    isNew || settingUp ? null : offlineSendNote({ server, pendingCount: pending.length });
  const threadBot: Bot = { ...bot, threadId: shown.threadId ?? bot.threadId };
  const items = layoutTeamTimeline(mergePendingMessages(timeline, [...pending, ...thread.pending]));
  const openSteps = () => openThreadSteps(bot.environmentId, threadBot.threadId);
  const openNewThread = () =>
    navigation.dispatch(StackActions.push("BotChat", { botId: bot.id, newThread: true }));
  const botFor = (botId: string, name: string): ChatBot =>
    registry.bots.find((candidate) => candidate.id === botId) ??
    registry.bots.find((candidate) => candidate.name === name) ?? { id: botId || name, name };
  const fill = (draft: string) => {
    setText(draft);
    inputRef.current?.focus();
  };
  const onSend = isNew
    ? () =>
        thread.start(bot, target, (created) =>
          navigation.setParams({ threadId: created.threadId, newThread: undefined }),
        )
    : () => send(threadBot, text);

  return (
    <>
      <NativeStackScreenOptions options={{ title: bot.name }} />
      <BotChatView
        items={items}
        botFor={botFor}
        showBotNames={false}
        savedBots={registry.bots}
        onOpenSender={(botId, threadId) =>
          navigation.dispatch(
            StackActions.push("BotChat", threadId ? { botId, threadId } : { botId }),
          )
        }
        pendingLabel={sendNote !== null ? "Waiting for server" : undefined}
        environmentId={bot.environmentId}
        header={
          shown.kind === "main" ? (
            <BotIntro
              bot={bot}
              onPress={() => navigation.navigate("BotProfile", { botId: bot.id })}
            />
          ) : undefined
        }
        empty={
          isNew ? (
            <ChatNote>{`Start a fresh thread. ${bot.name} keeps the same job but none of the earlier chat.`}</ChatNote>
          ) : shown.kind === "side" ? (
            <ChatNote>No messages in this thread yet.</ChatNote>
          ) : (
            <View style={{ paddingTop: 8 }}>
              <ChatSuggestions suggestions={SUGGESTIONS} onPick={fill} />
            </View>
          )
        }
        aboveComposer={
          isNew ? undefined : settingUp ? (
            <BotSetupCard
              bot={bot}
              threadId={threadBot.threadId}
              isMain={shown.kind === "main"}
              onRestarted={(threadId) =>
                navigation.setParams({ threadId: shown.kind === "main" ? undefined : threadId })
              }
            />
          ) : (
            <>
              <BotRequests bot={threadBot} />
              <BotActivity bot={bot} threadId={threadBot.threadId} onOpenSteps={openSteps} />
              {sendNote !== null ? <SendNote>{sendNote}</SendNote> : null}
            </>
          )
        }
        composer={{
          ref: inputRef,
          value: text,
          onChangeText: setText,
          placeholder: isNew
            ? `What should ${bot.name} work on?`
            : settingUp
              ? "Waiting for the server…"
              : `Message ${bot.name}`,
          accessibilityLabel: `Message ${bot.name}`,
          onSend,
          busy: thread.starting || settingUp,
          editable: !settingUp,
          attachments: attachments.attachments,
          onRemoveAttachment: attachments.remove,
          picking: attachments.picking,
          // The first message names a new thread, so it needs words.
          requiresText: isNew,
          leading: (
            <ChatAttachMenu
              disabled={settingUp}
              actions={isNew ? [] : [{ id: "new", title: "New thread" }]}
              onAction={(id) => {
                if (id === "new") openNewThread();
              }}
              onPhoto={() => void attachments.pickPhotos()}
              onFile={() => void attachments.pickFiles()}
            />
          ),
          idleAction: isNew ? undefined : <StopAction bot={threadBot} />,
        }}
      />
    </>
  );
}

function useRouteBot() {
  const route = useRoute<RouteProp<{ BotChat: BotChatParams }, "BotChat">>();
  const { registry } = useBotRegistry();
  const bot = registry.bots.find((candidate) => candidate.id === route.params.botId) ?? null;
  return { bot, shown: bot ? resolveShownChat(bot, route.params) : null };
}

/** Registered as the route's header title; renders a component so its hooks stay its own. */
export function BotChatHeaderTitle() {
  return <HeaderTitle />;
}

export function BotChatHeaderMenu() {
  return <HeaderMenu />;
}

function HeaderTitle() {
  const { bot, shown } = useRouteBot();
  if (!bot || !shown) return null;
  if (shown.kind === "new") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <BotFace bot={bot} size={32} />
        <TotsText variant="heading" numberOfLines={1} style={{ fontSize: 16, flexShrink: 1 }}>
          {`New thread with ${bot.name}`}
        </TotsText>
      </View>
    );
  }
  return (
    <ThreadHeaderTitle
      bot={bot}
      threadId={shown.threadId}
      subtitle={shown.kind === "side" ? `Thread · ${shown.title}` : null}
    />
  );
}

function toneColor(tone: ChatStatusTone, colors: TotsColors) {
  return { blue: colors.blue, amber: colors.amberText, red: colors.red, muted: colors.muted }[tone];
}

function ThreadHeaderTitle(props: {
  readonly bot: Bot;
  readonly threadId: string;
  readonly subtitle: string | null;
}) {
  const colors = useTotsColors();
  const status = useBotThreadStatus(props.bot, props.threadId);
  const line = chatStatusLine(status.kind);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <BotFace bot={props.bot} size={32} mood={moodForStatus(status.kind)} />
      <View style={{ flexShrink: 1 }}>
        <TotsText variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
          {props.bot.name}
        </TotsText>
        <Text
          numberOfLines={1}
          style={[
            TOTS_FONT.small,
            { color: props.subtitle ? colors.muted : toneColor(line.tone, colors) },
          ]}
        >
          {props.subtitle ?? line.label}
        </Text>
      </View>
    </View>
  );
}

function HeaderMenu() {
  const { bot, shown } = useRouteBot();
  const navigation = useNavigation();
  const openThreadSteps = useOpenThreadSteps();
  const colors = useTotsColors();
  if (!bot || !shown) return null;
  const threadId = shown.threadId;
  return (
    <Menu
      accessibilityLabel="Bot options"
      actions={[
        { id: "new", title: "New thread" },
        { id: "threads", title: "Threads" },
        { id: "profile", title: "Profile" },
        ...(threadId ? [{ id: "tools", title: "Show tools and files" }] : []),
      ]}
      onPressAction={({ nativeEvent }) => {
        switch (nativeEvent.event) {
          case "new":
            navigation.dispatch(StackActions.push("BotChat", { botId: bot.id, newThread: true }));
            return;
          case "threads":
          case "profile":
            navigation.navigate("BotProfile", { botId: bot.id });
            return;
          case "tools":
            if (threadId) {
              openThreadSteps(bot.environmentId, threadId);
            }
        }
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bot options"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.sunken : "transparent",
        })}
      >
        <TotsGlyph size={18}>···</TotsGlyph>
      </Pressable>
    </Menu>
  );
}

function BotIntro(props: { readonly bot: Bot; readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.bot.name} profile`}
      onPress={props.onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        gap: 6,
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 24,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <BotFace bot={props.bot} size={64} />
      <TotsText variant="heading">{props.bot.name}</TotsText>
      <TotsText variant="small" tone="muted" numberOfLines={2} style={{ textAlign: "center" }}>
        {props.bot.role}
      </TotsText>
    </Pressable>
  );
}

function ChatNote(props: { readonly children: string }) {
  return (
    <View style={{ paddingHorizontal: 24, paddingVertical: 32, alignItems: "center" }}>
      <TotsText tone="muted" style={{ textAlign: "center" }}>
        {props.children}
      </TotsText>
    </View>
  );
}

function SendNote(props: { readonly children: string }) {
  const colors = useTotsColors();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: colors.amberSoft,
        paddingVertical: 4,
        paddingHorizontal: 12,
      }}
    >
      <Text numberOfLines={2} style={[TOTS_FONT.small, { color: colors.amberInk }]}>
        {props.children}
      </Text>
    </View>
  );
}

function BotActivity(props: {
  readonly bot: Bot;
  readonly threadId: string;
  readonly onOpenSteps: () => void;
}) {
  const colors = useTotsColors();
  const status = useBotThreadStatus(props.bot, props.threadId);
  if (status.kind !== "working" && status.kind !== "error" && status.kind !== "setting_up") {
    return null;
  }
  const label =
    status.kind === "working"
      ? `${props.bot.name} is working`
      : status.kind === "error"
        ? `${props.bot.name} hit an error`
        : `${props.bot.name} is setting up`;
  const link = status.kind === "error" ? "Show details" : "Show steps";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Shows the tools and files this bot is using"
      onPress={props.onOpenSteps}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: colors.sunken,
        paddingVertical: 4,
        paddingLeft: 5,
        paddingRight: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <BotFace bot={props.bot} size={20} mood={moodForStatus(status.kind)} />
      <Text numberOfLines={1} style={[TOTS_FONT.small, { color: colors.muted, flexShrink: 1 }]}>
        {`${label} · `}
        <Text style={{ color: status.kind === "error" ? colors.red : colors.blue }}>{link}</Text>
      </Text>
    </Pressable>
  );
}

/** Stops the thread's run while the input is empty; otherwise a disabled send button. */
function StopAction(props: { readonly bot: Bot }) {
  const requests = useBotRequests(props.bot);
  if (!requests.canStop) return <ChatSendButton disabled />;
  return (
    <ChatStopButton
      name={props.bot.name}
      stopping={requests.stopping}
      onStop={() => void requests.stop()}
    />
  );
}
