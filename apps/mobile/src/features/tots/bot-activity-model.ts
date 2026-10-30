import type { BotStatus, BotStatusKind } from "../bots/bot-status-model";

const PRIORITY: Readonly<Record<BotStatusKind, number>> = {
  needs_you: 4,
  working: 3,
  error: 2,
  setting_up: 1,
  idle: 0,
};

export interface ThreadStatus {
  readonly threadId: string;
  readonly status: BotStatus;
}

export interface BotActivity {
  /** What the roster shows: the most urgent thread, so a waiting side thread is not hidden. */
  readonly status: BotStatus;
  readonly threadId: string;
  readonly busyThreads: number;
}

/** Ties keep the earlier thread, so the main chat wins over side threads. */
export function summarizeBotActivity(threads: ReadonlyArray<ThreadStatus>): BotActivity | null {
  let top: ThreadStatus | null = null;
  let latest: string | null = null;
  let busyThreads = 0;
  for (const thread of threads) {
    if (thread.status.kind === "working" || thread.status.kind === "needs_you") busyThreads += 1;
    if (top === null || PRIORITY[thread.status.kind] > PRIORITY[top.status.kind]) top = thread;
    const updatedAt = thread.status.updatedAt;
    if (updatedAt !== null && (latest === null || updatedAt > latest)) latest = updatedAt;
  }
  if (top === null) return null;
  return {
    status: { ...top.status, updatedAt: latest ?? top.status.updatedAt },
    threadId: top.threadId,
    busyThreads,
  };
}
