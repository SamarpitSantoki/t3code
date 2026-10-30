import {
  PlanId,
  ThreadId,
  TurnItemId,
  type OrchestrationV2ProjectedTurnItem,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  botChatCardCreatedAt,
  botChatCardItems,
  botChatCardKind,
  botChatCardNeedsAnswer,
  botChatCardText,
  botChatCardTitle,
} from "./chat-request-items";
import { buildTeamTimeline } from "./bots-model";
import { layoutTeamTimeline } from "./team-timeline-layout";

const base = {
  threadId: ThreadId.make("thread-1"),
  runId: null,
  nodeId: null,
  providerThreadId: null,
  providerTurnId: null,
  nativeItemRef: null,
  parentItemId: null,
  ordinal: 0,
  status: "running" as const,
  title: null,
  startedAt: DateTime.makeUnsafe("2026-10-30T10:00:00.000Z"),
  completedAt: null,
  updatedAt: DateTime.makeUnsafe("2026-10-30T10:05:00.000Z"),
};

function projected(
  item: OrchestrationV2TurnItem,
  visibility: OrchestrationV2ProjectedTurnItem["visibility"] = "local",
): OrchestrationV2ProjectedTurnItem {
  return { position: 0, visibility, sourceThreadId: item.threadId, sourceItemId: item.id, item };
}

function secretItem(
  secretStatus: "pending" | "saved" | "declined" | "cancelled" = "pending",
  visibility: OrchestrationV2ProjectedTurnItem["visibility"] = "local",
) {
  return projected(
    {
      ...base,
      id: TurnItemId.make("secret-1"),
      type: "secret_request",
      label: "OpenAI API key",
      reason: "To call the API in tests.",
      secretStatus,
    },
    visibility,
  );
}

function linkItem(
  linkStatus: "pending" | "linked" | "declined" | "cancelled" | "failed" = "pending",
  visibility: OrchestrationV2ProjectedTurnItem["visibility"] = "local",
) {
  return projected(
    {
      ...base,
      id: TurnItemId.make("link-1"),
      type: "link_request",
      reason: "I need the VPS to deploy.",
      linkStatus,
    },
    visibility,
  );
}

function planItem(markdown: string) {
  return projected({
    ...base,
    id: TurnItemId.make("plan-1"),
    type: "proposed_plan",
    planId: PlanId.make("plan-1"),
    markdown,
    streaming: false,
  });
}

function reasoningItem() {
  return projected({
    ...base,
    id: TurnItemId.make("reasoning-1"),
    type: "reasoning",
    text: "Thinking",
    streaming: false,
  });
}

describe("botChatCardKind", () => {
  it("keeps the items upstream's feed shows as cards", () => {
    expect(botChatCardKind(secretItem())).toBe("secret");
    expect(botChatCardKind(linkItem())).toBe("link");
    expect(botChatCardKind(planItem("# Plan\n- step"))).toBe("plan");
  });

  it("drops other items and empty plans", () => {
    expect(botChatCardKind(reasoningItem())).toBeNull();
    expect(botChatCardKind(planItem("  \n"))).toBeNull();
  });
});

describe("botChatCardItems", () => {
  it("filters a thread's items and keeps their order", () => {
    const rows = [reasoningItem(), linkItem(), planItem(""), secretItem()];
    expect(botChatCardItems(rows).map((row) => row.item.id)).toStrictEqual(["link-1", "secret-1"]);
  });
});

describe("botChatCardNeedsAnswer", () => {
  it("is true only for a pending request asked in this thread", () => {
    expect(botChatCardNeedsAnswer(secretItem("pending"))).toBe(true);
    expect(botChatCardNeedsAnswer(linkItem("pending"))).toBe(true);
    expect(botChatCardNeedsAnswer(secretItem("pending", "inherited"))).toBe(false);
    expect(botChatCardNeedsAnswer(linkItem("pending", "inherited"))).toBe(false);
  });

  it("is false once the request is answered, and for plans", () => {
    expect(botChatCardNeedsAnswer(secretItem("saved"))).toBe(false);
    expect(botChatCardNeedsAnswer(secretItem("cancelled"))).toBe(false);
    expect(botChatCardNeedsAnswer(linkItem("linked"))).toBe(false);
    expect(botChatCardNeedsAnswer(linkItem("failed"))).toBe(false);
    expect(botChatCardNeedsAnswer(planItem("# Plan"))).toBe(false);
  });
});

describe("botChatCardTitle", () => {
  it("says what the bot wants while it waits, and what it asked after", () => {
    expect(botChatCardTitle("secret", true)).toBe("needs a secret");
    expect(botChatCardTitle("secret", false)).toBe("asked for a secret");
    expect(botChatCardTitle("link", true)).toBe("wants to link a machine");
    expect(botChatCardTitle("plan", false)).toBe("proposed a plan");
  });
});

describe("botChatCardCreatedAt and botChatCardText", () => {
  it("places the card when its item started", () => {
    expect(botChatCardCreatedAt(secretItem())).toBe("2026-10-30T10:00:00.000Z");
  });

  it("falls back to the last update when the item never started", () => {
    const item = secretItem();
    expect(botChatCardCreatedAt({ item: { ...item.item, startedAt: null } })).toBe(
      "2026-10-30T10:05:00.000Z",
    );
  });

  it("copies what the agent asked for", () => {
    expect(botChatCardText(secretItem())).toBe("OpenAI API key\nTo call the API in tests.");
    expect(botChatCardText(linkItem())).toBe("I need the VPS to deploy.");
    expect(botChatCardText(planItem("# Plan"))).toBe("# Plan");
  });
});

describe("buildTeamTimeline with cards", () => {
  const bot = {
    id: "nova",
    name: "Nova",
    environmentId: "env-1",
    threadId: "thread-1",
    setupMessageId: "setup",
  };

  it("puts a bot's card items between its messages, by time", () => {
    const timeline = buildTeamTimeline({
      hiddenMessageIds: [],
      sources: [
        {
          bot,
          cardItems: [secretItem(), reasoningItem()],
          messages: [
            {
              id: "m1",
              role: "assistant",
              text: "I need a key.",
              createdAt: "2026-10-30T09:59:00.000Z",
              streaming: false,
            },
            {
              id: "m2",
              role: "assistant",
              text: "Thanks.",
              createdAt: "2026-10-30T10:01:00.000Z",
              streaming: false,
            },
          ],
        },
      ],
    });
    expect(timeline.map((entry) => entry.kind)).toStrictEqual(["bot", "card", "bot"]);
    expect(timeline[1]).toMatchObject({
      id: "nova:card:secret-1",
      from: "Nova",
      botId: "nova",
      createdAt: "2026-10-30T10:00:00.000Z",
      card: { environmentId: "env-1", threadId: "thread-1", kind: "secret" },
    });
    expect(timeline[1]?.card?.projectedItem.item.id).toBe("secret-1");
  });

  it("never groups a card with the bot's messages around it", () => {
    const timeline = buildTeamTimeline({
      hiddenMessageIds: [],
      sources: [
        {
          bot,
          cardItems: [linkItem()],
          messages: [
            {
              id: "m2",
              role: "assistant",
              text: "Linked, thanks.",
              createdAt: "2026-10-30T10:01:00.000Z",
              streaming: false,
            },
          ],
        },
      ],
    });
    const items = layoutTeamTimeline(timeline, new Date("2026-10-30T12:00:00.000Z"));
    const grouped = items.flatMap((item) =>
      item.kind === "entry" ? [[item.entry.kind, item.grouped] as const] : [],
    );
    expect(grouped).toStrictEqual([
      ["card", false],
      ["bot", false],
    ]);
  });
});
