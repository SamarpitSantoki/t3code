import { Text, View } from "react-native";

import { botIdentity, tint } from "./bot-identity";
import { BOT_STATUS_COLORS, type BotStatusKind } from "./bot-status";
import type { Bot } from "./bots-model";

export function BotAvatar(props: {
  readonly bot: Pick<Bot, "id" | "emoji" | "color">;
  readonly size?: number;
  readonly status?: BotStatusKind;
  /** Draws a ring in the screen colour so stacked avatars separate. */
  readonly ringClassName?: string;
}) {
  const size = props.size ?? 44;
  const { emoji, color } = botIdentity(props.bot);
  const dot = Math.max(10, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      <View
        className={props.ringClassName}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.34,
          backgroundColor: tint(color, 0.18),
          borderWidth: 1.5,
          borderColor: tint(color, 0.45),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</Text>
      </View>
      {props.status ? (
        <View
          className="border-screen"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: 2,
            backgroundColor: BOT_STATUS_COLORS[props.status],
          }}
        />
      ) : null}
    </View>
  );
}

export function BotAvatarStack(props: {
  readonly bots: ReadonlyArray<Pick<Bot, "id" | "emoji" | "color">>;
  readonly size?: number;
  readonly max?: number;
}) {
  const size = props.size ?? 32;
  const max = props.max ?? 4;
  const shown = props.bots.slice(0, max);
  const extra = props.bots.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((bot, index) => (
        <View
          key={bot.id}
          style={{ marginLeft: index === 0 ? 0 : -size * 0.3, zIndex: max - index }}
        >
          <BotAvatar bot={bot} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          className="items-center justify-center bg-subtle-strong"
          style={{
            marginLeft: -size * 0.3,
            width: size,
            height: size,
            borderRadius: size * 0.34,
          }}
        >
          <Text className="font-t3-bold text-xs text-foreground">+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}
