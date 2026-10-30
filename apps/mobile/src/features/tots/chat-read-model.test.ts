import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  isChatUnread,
  messageTime,
  readTimeFor,
  toggleChatMute,
  withChatRead,
} from "./chat-read-model";

const T1 = "2026-10-28T09:00:00.000Z";
const T2 = "2026-10-28T10:00:00.000Z";

describe("messageTime", () => {
  it("reads ISO strings and server times", () => {
    expect(messageTime(T1)).toBe(Date.parse(T1));
    expect(messageTime(DateTime.makeUnsafe(T1))).toBe(Date.parse(T1));
    expect(messageTime("nope")).toBeNull();
    expect(messageTime(null)).toBeNull();
  });
});

describe("readTimeFor", () => {
  it("never saves a time before the message it covers", () => {
    expect(readTimeFor(Date.parse(T1), Date.parse(T2))).toBe(T2);
    expect(readTimeFor(Date.parse(T2), Date.parse(T1))).toBe(T2);
    expect(readTimeFor(Date.parse(T1), null)).toBe(T1);
  });
});

describe("withChatRead", () => {
  it("moves read times forward only", () => {
    const reads = withChatRead({}, "env:a", T2);
    expect(withChatRead(reads, "env:a", T1)).toBe(reads);
    expect(withChatRead(reads, "env:b", T1)).toEqual({ "env:a": T2, "env:b": T1 });
  });

  it("drops the oldest entries over the limit", () => {
    const reads = withChatRead({ "env:a": T1, "env:b": T2 }, "env:c", T2, 2);
    expect(Object.keys(reads).sort()).toEqual(["env:b", "env:c"]);
  });
});

describe("isChatUnread", () => {
  const latest = { role: "assistant", time: Date.parse(T2) };

  it("is unread when the bot spoke after the last open", () => {
    expect(isChatUnread({ latest, readAt: T1, muted: false })).toBe(true);
    expect(isChatUnread({ latest, readAt: T2, muted: false })).toBe(false);
  });

  it("treats a never-opened chat as unread only when the bot spoke last", () => {
    expect(isChatUnread({ latest, readAt: undefined, muted: false })).toBe(true);
    expect(
      isChatUnread({ latest: { ...latest, role: "user" }, readAt: undefined, muted: false }),
    ).toBe(false);
    expect(isChatUnread({ latest: null, readAt: undefined, muted: false })).toBe(false);
  });

  it("never shows unread for muted chats", () => {
    expect(isChatUnread({ latest, readAt: T1, muted: true })).toBe(false);
  });
});

describe("toggleChatMute", () => {
  it("adds and removes a chat", () => {
    expect(toggleChatMute([], "env:a")).toEqual(["env:a"]);
    expect(toggleChatMute(["env:a", "env:b"], "env:a")).toEqual(["env:b"]);
  });
});
