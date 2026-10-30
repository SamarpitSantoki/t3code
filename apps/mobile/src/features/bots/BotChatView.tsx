import { KeyboardAwareLegendList, useKeyboardChatComposerInset } from "@legendapp/list/keyboard";
import type { LegendListRef } from "@legendapp/list/react-native";
import * as Haptics from "expo-haptics";
import { useRef, useState, type ComponentPropsWithRef, type ReactNode, type Ref } from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputInstance,
  type ViewInstance,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilePreviewModal, type FilePreviewSource } from "../../components/FilePreviewModal";
import { Menu } from "../../components/ui/Menu";
import type { DraftComposerAttachment } from "../../lib/composerImages";
import { copyTextWithHaptic } from "../../lib/copyTextWithHaptic";
import { NativeScrollViewMarker } from "../../native/NativeScrollViewMarker";
import { BotFace } from "../tots/BotFace";
import { TOTS_FONT, TOTS_RADIUS, useTotsColors } from "../tots/theme";
import { TotsGlyph, TotsText } from "../tots/ui";
import { BotChatCardRow } from "./BotChatCard";
import { BotMarkdown } from "./BotMarkdown";
import { agentTalkLabel, findAgentSender } from "./agent-sender";
import { formatBotTime } from "./bot-status";
import type { Bot, TeamTimelineEntry } from "./bots-model";
import { ChatAttachmentTray, ChatMessageAttachments } from "./ChatAttachments";
import { canSendChat } from "./chat-attachments";
import {
  groupHandoffs,
  handoffLabel,
  taskPreview,
  type HandoffGroupItem,
} from "./chat-handoff-groups";
import type { TeamTimelineItem } from "./team-timeline-layout";

export type ChatBot = Pick<Bot, "id" | "emoji" | "color" | "accessory"> & {
  readonly name: string;
};

const COMPOSER_ESTIMATE = 76;
const SEND_SIZE = 38;

function ChatScrollView(props: ComponentPropsWithRef<typeof Animated.ScrollView>) {
  return (
    <NativeScrollViewMarker style={{ flex: 1 }}>
      <Animated.ScrollView {...props} />
    </NativeScrollViewMarker>
  );
}

export function BotChatView(props: {
  readonly items: ReadonlyArray<TeamTimelineItem>;
  readonly botFor: (botId: string, name: string) => ChatBot;
  /** Team chats name each bot; a 1:1 chat already shows who it is in the header. */
  readonly showBotNames: boolean;
  readonly directToLabel?: (entry: TeamTimelineEntry) => string | null;
  readonly onOpenBot?: (botId: string) => void;
  /** Saved bots, to show who sent a bot-to-bot message. */
  readonly savedBots?: ReadonlyArray<Bot>;
  /** Opens the chat of a saved bot that sent a bot-to-bot message, on its sending thread. */
  readonly onOpenSender?: (botId: string, threadId: string | null) => void;
  readonly header?: ReactNode;
  readonly empty: ReactNode;
  /** Activity, pending requests and the recipient chip, stacked above the input. */
  readonly aboveComposer?: ReactNode;
  readonly composer: ChatComposerProps;
  /** Shown under unsent messages, e.g. "Waiting for server" while it is offline. */
  readonly pendingLabel?: string;
  /** Where sent photos load from. */
  readonly environmentId?: string | null;
}) {
  const colors = useTotsColors();
  const insets = useSafeAreaInsets();
  const listRef = useRef<LegendListRef>(null);
  const composerRef = useRef<ViewInstance>(null);
  const [nearEnd, setNearEnd] = useState(true);
  const [preview, setPreview] = useState<FilePreviewSource | null>(null);
  const bottomInset = Math.max(insets.bottom, 8);
  const { contentInsetEndAdjustment, onComposerLayout } = useKeyboardChatComposerInset(
    listRef,
    composerRef,
    COMPOSER_ESTIMATE + bottomInset,
    0,
    0,
  );
  const items = groupHandoffs(props.items);

  const send = () => {
    props.composer.onSend();
    void listRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* oxlint-disable-next-line t3code/require-registered-list-scroll -- ChatScrollView is passed through the iOS-only spread below; Android has no header blur to register. */}
      <KeyboardAwareLegendList
        ref={listRef}
        style={{ flex: 1 }}
        {...(Platform.OS === "ios" ? { ScrollViewComponent: ChatScrollView } : {})}
        data={items}
        keyExtractor={(item) => item.id}
        getItemType={(item) =>
          item.kind === "entry" ? item.entry.kind : item.kind === "day" ? "day" : "handoffs"
        }
        estimatedItemSize={72}
        recycleItems={false}
        alignItemsAtEnd
        initialScrollAtEnd
        maintainScrollAtEnd={{
          animated: false,
          on: { dataChange: true, itemLayout: true, layout: true },
        }}
        contentInsetEndAdjustment={contentInsetEndAdjustment}
        keyboardOffset={bottomInset}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }}
        onScroll={() => setNearEnd(listRef.current?.getState().isNearEnd ?? true)}
        scrollEventThrottle={64}
        ListHeaderComponent={props.header ? <View>{props.header}</View> : undefined}
        ListEmptyComponent={<View style={{ flex: 1 }}>{props.empty}</View>}
        renderItem={({ item }) => {
          if (item.kind === "day") return <DaySeparator label={item.label} />;
          if (item.kind === "handoffs") {
            return (
              <HandoffEvent
                group={item}
                team={props.showBotNames}
                from={props.botFor("", item.from)}
                botFor={props.botFor}
              />
            );
          }
          const { entry } = item;
          if (entry.kind === "agent") {
            const match = findAgentSender(props.savedBots ?? [], {
              fromName: entry.from,
              fromThreadId: entry.fromThreadId,
            });
            const onOpenSender = props.onOpenSender;
            return (
              <AgentMessageRow
                entry={entry}
                sender={match?.bot ?? { id: entry.fromThreadId ?? entry.from, name: entry.from }}
                onOpenSender={
                  match && onOpenSender
                    ? () => onOpenSender(match.bot.id, match.threadId)
                    : undefined
                }
              />
            );
          }
          if (entry.kind === "card" && entry.card) {
            return (
              <BotChatCardRow
                card={entry.card}
                bot={props.botFor(entry.botId, entry.from)}
                createdAt={entry.createdAt}
              />
            );
          }
          if (entry.kind === "user") {
            return (
              <UserMessageRow
                entry={entry}
                grouped={item.grouped}
                directTo={props.directToLabel?.(entry) ?? null}
                pendingLabel={props.pendingLabel ?? "Sending…"}
                environmentId={props.environmentId ?? null}
                onPreview={setPreview}
              />
            );
          }
          return (
            <BotMessageRow
              entry={entry}
              grouped={item.grouped}
              showName={props.showBotNames}
              bot={props.botFor(entry.botId, entry.from)}
              onOpenBot={props.onOpenBot ? () => props.onOpenBot?.(entry.botId) : undefined}
            />
          );
        }}
      />
      <KeyboardStickyView
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        offset={{ closed: 0, opened: bottomInset }}
      >
        <View ref={composerRef} onLayout={onComposerLayout} pointerEvents="box-none">
          {nearEnd ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Jump to latest"
              onPress={() => void listRef.current?.scrollToEnd({ animated: true })}
              // Absolute, so showing it never changes the measured composer height.
              style={({ pressed }) => ({
                position: "absolute",
                bottom: "100%",
                right: 16,
                marginBottom: 8,
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <TotsGlyph size={16} tone="muted">
                ↓
              </TotsGlyph>
            </Pressable>
          )}
          <View
            style={{
              gap: 8,
              backgroundColor: colors.bg,
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: bottomInset,
            }}
          >
            {props.aboveComposer}
            <ChatComposer {...props.composer} onSend={send} />
          </View>
        </View>
      </KeyboardStickyView>
      <FilePreviewModal source={preview} onRequestClose={() => setPreview(null)} />
    </View>
  );
}

export interface ChatComposerProps {
  readonly ref?: Ref<TextInputInstance>;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly onSend: () => void;
  readonly leading?: ReactNode;
  /** Replaces the send button while the input is empty, e.g. a stop button during a run. */
  readonly idleAction?: ReactNode;
  /** Blocks sending, e.g. while a new thread is being created. */
  readonly busy?: boolean;
  /** False locks the input entirely, e.g. while the bot's thread is still being set up. */
  readonly editable?: boolean;
  /** Picked photos and files, shown above the input. */
  readonly attachments?: ReadonlyArray<DraftComposerAttachment>;
  readonly onRemoveAttachment?: (id: string) => void;
  /** A picker is reading files; shows a placeholder tile. */
  readonly picking?: boolean;
  /** Attachments alone cannot be sent, e.g. a new thread needs its task in words. */
  readonly requiresText?: boolean;
}

function ChatComposer({ ref, ...props }: ChatComposerProps) {
  const colors = useTotsColors();
  const attachmentCount = props.attachments?.length ?? 0;
  const canSend =
    canSendChat({ text: props.value, attachmentCount, requiresText: props.requiresText }) &&
    !props.busy &&
    !props.picking &&
    props.editable !== false;
  const idle = props.value.trim().length === 0 && attachmentCount === 0;
  return (
    <View
      style={{
        borderRadius: TOTS_RADIUS.input,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        padding: 5,
        gap: 4,
      }}
    >
      <ChatAttachmentTray
        attachments={props.attachments ?? []}
        picking={props.picking}
        onRemove={(id) => props.onRemoveAttachment?.(id)}
      />
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        {props.leading}
        <RNTextInput
          ref={ref}
          accessibilityLabel={props.accessibilityLabel}
          value={props.value}
          onChangeText={props.onChangeText}
          editable={props.editable ?? true}
          multiline
          placeholder={props.placeholder}
          placeholderTextColor={colors.placeholder}
          cursorColor={colors.ink}
          selectionColor={colors.blue}
          textAlignVertical="center"
          style={{
            flex: 1,
            minHeight: SEND_SIZE,
            maxHeight: 140,
            paddingHorizontal: 10,
            paddingVertical: 8,
            fontSize: 16,
            color: colors.ink,
          }}
        />
        {idle && props.idleAction ? (
          props.idleAction
        ) : (
          <ChatSendButton
            disabled={!canSend}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              props.onSend();
            }}
          />
        )}
      </View>
    </View>
  );
}

/** Round dark send button; also shown disabled when there is nothing to send. */
export function ChatSendButton(props: {
  readonly disabled: boolean;
  readonly onPress?: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: SEND_SIZE,
        height: SEND_SIZE,
        borderRadius: SEND_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
        opacity: props.disabled ? 0.25 : pressed ? 0.8 : 1,
      })}
    >
      <TotsGlyph size={18} tone="onPrimary">
        ↑
      </TotsGlyph>
    </Pressable>
  );
}

/** Stops the run; takes the send button's place while the input is empty. */
export function ChatStopButton(props: {
  readonly name: string;
  readonly stopping: boolean;
  readonly onStop: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Stop ${props.name}`}
      accessibilityState={{ busy: props.stopping }}
      disabled={props.stopping}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        props.onStop();
      }}
      style={({ pressed }) => ({
        width: SEND_SIZE,
        height: SEND_SIZE,
        borderRadius: SEND_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
        opacity: props.stopping ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.onPrimary }} />
    </Pressable>
  );
}

function DaySeparator(props: { readonly label: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 20, paddingBottom: 4 }}>
      <TotsText variant="small" tone="muted">
        {props.label}
      </TotsText>
    </View>
  );
}

function messageActions(onOpenBot: (() => void) | undefined, botName: string) {
  return [
    { id: "copy", title: "Copy text" },
    ...(onOpenBot ? [{ id: "open", title: `Open chat with ${botName}` }] : []),
  ];
}

function BotMessageRow(props: {
  readonly entry: TeamTimelineEntry;
  readonly grouped: boolean;
  readonly showName: boolean;
  readonly bot: ChatBot;
  readonly onOpenBot: (() => void) | undefined;
}) {
  const { entry, grouped } = props;
  const time = formatBotTime(entry.createdAt);
  return (
    <View style={{ marginTop: grouped ? 6 : 18, gap: 6, paddingRight: 12 }}>
      {grouped ? null : props.showName ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open chat with ${props.bot.name}`}
          disabled={!props.onOpenBot}
          onPress={props.onOpenBot}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}
        >
          <BotFace bot={props.bot} size={22} />
          <TotsText variant="label">{props.bot.name}</TotsText>
          <TotsText variant="small" tone="muted">
            {time}
          </TotsText>
        </Pressable>
      ) : time ? (
        <TotsText variant="small" tone="muted">
          {time}
        </TotsText>
      ) : null}
      <Menu
        shouldOpenOnLongPress
        actions={messageActions(props.onOpenBot, props.bot.name)}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === "copy") copyTextWithHaptic(entry.text);
          if (nativeEvent.event === "open") props.onOpenBot?.();
        }}
      >
        <Pressable accessibilityRole="text" accessibilityHint="Touch and hold for actions">
          <BotMarkdown text={entry.text} />
        </Pressable>
      </Menu>
      {entry.streaming ? (
        <TotsText variant="small" tone="muted">
          typing…
        </TotsText>
      ) : null}
    </View>
  );
}

/** A message another bot sent this bot: not the user's bubble, not this bot's reply. */
function AgentMessageRow(props: {
  readonly entry: TeamTimelineEntry;
  readonly sender: ChatBot;
  readonly onOpenSender: (() => void) | undefined;
}) {
  const colors = useTotsColors();
  const { entry, sender } = props;
  const time = formatBotTime(entry.createdAt);
  const label = agentTalkLabel(sender.name, entry.to);
  return (
    <View style={{ marginTop: 18, gap: 6, paddingRight: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole={props.onOpenSender ? "button" : "image"}
          accessibilityLabel={
            props.onOpenSender ? `Open chat with ${sender.name}` : `${sender.name}, a bot`
          }
          disabled={!props.onOpenSender}
          onPress={props.onOpenSender}
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <BotFace bot={sender} size={22} />
        </Pressable>
        <Text numberOfLines={1} style={[TOTS_FONT.label, { color: colors.ink, flexShrink: 1 }]}>
          {label}
        </Text>
        {time ? (
          <TotsText variant="small" tone="muted">
            {time}
          </TotsText>
        ) : null}
      </View>
      <Menu
        shouldOpenOnLongPress
        actions={messageActions(props.onOpenSender, sender.name)}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === "copy") copyTextWithHaptic(entry.text);
          if (nativeEvent.event === "open") props.onOpenSender?.();
        }}
      >
        <Pressable
          accessibilityRole="text"
          accessibilityLabel={`Message from ${sender.name}`}
          accessibilityHint="Touch and hold for actions"
          style={{
            alignSelf: "flex-start",
            maxWidth: "100%",
            borderRadius: 18,
            borderTopLeftRadius: 6,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <BotMarkdown text={entry.text} color={colors.inkSoft} />
        </Pressable>
      </Menu>
    </View>
  );
}

function UserMessageRow(props: {
  readonly entry: TeamTimelineEntry;
  readonly grouped: boolean;
  readonly directTo: string | null;
  readonly pendingLabel: string;
  readonly environmentId: string | null;
  readonly onPreview: (source: FilePreviewSource) => void;
}) {
  const colors = useTotsColors();
  const hasText = props.entry.text.trim().length > 0;
  return (
    <View
      style={{
        alignItems: "flex-end",
        gap: 4,
        paddingLeft: 48,
        marginTop: props.grouped ? 6 : 18,
      }}
    >
      {props.directTo !== null ? (
        <TotsText variant="small" tone="muted" style={{ paddingRight: 6 }}>
          {`to @${props.directTo}`}
        </TotsText>
      ) : null}
      <ChatMessageAttachments
        attachments={props.entry.attachments ?? []}
        environmentId={props.environmentId}
        dimmed={props.entry.pending}
        onPreview={props.onPreview}
      />
      {hasText ? (
        <Menu
          shouldOpenOnLongPress
          actions={[{ id: "copy", title: "Copy text" }]}
          onPressAction={() => copyTextWithHaptic(props.entry.text)}
        >
          <Pressable
            accessibilityRole="text"
            accessibilityHint="Touch and hold to copy"
            style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              borderBottomRightRadius: 6,
              paddingHorizontal: 15,
              paddingVertical: 10,
              opacity: props.entry.pending ? 0.6 : 1,
            }}
          >
            <Text style={[TOTS_FONT.body, { color: colors.onPrimary }]}>{props.entry.text}</Text>
          </Pressable>
        </Menu>
      ) : null}
      {props.entry.pending ? (
        <TotsText variant="small" tone="muted" style={{ paddingRight: 6 }}>
          {props.pendingLabel}
        </TotsText>
      ) : null}
    </View>
  );
}

function EventPill(props: {
  readonly bot: ChatBot;
  readonly label: string;
  readonly onPress?: () => void;
  readonly expanded?: boolean;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole={props.onPress ? "button" : "text"}
      accessibilityState={props.onPress ? { expanded: Boolean(props.expanded) } : undefined}
      disabled={!props.onPress}
      onPress={props.onPress}
      style={({ pressed }) => ({
        alignSelf: "center",
        maxWidth: "92%",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: colors.sunken,
        paddingVertical: 5,
        paddingLeft: 6,
        paddingRight: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <BotFace bot={props.bot} size={18} />
      <Text numberOfLines={1} style={[TOTS_FONT.small, { color: colors.muted, flexShrink: 1 }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function HandoffEvent(props: {
  readonly group: HandoffGroupItem;
  readonly team: boolean;
  readonly from: ChatBot;
  readonly botFor: (botId: string, name: string) => ChatBot;
}) {
  const colors = useTotsColors();
  const [expanded, setExpanded] = useState(false);
  const label = handoffLabel(props.group, props.team);
  if (props.team) {
    return (
      <View style={{ marginTop: 18, gap: 6 }}>
        <EventPill bot={props.from} label={label} />
        <View style={{ gap: 6, alignItems: "flex-start", marginTop: 4 }}>
          {props.group.entries.map((entry) => (
            <HandoffChip
              key={entry.id}
              entry={entry}
              bot={props.botFor(entry.botId, entry.to ?? "")}
            />
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 18, gap: 8 }}>
      <EventPill
        bot={props.from}
        label={label}
        expanded={expanded}
        onPress={() => setExpanded((open) => !open)}
      />
      {expanded
        ? props.group.entries.map((entry) => (
            <View
              key={entry.id}
              style={{
                borderRadius: 16,
                backgroundColor: colors.sunken,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <BotMarkdown text={entry.text} color={colors.inkSoft} />
            </View>
          ))
        : null}
    </View>
  );
}

function HandoffChip(props: { readonly entry: TeamTimelineEntry; readonly bot: ChatBot }) {
  const colors = useTotsColors();
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Task for ${props.bot.name}`}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((open) => !open)}
      style={({ pressed }) => ({
        maxWidth: "100%",
        gap: 6,
        borderRadius: expanded ? 16 : TOTS_RADIUS.pill,
        backgroundColor: colors.blueSoft,
        paddingVertical: 6,
        paddingLeft: 7,
        paddingRight: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <BotFace bot={props.bot} size={16} />
        <Text
          numberOfLines={1}
          style={[TOTS_FONT.small, { color: colors.blueInk, flexShrink: 1, fontSize: 13.5 }]}
        >
          {`${props.bot.name} · ${taskPreview(props.entry.text)}`}
        </Text>
      </View>
      {expanded ? (
        <View style={{ paddingLeft: 2, paddingBottom: 4 }}>
          <BotMarkdown text={props.entry.text} color={colors.blueInk} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChatSuggestions(props: {
  readonly suggestions: ReadonlyArray<{ readonly label: string; readonly draft: string }>;
  readonly onPick: (draft: string) => void;
}) {
  const colors = useTotsColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
      {props.suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.label}
          accessibilityRole="button"
          onPress={() => props.onPick(suggestion.draft)}
          style={({ pressed }) => ({
            borderRadius: TOTS_RADIUS.pill,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
            paddingHorizontal: 14,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TotsText variant="label">{suggestion.label}</TotsText>
        </Pressable>
      ))}
    </View>
  );
}
