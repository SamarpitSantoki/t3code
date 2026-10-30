import type { TeamTimelineEntry } from "./bots-model";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type TeamTimelineItem =
  | { readonly kind: "day"; readonly id: string; readonly label: string }
  | {
      readonly kind: "entry";
      readonly id: string;
      readonly entry: TeamTimelineEntry;
      /** Same sender as the row above, within a few minutes: hide the avatar and name. */
      readonly grouped: boolean;
    };

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function formatDayLabel(date: Date, now: Date) {
  if (dayKey(date) === dayKey(now)) return "Today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Adds day separators and marks follow-up messages from the same sender. */
export function layoutTeamTimeline(
  entries: ReadonlyArray<TeamTimelineEntry>,
  now = new Date(),
): TeamTimelineItem[] {
  const items: TeamTimelineItem[] = [];
  let previous: TeamTimelineEntry | null = null;
  let previousTime = 0;
  let previousDay = "";
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const time = date.getTime();
    const valid = !Number.isNaN(time);
    const day: string = valid ? dayKey(date) : previousDay;
    if (valid && day !== previousDay) {
      items.push({ kind: "day", id: `day:${day}`, label: formatDayLabel(date, now) });
    }
    const grouped =
      previous !== null &&
      entry.kind !== "handoff" &&
      entry.kind !== "agent" &&
      entry.kind !== "card" &&
      previous.kind === entry.kind &&
      previous.botId === entry.botId &&
      previousDay === day &&
      valid &&
      time - previousTime <= GROUP_WINDOW_MS;
    items.push({ kind: "entry", id: entry.id, entry, grouped });
    previous = entry;
    if (valid) previousTime = time;
    previousDay = day;
  }
  return items;
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: ReadonlyArray<string>) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Puts `@name ` at the start of the draft, replacing a leading mention of another member. */
export function withMention(text: string, name: string, memberNames: ReadonlyArray<string>) {
  const trimmed = text.trimStart();
  const lower = trimmed.toLowerCase();
  const current = [...memberNames]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => {
      const prefix = `@${candidate.toLowerCase()}`;
      if (!lower.startsWith(prefix)) return false;
      const next = lower.charAt(prefix.length);
      return next === "" || /[\s,:]/.test(next);
    });
  const rest = current ? trimmed.slice(current.length + 1).replace(/^[\s,:]+/, "") : trimmed;
  return `@${name} ${rest}`;
}
