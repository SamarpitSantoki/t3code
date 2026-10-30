import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";

/** The parts of a saved server connection the bot screens read. */
export interface ServerSummary {
  readonly environmentId: string;
  readonly environmentLabel: string;
  readonly displayUrl: string;
  readonly isEnabled: boolean;
  readonly connectionState: EnvironmentConnectionPhase;
  readonly connectionError: string | null;
}

export type ServerTone = "connected" | "connecting" | "offline";

export function isServerConnected(server: ServerSummary | null | undefined): boolean {
  return !!server && server.isEnabled && server.connectionState === "connected";
}

/** Green when it can take work, amber while it tries, gray otherwise. */
export function serverTone(server: ServerSummary | null | undefined): ServerTone {
  if (!server || !server.isEnabled) return "offline";
  if (server.connectionState === "connected") return "connected";
  if (server.connectionState === "connecting" || server.connectionState === "reconnecting") {
    return "connecting";
  }
  return "offline";
}

export function serverStatusLabel(server: ServerSummary | null | undefined): string {
  if (!server) return "Removed";
  if (!server.isEnabled) return "Switched off";
  switch (server.connectionState) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "error":
      return "Error";
    case "unsupported":
      return "Needs an update";
    case "offline":
    case "available":
      return "Offline";
  }
}

export function serverName(server: ServerSummary | null | undefined): string {
  return server?.environmentLabel.trim() || "Your server";
}

interface ProjectLike {
  readonly environmentId: string;
}

/**
 * The server a new bot starts on: the chosen one if it still exists, else the first connected
 * server that has projects, else any connected server, else the first one with projects.
 */
export function pickDefaultServer<P extends ProjectLike>(input: {
  readonly servers: ReadonlyArray<ServerSummary>;
  readonly projects: ReadonlyArray<P>;
  readonly chosenEnvironmentId: string | null;
}): string | null {
  const { servers, projects, chosenEnvironmentId } = input;
  const hasProjects = (environmentId: string) =>
    projects.some((project) => project.environmentId === environmentId);
  if (
    chosenEnvironmentId !== null &&
    (servers.some((server) => server.environmentId === chosenEnvironmentId) ||
      hasProjects(chosenEnvironmentId))
  ) {
    return chosenEnvironmentId;
  }
  const connected = servers.filter(isServerConnected);
  return (
    connected.find((server) => hasProjects(server.environmentId))?.environmentId ??
    connected[0]?.environmentId ??
    servers.find((server) => hasProjects(server.environmentId))?.environmentId ??
    projects[0]?.environmentId ??
    servers[0]?.environmentId ??
    null
  );
}

export function projectsOnServer<P extends ProjectLike>(
  projects: ReadonlyArray<P>,
  environmentId: string | null,
): ReadonlyArray<P> {
  return environmentId === null
    ? projects
    : projects.filter((project) => project.environmentId === environmentId);
}

/** Why "Hire" is off for this server, or null when it can start a bot now. */
export function hireBlockedReason(server: ServerSummary | null | undefined): string | null {
  if (isServerConnected(server)) return null;
  return `${serverName(server)} is offline. Pick a connected server or reconnect in Settings → Servers.`;
}

/** A queued setup message older than this on a connected server counts as stuck. */
export const SETUP_SLOW_MS = 20_000;

export type SetupCard =
  | { readonly kind: "none" }
  | { readonly kind: "starting" }
  | { readonly kind: "waiting"; readonly serverName: string }
  | { readonly kind: "slow"; readonly reason: string | null };

/** What a chat shows while its thread has not reached the app yet. */
export function setupCardFor(input: {
  readonly hasThread: boolean;
  readonly server: ServerSummary | null | undefined;
  /** When the setup message was queued (ISO). */
  readonly queuedAt: string;
  /** When this screen started watching, or last retried; reopening a chat restarts the wait. */
  readonly since: number;
  readonly now: number;
  /** Set when the server rejected the setup message. */
  readonly failedReason: string | null;
}): SetupCard {
  if (input.hasThread) return { kind: "none" };
  if (input.failedReason !== null) return { kind: "slow", reason: input.failedReason };
  if (!isServerConnected(input.server)) {
    return { kind: "waiting", serverName: serverName(input.server) };
  }
  const queuedAt = Date.parse(input.queuedAt);
  const elapsed = input.now - Math.max(Number.isNaN(queuedAt) ? 0 : queuedAt, input.since);
  return elapsed >= SETUP_SLOW_MS ? { kind: "slow", reason: null } : { kind: "starting" };
}

/** The note above the composer when messages cannot reach the server yet. */
export function offlineSendNote(input: {
  readonly server: ServerSummary | null | undefined;
  readonly pendingCount: number;
}): string | null {
  if (isServerConnected(input.server)) return null;
  const name = serverName(input.server);
  return input.pendingCount > 0
    ? `Queued until ${name} is online`
    : `${name} is offline. Messages send when it is back.`;
}
