import * as DateTime from "effect/DateTime";

/** Read times kept on the phone; the oldest go first when there are more. */
export const CHAT_READ_LIMIT = 400;

export type ChatReads = Readonly<Record<string, string>>;

export function chatThreadKey(environmentId: string, threadId: string) {
  return `${environmentId}:${threadId}`;
}

/** Milliseconds for an ISO string or a server DateTime; null when it has no valid time. */
export function messageTime(value: DateTime.Utc | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return DateTime.toEpochMillis(value);
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/**
 * The read time to save. It is never before the message it covers, so a server clock ahead of
 * the phone cannot leave an opened chat unread.
 */
export function readTimeFor(nowMs: number, latestMessageMs: number | null): string {
  return new Date(Math.max(nowMs, latestMessageMs ?? 0)).toISOString();
}

/** Saves a read time, never moving it back, and drops the oldest entries over the limit. */
export function withChatRead(
  reads: ChatReads,
  key: string,
  readAt: string,
  limit = CHAT_READ_LIMIT,
): ChatReads {
  const previous = reads[key];
  if (previous !== undefined && previous >= readAt) return reads;
  const entries = Object.entries({ ...reads, [key]: readAt });
  if (entries.length <= limit) return Object.fromEntries(entries);
  return Object.fromEntries(entries.sort((a, b) => b[1].localeCompare(a[1])).slice(0, limit));
}

/** The bot spoke last and the user has not opened the chat since. */
export function isChatUnread(input: {
  readonly latest: { readonly role: string; readonly time: number | null } | null;
  readonly readAt: string | undefined;
  readonly muted: boolean;
}): boolean {
  if (input.muted || input.latest === null || input.latest.role !== "assistant") return false;
  const readAt = messageTime(input.readAt);
  if (readAt === null) return true;
  return input.latest.time !== null && input.latest.time > readAt;
}

export function toggleChatMute(muted: ReadonlyArray<string>, key: string): ReadonlyArray<string> {
  return muted.includes(key) ? muted.filter((item) => item !== key) : [...muted, key];
}
