import { useNavigation } from "@react-navigation/native";
import { useSetTotsClassic } from "../tots/use-tots-classic";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Dialog from "../../components/ui/Dialog";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Menu } from "../../components/ui/Menu";
import {
  ScreenScrollView as ScrollView,
  ScreenScrollViewBottomInset,
  ScreenScrollViewSurface,
} from "../../components/ui/ScreenScrollView";
import { useDeviceType } from "../../native/native-layout-metrics";
import { useThreadShells } from "../../state/entities";
import { useCompactWorkspaceTabs } from "../workspace/useSystemWorkspaceTabBar";
import { BotAvatar, BotAvatarStack } from "./BotAvatar";
import { BOT_TEMPLATES, botIdentity, tint } from "./bot-identity";
import {
  BOT_STATUS_COLORS,
  deriveBotStatus,
  formatBotTime,
  useBotStatus,
  type BotStatus,
} from "./bot-status";
import { removeBot, removeTeam, type Bot, type BotTeam } from "./bots-model";
import { useBotRegistry, useUpdateBotRegistry } from "./bots-state";

type BotTemplate = (typeof BOT_TEMPLATES)[number];

const NEEDS_YOU_COLOR = BOT_STATUS_COLORS.needs_you;

export function BotsScreen(props: { readonly workspace?: boolean }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const deviceType = useDeviceType();
  const compactTabs = useCompactWorkspaceTabs();
  const { registry } = useBotRegistry();
  const setClassic = useSetTotsClassic();
  const updateRegistry = useUpdateBotRegistry();
  const { bots, teams } = registry;
  const findBot = (id: string) => bots.find((bot) => bot.id === id) ?? null;

  const openBot = (bot: Bot) => navigation.navigate("BotChat", { botId: bot.id });
  const hireBot = (template?: BotTemplate) =>
    template
      ? navigation.navigate("BotNew", { template: template.id })
      : navigation.navigate("BotNew");

  const confirmRemoveBot = (bot: Bot) => {
    const ledTeams = teams.filter((team) => team.leadBotId === bot.id);
    Dialog.alert(
      `Remove ${bot.name}?`,
      ledTeams.length > 0
        ? `Its chat stays in Chats. The teams it leads (${ledTeams.map((team) => team.name).join(", ")}) are removed too.`
        : "Its chat stays in Chats.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => updateRegistry((current) => removeBot(current, bot.id)),
        },
      ],
    );
  };

  const confirmRemoveTeam = (team: BotTeam) =>
    Dialog.alert(`Remove ${team.name}?`, "Its bots and their chats stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => updateRegistry((current) => removeTeam(current, team.id)),
      },
    ]);

  const botRows: Bot[][] = [];
  for (let index = 0; index < bots.length; index += 2) {
    botRows.push(bots.slice(index, index + 2));
  }

  return (
    <View collapsable={false} className="flex-1 bg-screen">
      <ScreenScrollViewBottomInset value={deviceType === "pad" || compactTabs ? 80 : 0}>
        <ScreenScrollViewSurface value="bg-screen">
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerClassName="gap-6 px-5"
            contentContainerStyle={{
              paddingTop: (props.workspace && Platform.OS === "android" ? insets.top : 0) + 12,
              paddingBottom: Math.max(insets.bottom, 18) + 24,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Leaves classic T3 Code and opens the Tots home"
              onPress={() => setClassic(false)}
              className="flex-row items-center justify-between rounded-2xl bg-primary px-4 py-3 active:opacity-80"
            >
              <Text className="font-t3-bold text-base text-primary-foreground">Back to Tots</Text>
              <Text className="text-sm text-primary-foreground">Your bots home ›</Text>
            </Pressable>
            <View className="flex-row items-start gap-4">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-t3-bold text-3xl">Your team</Text>
                {bots.length > 0 ? (
                  <TeamSummary bots={bots} />
                ) : (
                  <Text className="text-base text-foreground-muted">
                    AI teammates that remember your work
                  </Text>
                )}
              </View>
              <Menu
                accessible
                accessibilityRole="button"
                accessibilityLabel="Add"
                actions={[
                  { id: "bot", title: "Hire a bot", image: "person.badge.plus" },
                  {
                    id: "team",
                    title: "New team",
                    image: "person.2",
                    attributes: { disabled: bots.length < 2 },
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === "bot") hireBot();
                  if (nativeEvent.event === "team" && bots.length >= 2) {
                    navigation.navigate("BotTeamNew");
                  }
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a bot or team"
                  className="mt-1 items-center justify-center rounded-full bg-primary active:opacity-70"
                  style={{ width: 44, height: 44 }}
                >
                  <SymbolView
                    name="plus"
                    size={22}
                    tintColorClassName="accent-primary-foreground"
                  />
                </Pressable>
              </Menu>
            </View>

            {bots.length === 0 ? (
              <EmptyHero onHire={hireBot} />
            ) : (
              <>
                <NeedsYouBanner bots={bots} onOpen={openBot} />

                {teams.length > 0 ? (
                  <View className="gap-3">
                    <SectionHeader title="Teams" count={teams.length} />
                    {teams.map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        lead={findBot(team.leadBotId)}
                        members={team.memberBotIds.flatMap((id) => {
                          const bot = findBot(id);
                          return bot ? [bot] : [];
                        })}
                        onOpen={() => navigation.navigate("BotTeam", { teamId: team.id })}
                        onRemove={() => confirmRemoveTeam(team)}
                      />
                    ))}
                  </View>
                ) : bots.length >= 2 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate("BotTeamNew")}
                    className="flex-row items-center gap-4 rounded-3xl border border-border-subtle p-4 active:opacity-70"
                    style={{ borderStyle: "dashed", borderWidth: 1.5 }}
                  >
                    <BotAvatarStack bots={bots} size={34} max={3} />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="font-t3-bold text-base">Make a team</Text>
                      <Text className="text-sm text-foreground-muted" numberOfLines={2}>
                        A lead bot splits the work and hands tasks to teammates.
                      </Text>
                    </View>
                    <SymbolView
                      name="chevron.right"
                      size={16}
                      tintColorClassName="accent-chevron"
                    />
                  </Pressable>
                ) : null}

                <View className="gap-3">
                  <SectionHeader
                    title="Bots"
                    count={bots.length}
                    action={{ label: "Hire", onPress: () => hireBot() }}
                  />
                  {botRows.map((row) => (
                    <View key={row.map((bot) => bot.id).join(":")} className="flex-row gap-3">
                      {row.map((bot) => (
                        <BotCard
                          key={bot.id}
                          bot={bot}
                          onOpen={() => openBot(bot)}
                          onRemove={() => confirmRemoveBot(bot)}
                        />
                      ))}
                      {row.length === 1 ? <View className="flex-1" /> : null}
                    </View>
                  ))}
                  <Text className="px-1 text-xs text-foreground-muted">
                    Tap a bot to chat. Touch and hold to remove it.
                  </Text>
                </View>
              </>
            )}

            <Text className="px-1 text-center text-xs text-foreground-muted">
              Bots live on your T3 server. This list is saved on this device.
            </Text>
          </ScrollView>
        </ScreenScrollViewSurface>
      </ScreenScrollViewBottomInset>
    </View>
  );
}

function useBotStatuses(bots: ReadonlyArray<Bot>) {
  const shells = useThreadShells();
  return bots.map((bot) => {
    const shell =
      shells.find(
        (candidate) =>
          candidate.environmentId === bot.environmentId && candidate.id === bot.threadId,
      ) ?? null;
    const latest = shell?.source.latestVisibleMessage ?? null;
    const status = deriveBotStatus(
      shell === null
        ? null
        : {
            ...shell,
            source: {
              latestVisibleMessage: latest ? { role: latest.role, text: latest.text } : null,
            },
          },
    );
    return { bot, status };
  });
}

function TeamSummary(props: { readonly bots: ReadonlyArray<Bot> }) {
  const statuses = useBotStatuses(props.bots);
  const working = statuses.filter(({ status }) => status.kind === "working").length;
  const needsYou = statuses.filter(({ status }) => status.kind === "needs_you").length;
  const parts = [
    `${props.bots.length} ${props.bots.length === 1 ? "bot" : "bots"}`,
    working > 0 ? `${working} working` : null,
    needsYou > 0 ? `${needsYou} needs you` : null,
  ].filter((part) => part !== null);
  return <Text className="text-base text-foreground-muted">{parts.join(" · ")}</Text>;
}

function NeedsYouBanner(props: {
  readonly bots: ReadonlyArray<Bot>;
  readonly onOpen: (bot: Bot) => void;
}) {
  const waiting = useBotStatuses(props.bots).filter(({ status }) => status.kind === "needs_you");
  if (waiting.length === 0) return null;
  return (
    <View
      className="gap-3 rounded-3xl p-4"
      style={{
        backgroundColor: tint(NEEDS_YOU_COLOR, 0.12),
        borderWidth: 1,
        borderColor: tint(NEEDS_YOU_COLOR, 0.35),
      }}
    >
      <View className="flex-row items-center gap-2">
        <SymbolView name="exclamationmark.circle" size={18} tintColor={NEEDS_YOU_COLOR} />
        <Text className="font-t3-bold text-base" style={{ color: NEEDS_YOU_COLOR }}>
          {waiting.length === 1 ? "1 bot needs you" : `${waiting.length} bots need you`}
        </Text>
      </View>
      {waiting.map(({ bot, status }) => (
        <Pressable
          key={bot.id}
          accessibilityRole="button"
          accessibilityLabel={`${bot.name}: ${status.label}`}
          onPress={() => props.onOpen(bot)}
          className="flex-row items-center gap-3 rounded-2xl bg-card px-3 py-2.5 active:opacity-70"
        >
          <BotAvatar bot={bot} size={36} status={status.kind} />
          <View className="min-w-0 flex-1">
            <Text className="font-t3-medium text-base" numberOfLines={1}>
              {bot.name}
            </Text>
            <Text className="text-xs text-foreground-muted" numberOfLines={1}>
              {status.preview ? `${status.label} · ${status.preview}` : status.label}
            </Text>
          </View>
          <SymbolView name="chevron.right" size={14} tintColorClassName="accent-chevron" />
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader(props: {
  readonly title: string;
  readonly count: number;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}) {
  return (
    <View className="flex-row items-center gap-2 px-1">
      <Text className="font-t3-bold text-xl">{props.title}</Text>
      <View className="rounded-full bg-subtle px-2 py-0.5">
        <Text className="font-t3-medium text-xs text-foreground-muted">{props.count}</Text>
      </View>
      <View className="flex-1" />
      {props.action ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.action.onPress}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Text className="font-t3-medium text-base text-primary-text">{props.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusPill(props: { readonly status: BotStatus }) {
  const color = BOT_STATUS_COLORS[props.status.kind];
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: tint(color, 0.15) }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text className="font-t3-medium text-xs" style={{ color }} numberOfLines={1}>
        {props.status.label}
      </Text>
    </View>
  );
}

function TeamCard(props: {
  readonly team: BotTeam;
  readonly lead: Bot | null;
  readonly members: ReadonlyArray<Bot>;
  readonly onOpen: () => void;
  readonly onRemove: () => void;
}) {
  const roster = props.lead ? [props.lead, ...props.members] : props.members;
  return (
    <Menu
      shouldOpenOnLongPress
      actions={[
        { id: "remove", title: "Remove team", image: "trash", attributes: { destructive: true } },
      ]}
      onPressAction={props.onRemove}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.team.name} team`}
        onPress={props.onOpen}
        className="gap-3 rounded-3xl bg-card p-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          <BotAvatarStack bots={roster} size={38} max={5} />
          <View className="flex-1" />
          <Text className="text-xs text-foreground-muted">
            {roster.length} {roster.length === 1 ? "bot" : "bots"}
          </Text>
          <SymbolView name="chevron.right" size={14} tintColorClassName="accent-chevron" />
        </View>
        <View className="gap-0.5">
          <Text className="font-t3-bold text-lg" numberOfLines={1}>
            {props.team.name}
          </Text>
          <Text className="text-sm text-foreground-muted" numberOfLines={1}>
            👑 Lead: {props.lead?.name ?? "Removed bot"}
          </Text>
        </View>
        {props.lead ? <LeadPreview lead={props.lead} /> : null}
      </Pressable>
    </Menu>
  );
}

function LeadPreview(props: { readonly lead: Bot }) {
  const status = useBotStatus(props.lead);
  const time = formatBotTime(status.updatedAt);
  return (
    <View className="gap-2 rounded-2xl bg-subtle px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <StatusPill status={status} />
        <View className="flex-1" />
        {time ? <Text className="text-xs text-foreground-muted">{time}</Text> : null}
      </View>
      <Text className="text-sm" numberOfLines={2}>
        {status.preview ? (
          <>
            <Text className="font-t3-medium text-sm">
              {status.previewFromBot ? props.lead.name : "You"}:{" "}
            </Text>
            <Text className="text-sm text-foreground-muted">{status.preview}</Text>
          </>
        ) : (
          <Text className="text-sm text-foreground-muted">
            No messages yet. Say hi to the team.
          </Text>
        )}
      </Text>
    </View>
  );
}

function BotCard(props: {
  readonly bot: Bot;
  readonly onOpen: () => void;
  readonly onRemove: () => void;
}) {
  const status = useBotStatus(props.bot);
  const { color } = botIdentity(props.bot);
  const time = formatBotTime(status.updatedAt);
  return (
    <Menu
      shouldOpenOnLongPress
      style={{ flex: 1 }}
      actions={[
        { id: "remove", title: "Remove bot", image: "trash", attributes: { destructive: true } },
      ]}
      onPressAction={props.onRemove}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${props.bot.name}. ${status.label}`}
        onPress={props.onOpen}
        className="flex-1 gap-3 rounded-3xl bg-card p-4 active:opacity-80"
        style={{ borderWidth: 1, borderColor: tint(color, 0.25) }}
      >
        <View className="flex-row items-start justify-between">
          <BotAvatar bot={props.bot} size={52} status={status.kind} />
          {time ? <Text className="text-xs text-foreground-muted">{time}</Text> : null}
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-t3-bold text-base" numberOfLines={1}>
            {props.bot.name}
          </Text>
          <Text className="text-sm text-foreground-muted" numberOfLines={2}>
            {props.bot.role}
          </Text>
        </View>
        <StatusPill status={status} />
      </Pressable>
    </Menu>
  );
}

function EmptyHero(props: { readonly onHire: (template?: BotTemplate) => void }) {
  const [left, center, right] = [BOT_TEMPLATES[1], BOT_TEMPLATES[0], BOT_TEMPLATES[4]];
  const templateRows: BotTemplate[][] = [];
  for (let index = 0; index < BOT_TEMPLATES.length; index += 2) {
    templateRows.push(BOT_TEMPLATES.slice(index, index + 2));
  }
  return (
    <View className="gap-6">
      <View className="items-center gap-4 rounded-3xl bg-card px-6 py-8">
        <View className="flex-row items-end">
          <View style={{ marginRight: -14, transform: [{ rotate: "-8deg" }] }}>
            <BotAvatar bot={left} size={60} />
          </View>
          <View style={{ zIndex: 1, marginBottom: 10 }}>
            <BotAvatar bot={center} size={80} />
          </View>
          <View style={{ marginLeft: -14, transform: [{ rotate: "8deg" }] }}>
            <BotAvatar bot={right} size={60} />
          </View>
        </View>
        <View className="items-center gap-2">
          <Text className="text-center font-t3-bold text-2xl">Hire your first AI teammate</Text>
          <Text className="text-center text-base text-foreground-muted">
            A bot has a name, one job, and a long memory. Chat with it alone, or group bots into a
            team with a lead who hands out the work.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <Text className="px-1 font-t3-bold text-xl">Start from a template</Text>
        {templateRows.map((row) => (
          <View key={row.map((template) => template.id).join(":")} className="flex-row gap-3">
            {row.map((template) => (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                accessibilityLabel={`Hire a ${template.name}`}
                onPress={() => props.onHire(template)}
                className="flex-1 gap-3 rounded-3xl bg-card p-4 active:opacity-80"
                style={{ borderWidth: 1, borderColor: tint(template.color, 0.25) }}
              >
                <BotAvatar bot={template} size={44} />
                <View className="gap-0.5">
                  <Text className="font-t3-bold text-base">{template.name}</Text>
                  <Text className="text-sm text-foreground-muted" numberOfLines={2}>
                    {template.tagline}
                  </Text>
                </View>
              </Pressable>
            ))}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        ))}
      </View>

      <Button
        label="Hire a custom bot"
        icon="plus"
        tone="primary"
        fullWidth
        onPress={() => props.onHire()}
      />
    </View>
  );
}
