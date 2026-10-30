import { describe, expect, it } from "vite-plus/test";

import { formatAgentMessageHeader, parseAgentMessage } from "./agent-message";

describe("parseAgentMessage", () => {
  it("reads the sender from the header", () => {
    const header = formatAgentMessageHeader({ name: "T3 Manager", threadId: "mcp:demo1" });
    expect(parseAgentMessage(`${header} 4 threads are running.`)).toEqual({
      fromName: "T3 Manager",
      fromThreadId: "mcp:demo1",
      body: "4 threads are running.",
    });
  });

  it("allows a note after the thread id and a body on the next line", () => {
    expect(
      parseAgentMessage("From Tot (thread abc12345), approved by the user: a new rule\nKeep it."),
    ).toEqual({ fromName: "Tot", fromThreadId: "abc12345", body: "a new rule\nKeep it." });
  });

  it("returns null for messages a person wrote", () => {
    expect(parseAgentMessage("From now on, be brief.")).toBeNull();
    expect(parseAgentMessage("Fix the login bug")).toBeNull();
  });
});
