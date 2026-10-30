import { describe, expect, it } from "vite-plus/test";

import { agentTalkLabel, findAgentSender } from "./agent-sender";

const nova = {
  id: "nova",
  name: "Nova",
  threadId: "thread-nova",
  threads: [
    { threadId: "thread-nova-2", title: "Side", setupMessageId: "s", createdAt: "2026-10-27" },
  ],
};
const manager = { id: "manager", name: "T3 Manager", threadId: "thread-manager" };

describe("findAgentSender", () => {
  it("matches the main thread or a side thread first", () => {
    expect(
      findAgentSender([manager, nova], { fromName: "x", fromThreadId: "thread-nova" }),
    ).toStrictEqual({
      bot: nova,
      threadId: "thread-nova",
    });
    expect(
      findAgentSender([manager, nova], { fromName: "T3 Manager", fromThreadId: "thread-nova-2" }),
    ).toStrictEqual({ bot: nova, threadId: "thread-nova-2" });
  });

  it("falls back to the name, ignoring case", () => {
    expect(
      findAgentSender([manager, nova], { fromName: "t3 manager", fromThreadId: "thread-other" }),
    ).toStrictEqual({ bot: manager, threadId: null });
  });

  it("returns null for an unknown sender", () => {
    expect(findAgentSender([manager, nova], { fromName: "Ghost", fromThreadId: "t" })).toBeNull();
    expect(findAgentSender([manager], { fromName: " " })).toBeNull();
  });
});

describe("agentTalkLabel", () => {
  it("names sender and receiver", () => {
    expect(agentTalkLabel("T3 Manager", "Tot")).toBe("T3 Manager → Tot");
    expect(agentTalkLabel("T3 Manager", null)).toBe("T3 Manager");
  });
});
