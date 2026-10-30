/** Bots start every message they send to another bot with this header, so the app can show who talked. */
const AGENT_MESSAGE_HEADER = /^From (.+?) \(thread ([^)\s]+)\)(?:, [^:\n]*)?:[ \t]*\n?/;

export interface AgentMessage {
  readonly fromName: string;
  readonly fromThreadId: string;
  readonly body: string;
}

export function formatAgentMessageHeader(input: {
  readonly name: string;
  readonly threadId: string;
}) {
  return `From ${input.name} (thread ${input.threadId}):`;
}

/** The sender of a bot-to-bot message, or null when a person wrote it. */
export function parseAgentMessage(text: string): AgentMessage | null {
  const match = AGENT_MESSAGE_HEADER.exec(text);
  if (match === null) return null;
  return {
    fromName: match[1]!.trim(),
    fromThreadId: match[2]!,
    body: text.slice(match[0].length).trim(),
  };
}
