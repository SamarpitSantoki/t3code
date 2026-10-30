export const BOT_ACCESSORIES = ["antenna", "glasses", "band", "ears", "horns", "none"] as const;
export type BotAccessory = (typeof BOT_ACCESSORIES)[number];

function isAccessory(value: string | undefined): value is BotAccessory {
  return BOT_ACCESSORIES.some((accessory) => accessory === value);
}

function hash(value: string) {
  let result = 7;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 33 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result);
}

/** Bots saved before accessories existed get a stable one from their id. */
export function botAccessory(bot: {
  readonly id: string;
  readonly accessory?: string;
}): BotAccessory {
  return isAccessory(bot.accessory)
    ? bot.accessory
    : BOT_ACCESSORIES[hash(bot.id) % BOT_ACCESSORIES.length]!;
}
