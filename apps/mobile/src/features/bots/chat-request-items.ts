import { linkRequestDisplay } from "@t3tools/client-runtime/link-request";
import { secretRequestDisplay } from "@t3tools/client-runtime/secret-request";
import type { OrchestrationV2ProjectedTurnItem } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

/**
 * Turn items that upstream's thread feed shows as a card the user can act on. Approvals and
 * questions are not here: they come from the thread's pending requests, above the composer.
 */
export type BotChatCardKind = "secret" | "link" | "plan";

/** A card item in a bot's chat, with the thread it came from. */
export interface BotChatCard {
  readonly environmentId: string;
  readonly threadId: string;
  readonly kind: BotChatCardKind;
  readonly projectedItem: OrchestrationV2ProjectedTurnItem;
}

export function botChatCardKind(
  projectedItem: Pick<OrchestrationV2ProjectedTurnItem, "item">,
): BotChatCardKind | null {
  const { item } = projectedItem;
  switch (item.type) {
    case "secret_request":
      return "secret";
    case "link_request":
      return "link";
    case "proposed_plan":
      return item.markdown.trim().length > 0 ? "plan" : null;
    default:
      return null;
  }
}

/** The card items of a thread, in feed order. */
export function botChatCardItems(
  rows: ReadonlyArray<OrchestrationV2ProjectedTurnItem>,
): OrchestrationV2ProjectedTurnItem[] {
  return rows.filter((row) => botChatCardKind(row) !== null);
}

/** True while the card still waits for an answer from this device. */
export function botChatCardNeedsAnswer(
  projectedItem: Pick<OrchestrationV2ProjectedTurnItem, "item" | "visibility">,
): boolean {
  const { item, visibility } = projectedItem;
  if (item.type === "secret_request") {
    return secretRequestDisplay(item, visibility).kind === "pending";
  }
  if (item.type === "link_request") {
    return linkRequestDisplay(item, visibility, (access) => access).kind === "pending";
  }
  return false;
}

/** The words after the bot's name in the card header, as in "Nova needs a secret". */
export function botChatCardTitle(kind: BotChatCardKind, needsAnswer: boolean): string {
  switch (kind) {
    case "secret":
      return needsAnswer ? "needs a secret" : "asked for a secret";
    case "link":
      return needsAnswer ? "wants to link a machine" : "asked to link a machine";
    case "plan":
      return "proposed a plan";
  }
}

/** When the card goes in the timeline: when its item started, or else its last update. */
export function botChatCardCreatedAt(
  projectedItem: Pick<OrchestrationV2ProjectedTurnItem, "item">,
): string {
  const { item } = projectedItem;
  return DateTime.formatIso(item.startedAt ?? item.updatedAt);
}

/** Text to copy from the card: what the agent asked for, or the plan. */
export function botChatCardText(
  projectedItem: Pick<OrchestrationV2ProjectedTurnItem, "item">,
): string {
  const { item } = projectedItem;
  switch (item.type) {
    case "secret_request":
      return [item.label, item.reason.trim()].filter((part) => part.length > 0).join("\n");
    case "link_request":
      return item.reason;
    case "proposed_plan":
      return item.markdown;
    default:
      return "";
  }
}
