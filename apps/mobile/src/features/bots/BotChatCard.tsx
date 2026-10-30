import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { View } from "react-native";

import { useThreadCwd } from "../../state/use-selected-thread-worktree";
import { LinkRequestCard } from "../threads/LinkRequestCard";
import { ProposedPlanCard } from "../threads/ProposedPlanCard";
import { SecretRequestCard } from "../threads/SecretRequestCard";
import { BotFace } from "../tots/BotFace";
import { useTotsColors } from "../tots/theme";
import { TotsText } from "../tots/ui";
import { BotMarkdown } from "./BotMarkdown";
import type { ChatBot } from "./BotChatView";
import { formatBotTime } from "./bot-status";
import { botChatCardNeedsAnswer, botChatCardTitle, type BotChatCard } from "./chat-request-items";

/**
 * A turn item the user can act on, shown in a bot or team chat. The card itself is upstream's,
 * so answering it works as it does in a thread; the bot's face and name sit above it.
 */
export function BotChatCardRow(props: {
  readonly card: BotChatCard;
  readonly bot: ChatBot;
  readonly createdAt: string;
}) {
  const colors = useTotsColors();
  const { card } = props;
  const needsAnswer = botChatCardNeedsAnswer(card.projectedItem);
  const settled = card.kind !== "plan" && !needsAnswer;
  const environmentId = EnvironmentId.make(card.environmentId);
  const time = formatBotTime(props.createdAt);
  return (
    <View style={{ marginTop: settled ? 10 : 18, gap: 8 }}>
      {settled ? null : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <BotFace bot={props.bot} size={22} mood={needsAnswer ? "waiting" : "idle"} />
          <TotsText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${props.bot.name} ${botChatCardTitle(card.kind, needsAnswer)}`}
          </TotsText>
          {time ? (
            <TotsText variant="small" tone="muted">
              {time}
            </TotsText>
          ) : null}
        </View>
      )}
      {card.kind === "secret" ? (
        <SecretRequestCard
          environmentId={environmentId}
          projectedItem={card.projectedItem}
          iconColor={colors.muted}
        />
      ) : card.kind === "link" ? (
        <LinkRequestCard
          environmentId={environmentId}
          projectedItem={card.projectedItem}
          iconColor={colors.muted}
        />
      ) : (
        <BotPlanCard card={card} />
      )}
    </View>
  );
}

function BotPlanCard(props: { readonly card: BotChatCard }) {
  const { card } = props;
  const environmentId = EnvironmentId.make(card.environmentId);
  const cwd = useThreadCwd(scopeThreadRef(environmentId, ThreadId.make(card.threadId)));
  const { item } = card.projectedItem;
  if (item.type !== "proposed_plan") return null;
  return (
    <ProposedPlanCard
      environmentId={environmentId}
      workspaceRoot={cwd}
      markdown={item.markdown}
      renderMarkdown={(text) => <BotMarkdown text={text} />}
    />
  );
}
