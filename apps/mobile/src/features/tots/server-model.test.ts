import { describe, expect, it } from "vite-plus/test";

import {
  hireBlockedReason,
  offlineSendNote,
  pickDefaultServer,
  projectsOnServer,
  serverStatusLabel,
  serverTone,
  setupCardFor,
  SETUP_SLOW_MS,
  type ServerSummary,
} from "./server-model";

function server(
  environmentId: string,
  connectionState: ServerSummary["connectionState"] = "connected",
  isEnabled = true,
): ServerSummary {
  return {
    environmentId,
    environmentLabel: environmentId.toUpperCase(),
    displayUrl: `https://${environmentId}.test`,
    isEnabled,
    connectionState,
    connectionError: null,
  };
}

const project = (environmentId: string, id: string) => ({ environmentId, id });

describe("serverTone", () => {
  it("is green only when enabled and connected", () => {
    expect(serverTone(server("a"))).toBe("connected");
    expect(serverTone(server("a", "connected", false))).toBe("offline");
  });

  it("is amber while connecting or reconnecting", () => {
    expect(serverTone(server("a", "connecting"))).toBe("connecting");
    expect(serverTone(server("a", "reconnecting"))).toBe("connecting");
  });

  it("is gray for errors, offline and missing servers", () => {
    expect(serverTone(server("a", "error"))).toBe("offline");
    expect(serverTone(server("a", "offline"))).toBe("offline");
    expect(serverTone(undefined)).toBe("offline");
  });
});

describe("serverStatusLabel", () => {
  it("names switched off and removed servers", () => {
    expect(serverStatusLabel(server("a", "connected", false))).toBe("Switched off");
    expect(serverStatusLabel(null)).toBe("Removed");
    expect(serverStatusLabel(server("a", "unsupported"))).toBe("Needs an update");
  });
});

describe("pickDefaultServer", () => {
  it("prefers the first connected server with projects over an earlier offline one", () => {
    // The device bug: the relay entry came first and was offline, so projects[0] was unreachable.
    const servers = [server("relay", "reconnecting"), server("direct")];
    const projects = [project("relay", "p1"), project("direct", "p2")];
    expect(pickDefaultServer({ servers, projects, chosenEnvironmentId: null })).toBe("direct");
  });

  it("keeps the user's choice even when offline", () => {
    const servers = [server("a"), server("b", "offline")];
    expect(pickDefaultServer({ servers, projects: [], chosenEnvironmentId: "b" })).toBe("b");
  });

  it("drops a choice that no longer exists", () => {
    const servers = [server("a")];
    expect(pickDefaultServer({ servers, projects: [], chosenEnvironmentId: "gone" })).toBe("a");
  });

  it("falls back to a connected server without projects, then any server with projects", () => {
    expect(
      pickDefaultServer({
        servers: [server("a", "offline"), server("b")],
        projects: [project("a", "p1")],
        chosenEnvironmentId: null,
      }),
    ).toBe("b");
    expect(
      pickDefaultServer({
        servers: [server("a", "offline"), server("b", "offline")],
        projects: [project("b", "p1")],
        chosenEnvironmentId: null,
      }),
    ).toBe("b");
  });

  it("returns null with nothing saved", () => {
    expect(pickDefaultServer({ servers: [], projects: [], chosenEnvironmentId: null })).toBeNull();
  });
});

describe("projectsOnServer", () => {
  it("lists only the chosen server's projects", () => {
    const projects = [project("a", "p1"), project("b", "p2"), project("a", "p3")];
    expect(projectsOnServer(projects, "a").map((entry) => entry.id)).toEqual(["p1", "p3"]);
  });
});

describe("hireBlockedReason", () => {
  it("allows a connected server", () => {
    expect(hireBlockedReason(server("a"))).toBeNull();
  });

  it("explains an offline server by name", () => {
    expect(hireBlockedReason(server("home", "reconnecting"))).toBe(
      "HOME is offline. Pick a connected server or reconnect in Settings → Servers.",
    );
  });
});

describe("setupCardFor", () => {
  const queuedAt = "2026-10-28T10:00:00.000Z";
  const start = Date.parse(queuedAt);

  it("shows nothing once the thread exists", () => {
    expect(
      setupCardFor({
        hasThread: true,
        server: null,
        queuedAt,
        since: start,
        now: start,
        failedReason: null,
      }),
    ).toEqual({ kind: "none" });
  });

  it("waits for an offline or removed server", () => {
    expect(
      setupCardFor({
        hasThread: false,
        server: server("home", "offline"),
        queuedAt,
        since: start,
        now: start + 5 * 60_000,
        failedReason: null,
      }),
    ).toEqual({ kind: "waiting", serverName: "HOME" });
    expect(
      setupCardFor({
        hasThread: false,
        server: null,
        queuedAt,
        since: start,
        now: start,
        failedReason: null,
      }).kind,
    ).toBe("waiting");
  });

  it("is starting on a connected server, then slow after the threshold", () => {
    const input = { hasThread: false, server: server("a"), queuedAt, failedReason: null };
    expect(setupCardFor({ ...input, since: start, now: start + SETUP_SLOW_MS - 1 }).kind).toBe(
      "starting",
    );
    expect(setupCardFor({ ...input, since: start, now: start + SETUP_SLOW_MS })).toEqual({
      kind: "slow",
      reason: null,
    });
  });

  it("restarts the wait when the chat opens or retries after the setup was queued", () => {
    const opened = start + 10 * 60_000;
    const input = { hasThread: false, server: server("a"), queuedAt, failedReason: null };
    expect(setupCardFor({ ...input, since: opened, now: opened + 5_000 }).kind).toBe("starting");
    expect(setupCardFor({ ...input, since: opened, now: opened + SETUP_SLOW_MS }).kind).toBe(
      "slow",
    );
  });

  it("treats a rejected setup as slow with its reason, whatever the server state", () => {
    expect(
      setupCardFor({
        hasThread: false,
        server: server("a", "offline"),
        queuedAt,
        since: start,
        now: start,
        failedReason: "Project not found",
      }),
    ).toEqual({ kind: "slow", reason: "Project not found" });
  });

  it("falls back to the watch start for an unreadable time", () => {
    const input = { hasThread: false, server: server("a"), queuedAt: "bad", failedReason: null };
    expect(setupCardFor({ ...input, since: start, now: start }).kind).toBe("starting");
    expect(setupCardFor({ ...input, since: start, now: start + SETUP_SLOW_MS }).kind).toBe("slow");
  });
});

describe("offlineSendNote", () => {
  it("says nothing while connected", () => {
    expect(offlineSendNote({ server: server("a"), pendingCount: 2 })).toBeNull();
  });

  it("mentions the queue when messages are waiting", () => {
    expect(offlineSendNote({ server: server("home", "offline"), pendingCount: 1 })).toBe(
      "Queued until HOME is online",
    );
    expect(offlineSendNote({ server: server("home", "offline"), pendingCount: 0 })).toBe(
      "HOME is offline. Messages send when it is back.",
    );
  });
});
