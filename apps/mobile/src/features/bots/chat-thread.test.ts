import { describe, expect, it } from "vite-plus/test";

import { chatStatusLine, resolveShownChat } from "./chat-thread";

const bot = {
  threadId: "main",
  threads: [{ threadId: "side", title: "Fix tests", setupMessageId: "m", createdAt: "" }],
};

describe("resolveShownChat", () => {
  it("shows the main chat by default or when its id is passed", () => {
    expect(resolveShownChat(bot, {})).toEqual({ kind: "main", threadId: "main" });
    expect(resolveShownChat(bot, { threadId: "main" })).toEqual({ kind: "main", threadId: "main" });
  });

  it("shows a side thread with its title, even before the registry knows it", () => {
    expect(resolveShownChat(bot, { threadId: "side" })).toEqual({
      kind: "side",
      threadId: "side",
      title: "Fix tests",
    });
    expect(resolveShownChat(bot, { threadId: "other" })).toMatchObject({ title: "Thread" });
  });

  it("prefers a new thread draft", () => {
    expect(resolveShownChat(bot, { threadId: "side", newThread: true })).toEqual({
      kind: "new",
      threadId: null,
    });
  });
});

describe("chatStatusLine", () => {
  it("colors the states that need attention", () => {
    expect(chatStatusLine("working")).toEqual({ label: "Working", tone: "blue" });
    expect(chatStatusLine("needs_you")).toEqual({ label: "Waiting for you", tone: "amber" });
    expect(chatStatusLine("error").tone).toBe("red");
    expect(chatStatusLine("idle")).toEqual({ label: "Ready", tone: "muted" });
  });
});
