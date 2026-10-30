import {
  useNavigation,
  useRoute,
  type RouteProp,
  type StaticScreenProps,
} from "@react-navigation/native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, type TextInputInstance } from "react-native";

import { EmptyState } from "../../components/ui/EmptyState";
import { Menu } from "../../components/ui/Menu";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { BotFace, BotFaceStack, moodForStatus } from "../tots/BotFace";
import type { BotActivity } from "../tots/bot-activity-model";
import { TOTS_FONT, TOTS_RADIUS, useTotsColors } from "../tots/theme";
import { TotsGlyph, TotsIconButton, TotsText } from "../tots/ui";
import { useBotsActivity } from "../tots/use-bot-activity";
import { useMarkChatRead } from "../tots/chat-read-state";
import { BotChatView, ChatSuggestions, type ChatBot } from "./BotChatView";
import { resolveTeamMessageTarget, type Bot, type BotRegistry } from "./bots-model";
import { useBotRegistry, useTeamTimeline } from "./bots-state";
import { mergePendingMessages } from "./chat-pending";
import { joinNames, layoutTeamTimeline, withMention } from "./team-timeline-layout";
import { ChatAttachMenu } from "./ChatAttachments";
import { useChatAttachments } from "./use-chat-attachments";
import { useChatSend } from "./use-chat-send";

type BotTeamScreenProps = StaticScreenProps<{ readonly teamId: string }>;

type Activity = ReadonlyMap<string, BotActivity>;

function teamRoster(registry: BotRegistry, teamId: string) {
  const team = registry.teams.find((candidate) => candidate.id === teamId) ?? null;
  const lead = registry.bots.find((bot) => bot.id === team?.leadBotId) ?? null;
  const members = (team?.memberBotIds ?? []).flatMap((id) => {
    const bot = registry.bots.find((candidate) => candidate.id === id);
    return bot && bot.id !== lead?.id ? [bot] : [];
  });
  return { team, lead, members, roster: lead ? [lead, ...members] : members };
}

export function BotTeamScreen({ route }: BotTeamScreenProps) {
  const navigation = useNavigation();
  const colors = useTotsColors();
  const { registry, loaded } = useBotRegistry();
  const { team, lead, members, roster } = teamRoster(registry, route.params.teamId);
  const activity = useBotsActivity(roster);
  const timeline = useTeamTimeline(team, registry.bots);
  const [text, setText] = useState("");
  // A team lives in one environment; every bot in it shares the lead's server.
  const attachments = useChatAttachments(lead?.environmentId ?? null);
  const { pending, send } = useChatSend({ text, setText, attachments });
  const inputRef = useRef<TextInputInstance>(null);
  // The team row's unread dot follows the lead's thread.
  useMarkChatRead(lead?.environmentId ?? "", lead?.threadId ?? null);

  if (!team || !lead) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NativeStackScreenOptions options={{ title: "Team" }} />
        <EmptyState
          variant="plain"
          title={loaded ? "Team not found" : "Loading team"}
          detail={loaded ? "This team was removed, or its lead bot was removed." : ""}
        />
      </View>
    );
  }

  const items = layoutTeamTimeline(mergePendingMessages(timeline, pending));
  const target = resolveTeamMessageTarget({ text, lead, members });

  const openBot = (bot: Pick<Bot, "id">, threadId?: string) =>
    navigation.navigate("BotChat", threadId ? { botId: bot.id, threadId } : { botId: bot.id });

  const mention = (bot: Bot) => {
    setText(
      withMention(
        text,
        bot.name,
        roster.map((member) => member.name),
      ),
    );
    inputRef.current?.focus();
  };

  const fill = (draft: string) => {
    setText(draft);
    inputRef.current?.focus();
  };

  const botFor = (botId: string, name: string): ChatBot =>
    roster.find((bot) => bot.id === botId) ??
    registry.bots.find((bot) => bot.name === name) ?? { id: botId || name, name };

  return (
    <>
      <NativeStackScreenOptions options={{ title: team.name, headerTitle: teamHeaderTitle }} />
      <BotChatView
        items={items}
        botFor={botFor}
        showBotNames
        directToLabel={(entry) => (entry.to !== null && entry.to !== lead.name ? entry.to : null)}
        onOpenBot={(botId) => openBot({ id: botId })}
        savedBots={registry.bots}
        onOpenSender={(botId, threadId) => openBot({ id: botId }, threadId ?? undefined)}
        environmentId={lead.environmentId}
        header={
          <MemberStrip
            roster={roster}
            leadId={lead.id}
            activity={activity}
            onOpen={openBot}
            onMention={mention}
          />
        }
        empty={
          <TeamEmptyState
            roster={roster}
            leadName={lead.name}
            memberNames={members.map((bot) => bot.name)}
            onSuggest={fill}
          />
        }
        aboveComposer={
          <>
            <ActivityBar roster={roster} activity={activity} onOpen={openBot} />
            <RecipientChip bot={target.bot} isLead={target.bot.id === lead.id} />
          </>
        }
        composer={{
          ref: inputRef,
          value: text,
          onChangeText: setText,
          placeholder: "Message the team",
          accessibilityLabel: `Message ${team.name}`,
          onSend: () => send(target.bot, target.text),
          attachments: attachments.attachments,
          onRemoveAttachment: attachments.remove,
          picking: attachments.picking,
          leading: (
            <>
              <ChatAttachMenu
                onPhoto={() => void attachments.pickPhotos()}
                onFile={() => void attachments.pickFiles()}
              />
              <Menu
                accessibilityLabel="Mention a teammate"
                actions={roster.map((bot) => ({
                  id: bot.id,
                  title: bot.name,
                  subtitle: bot.id === lead.id ? "Lead" : undefined,
                }))}
                onPressAction={({ nativeEvent }) => {
                  const bot = roster.find((candidate) => candidate.id === nativeEvent.event);
                  if (bot) mention(bot);
                }}
              >
                <TotsIconButton
                  accessibilityLabel="Mention a teammate"
                  size={38}
                  onPress={() => undefined}
                >
                  <TotsGlyph size={17} tone="muted">
                    @
                  </TotsGlyph>
                </TotsIconButton>
              </Menu>
            </>
          ),
        }}
      />
    </>
  );
}

/** A header option; renders a component so its hooks stay its own. */
function teamHeaderTitle() {
  return <TeamHeaderTitle />;
}

function TeamHeaderTitle() {
  const route = useRoute<RouteProp<{ BotTeam: { readonly teamId: string } }, "BotTeam">>();
  const { registry } = useBotRegistry();
  const { team, lead, roster } = teamRoster(registry, route.params.teamId);
  const activity = useBotsActivity(roster);
  if (!team || !lead) return null;
  const working = roster.filter((bot) => activity.get(bot.id)?.status.kind === "working").length;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <BotFaceStack bots={roster} size={26} max={3} />
      <View style={{ flexShrink: 1 }}>
        <TotsText variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
          {team.name}
        </TotsText>
        <TotsText variant="small" tone="muted" numberOfLines={1}>
          {working > 0 ? `${lead.name} leads · ${working} working` : `${lead.name} leads`}
        </TotsText>
      </View>
    </View>
  );
}

function MemberStrip(props: {
  readonly roster: ReadonlyArray<Bot>;
  readonly leadId: string;
  readonly activity: Activity;
  readonly onOpen: (bot: Bot) => void;
  readonly onMention: (bot: Bot) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -18, marginBottom: 4 }}
      contentContainerStyle={{ gap: 14, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 }}
    >
      {props.roster.map((bot) => (
        <MemberChip
          key={bot.id}
          bot={bot}
          isLead={bot.id === props.leadId}
          activity={props.activity.get(bot.id)}
          onOpen={() => props.onOpen(bot)}
          onMention={() => props.onMention(bot)}
        />
      ))}
    </ScrollView>
  );
}

function MemberChip(props: {
  readonly bot: Bot;
  readonly isLead: boolean;
  readonly activity: BotActivity | undefined;
  readonly onOpen: () => void;
  readonly onMention: () => void;
}) {
  const status = props.activity?.status;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.bot.name}${props.isLead ? ", lead" : ""}${status ? `, ${status.label}` : ""}`}
      accessibilityHint="Opens the chat. Long press to mention."
      onPress={props.onOpen}
      onLongPress={props.onMention}
      style={({ pressed }) => ({
        width: 56,
        alignItems: "center",
        gap: 3,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <BotFace bot={props.bot} size={40} mood={moodForStatus(status?.kind)} />
      <TotsText variant="small" numberOfLines={1}>
        {props.bot.name}
      </TotsText>
      {props.isLead ? (
        <TotsText variant="small" tone="muted" style={{ fontSize: 11 }}>
          Lead
        </TotsText>
      ) : null}
    </Pressable>
  );
}

function TeamEmptyState(props: {
  readonly roster: ReadonlyArray<Bot>;
  readonly leadName: string;
  readonly memberNames: ReadonlyArray<string>;
  readonly onSuggest: (draft: string) => void;
}) {
  const suggestions = [
    { label: "Plan this week's work", draft: "Plan this week's work" },
    { label: "Review the latest changes", draft: "Review the latest changes" },
    { label: "Research and summarize…", draft: "Research and summarize: " },
  ];
  const split =
    props.memberNames.length > 0
      ? ` They split the work across ${joinNames(props.memberNames)}.`
      : "";
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingVertical: 32,
      }}
    >
      <BotFaceStack bots={props.roster} size={48} max={5} />
      <View style={{ alignItems: "center", gap: 6, paddingHorizontal: 12 }}>
        <TotsText variant="heading">Start the conversation</TotsText>
        <TotsText variant="small" tone="muted" style={{ textAlign: "center", lineHeight: 18 }}>
          {`Your message goes to ${props.leadName}.${split} Start with @Name to message one teammate directly.`}
        </TotsText>
      </View>
      <ChatSuggestions suggestions={suggestions} onPick={props.onSuggest} />
    </View>
  );
}

function ActivityBar(props: {
  readonly roster: ReadonlyArray<Bot>;
  readonly activity: Activity;
  readonly onOpen: (bot: Bot, threadId?: string) => void;
}) {
  const colors = useTotsColors();
  const kindOf = (bot: Bot) => props.activity.get(bot.id)?.status.kind;
  const waiting = props.roster.find((bot) => kindOf(bot) === "needs_you");
  const working = props.roster.filter((bot) => kindOf(bot) === "working");
  const focus = waiting ?? working[0];
  if (!focus) return null;
  const label = waiting
    ? `${waiting.name} is waiting for you · Open`
    : `${joinNames(working.map((bot) => bot.name))} ${working.length === 1 ? "is" : "are"} working`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={`Opens the chat with ${focus.name}`}
      onPress={() => props.onOpen(focus, props.activity.get(focus.id)?.threadId)}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: TOTS_RADIUS.pill,
        borderWidth: waiting ? 1 : 0,
        borderColor: colors.amberLine,
        backgroundColor: waiting ? colors.amberSoft : colors.sunken,
        paddingVertical: 4,
        paddingLeft: 5,
        paddingRight: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {waiting ? (
        <BotFace bot={waiting} size={20} mood="waiting" />
      ) : (
        <BotFaceStack bots={working} size={20} />
      )}
      <Text
        numberOfLines={1}
        style={[
          TOTS_FONT.small,
          { color: waiting ? colors.amberInk : colors.muted, flexShrink: 1 },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RecipientChip(props: { readonly bot: Bot; readonly isLead: boolean }) {
  const colors = useTotsColors();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: colors.sunken,
        paddingVertical: 4,
        paddingLeft: 5,
        paddingRight: 12,
      }}
    >
      <BotFace bot={props.bot} size={18} />
      <Text style={[TOTS_FONT.small, { color: colors.muted }]}>
        {"To "}
        <Text style={{ color: colors.ink, fontWeight: "600" }}>{props.bot.name}</Text>
        {props.isLead ? " · splits the work" : ""}
      </Text>
    </View>
  );
}
