import {
  threadRuntimeIsActive,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";

export type BotStatusKind = "setting_up" | "working" | "needs_you" | "error" | "idle";

export interface BotStatus {
  readonly kind: BotStatusKind;
  readonly label: string;
  /** First line of the latest visible message, if any. */
  readonly preview: string | null;
  readonly previewFromBot: boolean;
  readonly updatedAt: string | null;
}

export const BOT_STATUS_COLORS: Readonly<Record<BotStatusKind, string>> = {
  setting_up: "#94A3B8",
  working: "#3B82F6",
  needs_you: "#F59E0B",
  error: "#EF4444",
  idle: "#22C55E",
};

type StatusShell = Pick<
  EnvironmentThreadShell,
  "hasPendingApprovals" | "hasPendingUserInput" | "runtime" | "updatedAt"
> & {
  readonly source: {
    readonly latestVisibleMessage: {
      readonly role: "user" | "assistant" | "system";
      readonly text: string;
    } | null;
  };
};

export function deriveBotStatus(shell: StatusShell | null): BotStatus {
  if (shell === null) {
    return {
      kind: "setting_up",
      label: "Setting up",
      preview: null,
      previewFromBot: false,
      updatedAt: null,
    };
  }
  const latest = shell.source.latestVisibleMessage;
  const preview =
    latest?.text
      .split("\n")
      .map((line) => line.replace(/[#*_`>]/g, "").trim())
      .find((line) => line.length > 0) ?? null;
  const base = {
    preview,
    previewFromBot: latest?.role === "assistant",
    updatedAt: shell.updatedAt,
  };
  if (shell.hasPendingApprovals) return { ...base, kind: "needs_you", label: "Needs approval" };
  if (shell.hasPendingUserInput) return { ...base, kind: "needs_you", label: "Has a question" };
  if (threadRuntimeIsActive(shell.runtime)) return { ...base, kind: "working", label: "Working" };
  if (shell.runtime?.lastError) return { ...base, kind: "error", label: "Hit an error" };
  return { ...base, kind: "idle", label: "Ready" };
}

export function formatBotTime(iso: string | null) {
  if (iso === null) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
