import { useNavigation } from "@react-navigation/native";
import { scopeThreadShell, type EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId } from "@t3tools/contracts";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "../../components/ui/AppSymbol";
import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import { useThreadShells } from "../../state/entities";
import { useArchivedThreadSnapshots } from "../archive/useArchivedThreadSnapshots";
import { removeBotThread, type Bot } from "../bots/bots-model";
import { useBotRegistry, useUpdateBotRegistry } from "../bots/bots-state";
import { useServerBots } from "../bots/server-bots";
import { useChatRowActions } from "./chat-actions";
import { chatThreadKey } from "./chat-read-model";
import { markChatRead, useChatReadState } from "./chat-read-state";
import { ChatRowView } from "./chat-row";
import { ChatSwipeRow } from "./chat-swipe-row";
import { arrangeChatRows, buildChatRows, type ChatRow } from "./chats-model";
import { HireFirstBot } from "./home-empty";
import { TabHeader } from "./home-rows";
import { useSaveServerBot } from "./server-bot-save";
import { TOTS_TAB_BAR_HEIGHT } from "./tab-bar";
import { TOTS_RADIUS, useTotsColors } from "./theme";
import { TotsGlyph, TotsIconButton, TotsSectionLabel, TotsText } from "./ui";

/** Every conversation with a bot or a team: pinned first, then newest. */
export function TotsChatsTab() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useTotsColors();
  const { registry } = useBotRegistry();
  const shells = useThreadShells();
  const serverBots = useServerBots();
  const { reads, muted } = useChatReadState();
  const [query, setQuery] = useState("");
  const [showSettled, setShowSettled] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const openRow = useRef<SwipeableMethods | null>(null);

  const environmentIds = [...new Set(registry.bots.map((bot) => bot.environmentId))].map((id) =>
    EnvironmentId.make(id),
  );
  const { snapshots } = useArchivedThreadSnapshots(environmentIds);
  const archived = new Map<string, EnvironmentThreadShell>();
  for (const entry of snapshots) {
    for (const thread of entry.snapshot.threads) {
      if (thread.archivedAt === null) continue;
      archived.set(
        chatThreadKey(entry.environmentId, thread.id),
        scopeThreadShell(entry.environmentId, thread),
      );
    }
  }
  const live = new Map(
    shells.map((shell) => [chatThreadKey(shell.environmentId, shell.id), shell]),
  );
  const actionsFor = useChatRowActions({ shells: live, archived });

  const rows = buildChatRows({
    bots: registry.bots,
    teams: registry.teams,
    // Hidden chats keep their last message from the archive.
    shells: [...archived.values(), ...shells],
    serverBots,
    archivedKeys: new Set(archived.keys()),
    reads,
    muted,
  });
  const searching = query.trim().length > 0;
  const arranged = arrangeChatRows(rows, query);
  const empty = registry.bots.length === 0 && serverBots.length === 0;

  const renderRow = (row: ChatRow) => {
    const actions = actionsFor(row);
    return (
      <ChatSwipeRow
        key={row.key}
        left={actions.left}
        right={actions.right}
        onOpen={(methods) => {
          if (openRow.current !== methods) openRow.current?.close();
          openRow.current = methods;
        }}
      >
        <ChatRowItem row={row} />
      </ChatSwipeRow>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 16,
          paddingBottom: TOTS_TAB_BAR_HEIGHT + insets.bottom + 16,
          gap: 2,
        }}
      >
        <TabHeader
          title="Tots"
          byline="by t3code"
          trailing={
            <>
              <ComposeMenu bots={registry.bots} />
              <TotsIconButton
                accessibilityLabel="Settings"
                onPress={() => navigation.navigate("TotsSettings")}
              >
                <TotsGlyph size={16}>···</TotsGlyph>
              </TotsIconButton>
            </>
          }
        />
        {empty ? (
          <HireFirstBot />
        ) : (
          <>
            <ChatSearchField value={query} onChange={setQuery} />
            {arranged.main.map(renderRow)}
            {searching &&
            arranged.main.length + arranged.settled.length + arranged.hidden.length === 0 ? (
              <TotsText tone="muted" style={{ textAlign: "center", paddingVertical: 24 }}>
                No chats match.
              </TotsText>
            ) : null}
            {arranged.settled.length > 0 ? (
              <>
                <SectionToggle
                  label={`Settled · ${arranged.settled.length}`}
                  open={showSettled || searching}
                  onPress={() => setShowSettled((value) => !value)}
                />
                {showSettled || searching ? arranged.settled.map(renderRow) : null}
              </>
            ) : null}
            {arranged.hidden.length > 0 ? (
              <>
                <SectionToggle
                  label={`Hidden · ${arranged.hidden.length}`}
                  open={showHidden}
                  onPress={() => setShowHidden((value) => !value)}
                />
                {showHidden ? arranged.hidden.map(renderRow) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ChatSearchField(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const colors = useTotsColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: 2,
        marginBottom: 6,
        paddingHorizontal: 12,
        height: 40,
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: colors.sunken,
      }}
    >
      <SymbolView name="magnifyingglass" size={15} tintColor={colors.muted} />
      <TextInput
        accessibilityLabel="Search chats"
        value={props.value}
        onChangeText={props.onChange}
        placeholder="Search chats"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={{ flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 0 }}
      />
      {props.value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => props.onChange("")}
        >
          <SymbolView name="xmark.circle.fill" size={16} tintColor={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SectionToggle(props: {
  readonly label: string;
  readonly open: boolean;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ expanded: props.open }}
      onPress={props.onPress}
    >
      <TotsSectionLabel
        trailing={
          <SymbolView
            name={props.open ? "chevron.up" : "chevron.down"}
            size={12}
            tintColor={colors.muted}
          />
        }
      >
        {props.label}
      </TotsSectionLabel>
    </Pressable>
  );
}

function ComposeMenu(props: { readonly bots: ReadonlyArray<Bot> }) {
  const navigation = useNavigation();
  const colors = useTotsColors();
  return (
    <Menu
      accessibilityLabel="New chat"
      actions={[
        ...props.bots.map((bot) => ({ id: `bot:${bot.id}`, title: `New chat with ${bot.name}` })),
        { id: "hire", title: "Hire a bot" },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "hire") {
          navigation.navigate("BotNew");
          return;
        }
        const bot = props.bots.find((candidate) => `bot:${candidate.id}` === nativeEvent.event);
        if (bot) navigation.navigate("BotChat", { botId: bot.id, newThread: true });
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New chat"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <TotsGlyph tone="onPrimary">+</TotsGlyph>
      </Pressable>
    </Menu>
  );
}

function ChatRowItem(props: { readonly row: ChatRow }) {
  const navigation = useNavigation();
  const updateRegistry = useUpdateBotRegistry();
  const saveServerBot = useSaveServerBot();
  const { row } = props;

  const open = () => {
    if (row.readKey !== null) markChatRead(row.readKey, row.latest?.time ?? null);
    if (row.kind === "team") navigation.navigate("BotTeam", { teamId: row.team.id });
    else if (row.kind === "thread") {
      navigation.navigate("BotChat", { botId: row.bot.id, threadId: row.threadId });
    } else if (row.kind === "server") {
      // Chats open saved bots, so a server bot is saved on the way in.
      navigation.navigate("BotChat", { botId: saveServerBot(row.serverBot).id });
    } else navigation.navigate("BotChat", { botId: row.bot.id });
  };

  const confirmRemove =
    row.kind === "thread"
      ? () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Dialog.alert(`Remove ${row.title}?`, "The chat stays on your T3 server.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () =>
                updateRegistry((current) => removeBotThread(current, row.bot.id, row.threadId)),
            },
          ]);
        }
      : undefined;

  return (
    <ChatRowView
      row={row}
      onPress={open}
      onLongPress={confirmRemove}
      onSave={row.kind === "server" ? () => void saveServerBot(row.serverBot) : undefined}
    />
  );
}
