import type { Bot } from "./bots-model";

export const BOT_COLORS = [
  "#7C5CFF",
  "#3B82F6",
  "#06B6D4",
  "#14B8A6",
  "#22C55E",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#A855F7",
] as const;

export const BOT_EMOJIS = [
  "🤖",
  "🧠",
  "🔬",
  "🛠️",
  "🕵️",
  "🗺️",
  "✍️",
  "📈",
  "🎨",
  "⚡",
  "🧪",
  "🧭",
] as const;

/** The T3 Manager renames its thread to this, so other agents can find it. */
export const T3_MANAGER_THREAD_TITLE = "T3 Manager";

export const BOT_TEMPLATES = [
  {
    id: "researcher",
    name: "Researcher",
    emoji: "🔬",
    color: "#3B82F6",
    tagline: "Finds answers with sources",
    role: "Research questions for the team. Check current primary sources, cite them, and say how sure you are.",
  },
  {
    id: "coder",
    name: "Coder",
    emoji: "🛠️",
    color: "#7C5CFF",
    tagline: "Builds and fixes code",
    role: "Write and change code in this project. Keep changes small, run the relevant tests, and report what changed.",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    emoji: "🕵️",
    color: "#F59E0B",
    tagline: "Catches bugs before they ship",
    role: "Review changes for bugs, missing tests, and risky edits. Report findings ranked by severity, with file and line.",
  },
  {
    id: "planner",
    name: "Planner",
    emoji: "🗺️",
    color: "#14B8A6",
    tagline: "Turns goals into steps",
    role: "Turn goals into small, ordered tasks with clear done conditions. Track what is open and what is blocked.",
  },
  {
    id: "writer",
    name: "Writer",
    emoji: "✍️",
    color: "#EC4899",
    tagline: "Docs, posts and replies",
    role: "Write clear docs, release notes, and replies. Match the existing voice and keep it short.",
  },
  {
    id: "analyst",
    name: "Analyst",
    emoji: "📈",
    color: "#22C55E",
    tagline: "Digs into data and metrics",
    role: "Analyze data, logs, and metrics. Show the numbers, explain what changed, and flag anything unusual.",
  },
  {
    id: "t3-manager",
    name: "T3 Manager",
    emoji: "🧭",
    color: "#06B6D4",
    tagline: "Answers anything about T3",
    role: [
      "Be the T3 expert for the team. Other agents and the user come to you for anything about this T3 instance: threads, projects, worktrees, delegated tasks, scheduled tasks, pending approvals, pull requests, and the environment.",
      `First, rename this thread to "${T3_MANAGER_THREAD_TITLE}" with t3_thread_update, so other agents can find you with t3_thread_list (titleContains "${T3_MANAGER_THREAD_TITLE}").`,
      "Do the T3 work yourself with the t3-code tools, then answer with the facts: ids, statuses, links, and what you changed.",
      "When another thread asks, send the answer back to that thread with t3_thread_send. If the request does not say which thread sent it, find it with t3_thread_list (newest running threads) and reply there. Also post a one-line summary here.",
      "Read-only lookups need no approval. Ask the user before you delete, cancel, interrupt, or settle threads or tasks, or change schedules, projects, or settings.",
    ].join("\n"),
  },
] as const;

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result);
}

/** Bots saved before identities existed get a stable one from their id. */
export function botIdentity(bot: Pick<Bot, "id" | "emoji" | "color">) {
  const seed = hash(bot.id);
  return {
    emoji: bot.emoji ?? BOT_EMOJIS[seed % BOT_EMOJIS.length]!,
    color: bot.color ?? BOT_COLORS[seed % BOT_COLORS.length]!,
  };
}

/** `#RRGGBB` plus a two-digit alpha. */
export function tint(color: string, alpha: number) {
  const value = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${value}`;
}
