import { describe, expect, it } from "vite-plus/test";

import { deriveBotStatus } from "./bot-status-model";

function shell(overrides: Partial<Parameters<typeof deriveBotStatus>[0] & object> = {}) {
  return {
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    runtime: null,
    updatedAt: "2026-10-27T10:00:00.000Z",
    source: {
      latestVisibleMessage: { role: "assistant" as const, text: "## Done\n\n**Fixed** it" },
    },
    ...overrides,
  };
}

describe("deriveBotStatus", () => {
  it("reports a bot whose thread has not arrived yet as setting up", () => {
    expect(deriveBotStatus(null).kind).toBe("setting_up");
  });

  it("puts approvals ahead of running work", () => {
    expect(deriveBotStatus(shell({ hasPendingApprovals: true })).label).toBe("Needs approval");
    expect(deriveBotStatus(shell({ hasPendingUserInput: true })).kind).toBe("needs_you");
  });

  it("previews the first non-empty line without Markdown markers", () => {
    const status = deriveBotStatus(shell());
    expect(status).toMatchObject({ kind: "idle", preview: "Done", previewFromBot: true });
  });
});
