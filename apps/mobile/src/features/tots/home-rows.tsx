import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import { useBotStatus } from "../bots/bot-status";
import type { BotStatus } from "../bots/bot-status-model";
import { removeBot, removeTeam, type Bot, type BotTeam } from "../bots/bots-model";
import { useUpdateBotRegistry } from "../bots/bots-state";
import { useBotRequests } from "../bots/use-bot-requests";
import type { BotActivity } from "./bot-activity-model";
import { BotFace, BotFaceStack, moodForStatus } from "./BotFace";
import { approvalAction, botLiveLine, chatTarget, firstLine, rowTime } from "./home-model";
import { TOTS_RADIUS, useTotsColors } from "./theme";
import { TotsButton, TotsCard, TotsText } from "./ui";

const SETTING_UP: BotStatus = {
  kind: "setting_up",
  label: "Setting up",
  preview: null,
  previewFromBot: false,
  updatedAt: null,
};

export function NeedsYouCard(props: { readonly bot: Bot; readonly threadId: string }) {
  const navigation = useNavigation();
  const requests = useBotRequests({ ...props.bot, threadId: props.threadId });
  const approval = requests.approvals[0];
  const question = requests.userInputs[0];
  const openChat = () =>
    navigation.navigate("BotChat", { botId: props.bot.id, threadId: props.threadId });
  const canAllow =
    approval !== undefined && requests.canOperate && approval.responseCapability === "live";

  const title = approval
    ? `${props.bot.name} ${approvalAction(approval)}`
    : question
      ? `${props.bot.name} has a question`
      : `${props.bot.name} needs you`;
  const detail = approval
    ? (firstLine(approval.detail) ?? firstLine(approval.reason))
    : question
      ? (firstLine(question.questions[0]?.question) ?? null)
      : null;

  const allow = async () => {
    if (!approval) return;
    const ok = await requests.respondToApproval(approval.requestId, "accept");
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    Dialog.alert("Could not allow", "Open the chat to try again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Open chat", onPress: openChat },
    ]);
  };

  return (
    <TotsCard tone="amber" onPress={openChat} accessibilityLabel={title}>
      <View className="flex-row items-center gap-3">
        <BotFace bot={props.bot} size={44} mood="waiting" />
        <View className="min-w-0 flex-1 gap-0.5">
          <TotsText variant="label" numberOfLines={2} style={{ fontSize: 15 }}>
            {title}
          </TotsText>
          {detail ? <AmberDetail>{detail}</AmberDetail> : null}
        </View>
        {canAllow ? (
          <TotsButton
            label="Allow"
            size="small"
            loading={requests.respondingRequestId === approval.requestId}
            onPress={() => void allow()}
            accessibilityLabel={`Allow: ${title}`}
          />
        ) : (
          <TotsButton label={question ? "Answer" : "Open"} size="small" onPress={openChat} />
        )}
      </View>
    </TotsCard>
  );
}

function AmberDetail(props: { readonly children: string }) {
  const colors = useTotsColors();
  return (
    <TotsText variant="small" numberOfLines={1} style={{ color: colors.amberInk }}>
      {props.children}
    </TotsText>
  );
}

export function TeamRow(props: { readonly team: BotTeam; readonly bots: ReadonlyArray<Bot> }) {
  const navigation = useNavigation();
  const updateRegistry = useUpdateBotRegistry();
  const lead = props.bots.find((bot) => bot.id === props.team.leadBotId) ?? null;
  const roster = [props.team.leadBotId, ...props.team.memberBotIds]
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .flatMap((id) => props.bots.filter((bot) => bot.id === id));

  const confirmRemove = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Dialog.alert(`Remove ${props.team.name}?`, "Its bots and their chats stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => updateRegistry((current) => removeTeam(current, props.team.id)),
      },
    ]);
  };

  return (
    <RowShell
      accessibilityLabel={`${props.team.name} team`}
      onPress={() => navigation.navigate("BotTeam", { teamId: props.team.id })}
      onLongPress={confirmRemove}
      leading={<BotFaceStack bots={roster} size={30} max={3} />}
    >
      {lead ? (
        <LeadLine team={props.team} lead={lead} />
      ) : (
        <RowText title={props.team.name} line="Lead was removed" tone="muted" time="" />
      )}
    </RowShell>
  );
}

function LeadLine(props: { readonly team: BotTeam; readonly lead: Bot }) {
  const status = useBotStatus(props.lead);
  const line = status.preview
    ? `${status.previewFromBot ? props.lead.name : "You"}: ${status.preview}`
    : "No messages yet";
  return (
    <RowText
      title={props.team.name}
      line={line}
      tone={status.kind === "working" ? "blue" : "muted"}
      time={rowTime(status)}
    />
  );
}

export function BotRow(props: {
  readonly bot: Bot;
  readonly activity: BotActivity | undefined;
  readonly ledTeams: ReadonlyArray<BotTeam>;
}) {
  const navigation = useNavigation();
  const updateRegistry = useUpdateBotRegistry();
  const status = props.activity?.status ?? SETTING_UP;
  const live = botLiveLine(
    status,
    props.activity?.busyThreads ?? 0,
    firstLine(props.bot.role) ?? "",
  );

  const confirmRemove = () =>
    Dialog.alert(
      `Remove ${props.bot.name}?`,
      props.ledTeams.length > 0
        ? `Its chats stay on your T3 server. The teams it leads (${props.ledTeams.map((team) => team.name).join(", ")}) go too.`
        : "Its chats stay on your T3 server.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => updateRegistry((current) => removeBot(current, props.bot.id)),
        },
      ],
    );

  return (
    <Menu
      shouldOpenOnLongPress
      actions={[
        { id: "message", title: "Message", image: "bubble.left" },
        { id: "thread", title: "New thread", image: "square.and.pencil" },
        { id: "remove", title: "Remove", image: "trash", attributes: { destructive: true } },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "message") {
          navigation.navigate("BotChat", chatTarget(props.bot, props.activity));
        }
        if (nativeEvent.event === "thread") {
          navigation.navigate("BotChat", { botId: props.bot.id, newThread: true });
        }
        if (nativeEvent.event === "remove") confirmRemove();
      }}
    >
      <RowShell
        accessibilityLabel={`${props.bot.name}. ${live.text}`}
        onPress={() => navigation.navigate("BotProfile", { botId: props.bot.id })}
        leading={<BotFace bot={props.bot} size={46} mood={moodForStatus(status.kind)} />}
      >
        <RowText
          title={props.bot.name}
          dot={status.kind === "working"}
          line={live.text}
          tone={live.tone}
          time={rowTime(status)}
        />
      </RowShell>
    </Menu>
  );
}

export function RowShell(props: {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  /** Menu's long-press trigger installs this on its child. */
  readonly onTouchStart?: PressableProps["onTouchStart"];
  readonly leading: ReactNode;
  readonly children: ReactNode;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onTouchStart={props.onTouchStart}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 6,
        paddingVertical: 9,
        borderRadius: TOTS_RADIUS.card - 6,
        backgroundColor: pressed ? colors.sunken : "transparent",
      })}
    >
      <View style={{ minWidth: 46, alignItems: "center" }}>{props.leading}</View>
      <View className="min-w-0 flex-1">{props.children}</View>
    </Pressable>
  );
}

export function RowText(props: {
  readonly title: string;
  readonly line: string;
  readonly tone: "blue" | "amber" | "red" | "muted";
  readonly time: string;
  readonly dot?: boolean;
}) {
  const colors = useTotsColors();
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-row items-center gap-1.5" style={{ flexShrink: 1 }}>
          <TotsText numberOfLines={1} style={{ fontWeight: "600", flexShrink: 1 }}>
            {props.title}
          </TotsText>
          {props.dot ? (
            <View
              accessibilityElementsHidden
              style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue }}
            />
          ) : null}
        </View>
        <View className="flex-1" />
        {props.time ? (
          <TotsText variant="small" tone="muted">
            {props.time}
          </TotsText>
        ) : null}
      </View>
      <TotsText variant="small" tone={props.tone} numberOfLines={1} style={{ fontSize: 13.5 }}>
        {props.line}
      </TotsText>
    </View>
  );
}

/** Large title header shared by the Tots tabs. */
export function TabHeader(props: {
  readonly title: string;
  readonly byline?: string;
  readonly summary?: string;
  readonly trailing?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3 px-1.5 pb-2">
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-baseline gap-2">
          <TotsText variant="title">{props.title}</TotsText>
          {props.byline ? (
            <TotsText variant="small" tone="muted">
              {props.byline}
            </TotsText>
          ) : null}
        </View>
        {props.summary ? (
          <TotsText variant="small" tone="muted" style={{ fontSize: 13.5 }}>
            {props.summary}
          </TotsText>
        ) : null}
      </View>
      {props.trailing ? (
        <View className="flex-row items-center gap-2" style={{ marginTop: 4 }}>
          {props.trailing}
        </View>
      ) : null}
    </View>
  );
}
