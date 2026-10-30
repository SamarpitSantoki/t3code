import type { BotRegistry } from "../bots/bots-model";

export interface BotProfilePatch {
  readonly name: string;
  readonly role: string;
  readonly color: string;
  readonly accessory: string;
}

export function updateBotProfile(
  registry: BotRegistry,
  botId: string,
  patch: BotProfilePatch,
): BotRegistry {
  return {
    ...registry,
    bots: registry.bots.map((bot) =>
      bot.id === botId
        ? {
            ...bot,
            name: patch.name.trim(),
            role: patch.role.trim(),
            color: patch.color,
            accessory: patch.accessory,
          }
        : bot,
    ),
  };
}

export function botNameTaken(registry: BotRegistry, name: string, exceptBotId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return registry.bots.some(
    (bot) => bot.id !== exceptBotId && bot.name.trim().toLowerCase() === wanted,
  );
}

/** A saved role only shapes new threads; this tells the running chat about it. */
export function buildRoleChangeMessage(input: {
  readonly previousName: string;
  readonly name: string;
  readonly role: string;
}) {
  const name = input.name.trim();
  return [
    input.previousName.trim() === name
      ? "Your job has changed."
      : `Your name is now ${name}, and your job has changed.`,
    "",
    "Your new role:",
    input.role.trim(),
    "",
    `Use this role for every later message. Reply with one short sentence that confirms you are ready as ${name}.`,
  ].join("\n");
}
