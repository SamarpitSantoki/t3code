import type { TeamTimelineEntry } from "./bots-model";
import { joinNames, type TeamTimelineItem } from "./team-timeline-layout";

export interface HandoffGroupItem {
  readonly kind: "handoffs";
  readonly id: string;
  /** The bot that handed the work out. */
  readonly from: string;
  readonly entries: ReadonlyArray<TeamTimelineEntry>;
}

export type ChatItem = TeamTimelineItem | HandoffGroupItem;

const SAME_MINUTE_MS = 60_000;

function sameMinute(first: TeamTimelineEntry, next: TeamTimelineEntry) {
  const start = Date.parse(first.createdAt);
  const time = Date.parse(next.createdAt);
  if (Number.isNaN(start) || Number.isNaN(time)) return false;
  return Math.abs(time - start) <= SAME_MINUTE_MS;
}

/** Folds back-to-back handoffs from one sender within a minute into one event. */
export function groupHandoffs(items: ReadonlyArray<TeamTimelineItem>): ChatItem[] {
  const result: ChatItem[] = [];
  for (const item of items) {
    if (item.kind !== "entry" || item.entry.kind !== "handoff") {
      result.push(item);
      continue;
    }
    const last = result[result.length - 1];
    const first = last?.kind === "handoffs" ? last.entries[0] : undefined;
    if (
      last?.kind === "handoffs" &&
      first !== undefined &&
      last.from === item.entry.from &&
      sameMinute(first, item.entry)
    ) {
      result[result.length - 1] = { ...last, entries: [...last.entries, item.entry] };
      continue;
    }
    result.push({
      kind: "handoffs",
      id: `handoffs:${item.id}`,
      from: item.entry.from,
      entries: [item.entry],
    });
  }
  return result;
}

/** Recipients in order of first handoff, each named once. */
export function handoffRecipients(entries: ReadonlyArray<TeamTimelineEntry>): string[] {
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.to !== null && !names.includes(entry.to)) names.push(entry.to);
  }
  return names;
}

/** "Nova messaged Rex and Ivy" in a team; "Nova handed Rex a task" in one bot's chat. */
export function handoffLabel(group: Pick<HandoffGroupItem, "from" | "entries">, team: boolean) {
  const recipients = joinNames(handoffRecipients(group.entries));
  if (team) return `${group.from} messaged ${recipients}`;
  const count = group.entries.length;
  return `${group.from} handed ${recipients} ${count === 1 ? "a task" : `${count} tasks`}`;
}

/** First readable line of a task, without markdown marks. */
export function taskPreview(text: string): string {
  return (
    text
      .split("\n")
      .map((line) => line.replace(/[#*_`>]/g, "").trim())
      .find((line) => line.length > 0) ?? ""
  );
}
