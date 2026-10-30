import {
  FULL_ACCESS_OVERRIDE_QUESTION,
  fullAccessOverrideExplanation,
  type ThreadUserInputQuestion,
} from "@t3tools/client-runtime/state/thread-requests";
import type { ProviderApprovalDecision, ProviderApprovalOption } from "@t3tools/contracts";
import * as Haptics from "expo-haptics";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import { isPendingUserInputOptionSelected } from "../../lib/threadActivity";
import { BotFace } from "../tots/BotFace";
import { TOTS_FONT, TOTS_RADIUS, useTotsColors } from "../tots/theme";
import { TotsButton, TotsCard, TotsGlyph, TotsText } from "../tots/ui";
import type { Bot } from "./bots-model";
import {
  useBotRequests,
  type BotPendingApproval,
  type BotPendingUserInput,
  type BotRequests as BotRequestsState,
} from "./use-bot-requests";

type RequestBot = Pick<
  Bot,
  "id" | "name" | "emoji" | "color" | "accessory" | "environmentId" | "threadId"
>;

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const DEFAULT_APPROVAL_OPTIONS: ReadonlyArray<ProviderApprovalOption> = [
  { decision: "accept", label: "Allow once" },
  { decision: "acceptForSession", label: "Allow session" },
  { decision: "decline", label: "Decline" },
];

const DETAIL_COLLAPSED_LINES = 6;

function approvalAction(approval: BotPendingApproval): string {
  if (approval.appName) return `wants to use ${approval.appName}`;
  switch (approval.requestKind) {
    case "command":
      return "wants to run a command";
    case "file-read":
      return "wants to read a file";
    case "file-change":
      return "wants to edit files";
    case "mcp-elicitation":
      return "wants to use a tool";
    case "permission":
      return "needs your permission";
  }
}

function approvalOptionLabel(option: ProviderApprovalOption): string {
  if (option.decision === "accept") return "Allow";
  if (option.decision === "acceptForSession") return "Always";
  if (option.decision === "decline") return "Deny";
  return option.label;
}

function CardShell(props: {
  readonly bot: RequestBot;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <TotsCard style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <BotFace bot={props.bot} size={22} mood="waiting" />
        <TotsText numberOfLines={2} style={{ flex: 1, fontSize: 14.5 }}>
          {`${props.bot.name} ${props.title}`}
        </TotsText>
      </View>
      {props.children}
    </TotsCard>
  );
}

function DetailBlock(props: { readonly text: string }) {
  const colors = useTotsColors();
  const [expanded, setExpanded] = useState(false);
  const long =
    props.text.split("\n").length > DETAIL_COLLAPSED_LINES ||
    props.text.length > DETAIL_COLLAPSED_LINES * 48;
  return (
    <Pressable
      accessibilityRole={long ? "button" : undefined}
      accessibilityState={long ? { expanded } : undefined}
      disabled={!long}
      onPress={() => setExpanded((open) => !open)}
      style={({ pressed }) => ({
        gap: 4,
        borderRadius: 12,
        backgroundColor: colors.code,
        paddingHorizontal: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        numberOfLines={expanded ? undefined : DETAIL_COLLAPSED_LINES}
        selectable
        style={{ fontFamily: MONO, fontSize: 13, lineHeight: 18, color: colors.ink }}
      >
        {props.text}
      </Text>
      {long ? (
        <TotsText variant="small" tone="muted">
          {expanded ? "Show less" : "Show more"}
        </TotsText>
      ) : null}
    </Pressable>
  );
}

function ConnectionNotice(props: { readonly canOperate: boolean; readonly live: boolean }) {
  if (!props.live) {
    return (
      <TotsText variant="small" tone="muted">
        The provider process for this request is no longer available. Stop or restart the run to
        continue.
      </TotsText>
    );
  }
  if (!props.canOperate) {
    return (
      <TotsText variant="small" tone="muted">
        This connection cannot respond to requests.
      </TotsText>
    );
  }
  return null;
}

export function BotApprovalCard(props: {
  readonly bot: RequestBot;
  readonly approval: BotPendingApproval;
  readonly requests: BotRequestsState;
}) {
  const { approval, requests } = props;
  const [decision, setDecision] = useState<ProviderApprovalDecision | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const options = approval.options ?? DEFAULT_APPROVAL_OPTIONS;
  const primary = options.find((option) => option.decision === "accept") ?? null;
  const secondary = options.filter((option) => option !== primary);
  const warning = options.find((option) => option.warning)?.warning;
  const live = approval.responseCapability === "live";
  const responding = requests.respondingRequestId === approval.requestId;
  const disabled = !live || !requests.canOperate || responding;

  const respond = async (next: ProviderApprovalDecision) => {
    if (next !== "decline" && next !== "cancel") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    setDecision(next);
    await requests.respondToApproval(approval.requestId, next);
    setDecision(null);
  };

  return (
    <CardShell bot={props.bot} title={approvalAction(approval)}>
      {approval.detail ? <DetailBlock text={approval.detail} /> : null}
      {approval.reason ? (
        <TotsText variant="small" tone="amber">
          {approval.reason}
        </TotsText>
      ) : null}
      {approval.fullAccessOverride ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: explanationOpen }}
          onPress={() => setExplanationOpen((open) => !open)}
          style={{ gap: 4 }}
        >
          <TotsText variant="small" tone="inkSoft" style={{ textDecorationLine: "underline" }}>
            {FULL_ACCESS_OVERRIDE_QUESTION}
          </TotsText>
          {explanationOpen ? (
            <TotsText variant="small" tone="muted">
              {fullAccessOverrideExplanation(approval.fullAccessOverride)}
            </TotsText>
          ) : null}
        </Pressable>
      ) : null}
      {warning ? (
        <TotsText variant="small" tone="amber">
          {warning}
        </TotsText>
      ) : null}
      <ConnectionNotice canOperate={requests.canOperate} live={live} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {primary ? (
          <TotsButton
            label={approvalOptionLabel(primary)}
            kind="dark"
            grow
            disabled={disabled}
            loading={responding && decision === primary.decision}
            onPress={() => void respond(primary.decision)}
          />
        ) : null}
        {secondary.map((option) => (
          <TotsButton
            key={option.decision}
            label={approvalOptionLabel(option)}
            kind="light"
            disabled={disabled}
            loading={responding && decision === option.decision}
            onPress={() => void respond(option.decision)}
          />
        ))}
      </View>
    </CardShell>
  );
}

function QuestionBlock(props: {
  readonly request: BotPendingUserInput;
  readonly question: ThreadUserInputQuestion;
  readonly requests: BotRequestsState;
  readonly disabled: boolean;
  readonly answersOnTap: boolean;
}) {
  const { request, question, requests } = props;
  const draft = requests.userInputDrafts(request)[question.id];
  const customAnswer = draft?.customAnswer ?? "";
  const allowsText = question.allowCustomAnswer !== false;
  const colors = useTotsColors();

  const pickOption = (value: string) => {
    if (props.answersOnTap) {
      void requests.submitUserInput(request, { [question.id]: value });
      return;
    }
    requests.selectUserInputOption(request.requestId, question, value);
  };

  return (
    <View style={{ gap: 8 }}>
      {question.header !== question.question ? (
        <TotsText variant="caps" tone="muted">
          {question.header.toUpperCase()}
        </TotsText>
      ) : null}
      <TotsText selectable>{question.question}</TotsText>
      {question.options.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {question.options.map((option) => {
            const value = option.value ?? option.label.trim();
            const selected = isPendingUserInputOptionSelected(question, draft, value);
            return (
              <Pressable
                key={value}
                accessibilityRole={question.multiSelect ? "checkbox" : "button"}
                accessibilityHint={
                  option.description !== option.label ? option.description : undefined
                }
                accessibilityState={{ checked: selected, disabled: props.disabled }}
                disabled={props.disabled}
                onPress={() => pickOption(value)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  justifyContent: "center",
                  borderRadius: TOTS_RADIUS.pill,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.line,
                  backgroundColor: selected ? colors.primary : colors.card,
                  paddingHorizontal: 14,
                  opacity: props.disabled ? 0.5 : pressed ? 0.75 : 1,
                })}
              >
                <Text
                  style={[TOTS_FONT.label, { color: selected ? colors.onPrimary : colors.ink }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {allowsText ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <TextInput
            value={customAnswer}
            editable={!props.disabled}
            multiline
            onChangeText={(text) =>
              requests.setUserInputCustomAnswer(request.requestId, question, text)
            }
            placeholder={question.options.length > 0 ? "Or type an answer" : "Type an answer"}
            placeholderTextColor={colors.placeholder}
            cursorColor={colors.ink}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 128,
              borderRadius: 14,
              backgroundColor: colors.sunken,
              paddingHorizontal: 12,
              paddingVertical: 9,
              fontSize: 15,
              color: colors.ink,
            }}
          />
          {props.answersOnTap ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send answer"
              disabled={props.disabled || customAnswer.trim().length === 0}
              onPress={() => void requests.submitUserInput(request)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                opacity:
                  props.disabled || customAnswer.trim().length === 0 ? 0.25 : pressed ? 0.8 : 1,
              })}
            >
              <TotsGlyph size={18} tone="onPrimary">
                ↑
              </TotsGlyph>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function BotQuestionCard(props: {
  readonly bot: RequestBot;
  readonly request: BotPendingUserInput;
  readonly requests: BotRequestsState;
}) {
  const { request, requests } = props;
  const live = request.responseCapability !== "not_resumable";
  const responding = requests.respondingRequestId === request.requestId;
  const disabled = !live || !requests.canOperate || responding;
  const count = request.questions.length;
  const single = count === 1 ? request.questions[0] : undefined;
  const answersOnTap = single !== undefined && !single.multiSelect;
  const answers = requests.userInputAnswers(request);

  return (
    <CardShell bot={props.bot} title={count === 1 ? "has a question" : `has ${count} questions`}>
      {request.questions.map((question) => (
        <QuestionBlock
          key={question.id}
          request={request}
          question={question}
          requests={requests}
          disabled={disabled}
          answersOnTap={answersOnTap}
        />
      ))}
      <ConnectionNotice canOperate={requests.canOperate} live={live} />
      {answersOnTap ? null : (
        <TotsButton
          label={count === 1 ? "Send answer" : "Send answers"}
          kind="dark"
          disabled={disabled || answers === null}
          loading={responding}
          onPress={() => void requests.submitUserInput(request)}
        />
      )}
      {request.dismissible ? (
        <TotsButton
          label="Skip"
          kind="ghost"
          size="small"
          disabled={!requests.canOperate || responding}
          onPress={() => void requests.dismissUserInput(request)}
        />
      ) : null}
    </CardShell>
  );
}

/** Every pending approval and question for the bot's thread; renders nothing when idle. */
export function BotRequests(props: { readonly bot: RequestBot }) {
  const requests = useBotRequests(props.bot);
  if (!requests.hasPending) return null;
  return (
    <View style={{ gap: 10 }}>
      {requests.approvals.map((approval) => (
        <BotApprovalCard
          key={approval.requestId}
          bot={props.bot}
          approval={approval}
          requests={requests}
        />
      ))}
      {requests.userInputs.map((request) => (
        <BotQuestionCard
          key={request.requestId}
          bot={props.bot}
          request={request}
          requests={requests}
        />
      ))}
    </View>
  );
}
