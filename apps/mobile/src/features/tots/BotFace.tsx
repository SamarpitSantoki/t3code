import Svg, { Circle, Line, Rect } from "react-native-svg";
import { View } from "react-native";

import { botIdentity } from "../bots/bot-identity";
import type { BotStatusKind } from "../bots/bot-status-model";
import type { Bot } from "../bots/bots-model";
import { botAccessory, type BotAccessory } from "./bot-face-model";

export type BotMood = "idle" | "working" | "waiting" | "error" | "setup";

export function moodForStatus(kind: BotStatusKind | undefined): BotMood {
  switch (kind) {
    case "working":
      return "working";
    case "needs_you":
      return "waiting";
    case "error":
      return "error";
    case "setting_up":
      return "setup";
    default:
      return "idle";
  }
}

const RING = "#F2A93B";

/**
 * One character system: the same rounded body and eyes for every bot, told apart by colour and
 * accessory. The eyes carry status, so the roster reads without text.
 */
export function BotFace(props: {
  readonly bot: Pick<Bot, "id" | "color" | "emoji"> & { readonly accessory?: string };
  readonly size?: number;
  readonly mood?: BotMood;
}) {
  const size = props.size ?? 44;
  const mood = props.mood ?? "idle";
  const { color } = botIdentity(props.bot);
  const accessory = botAccessory(props.bot);
  const body = mood === "setup" ? "#B8B8BD" : color;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="-2 -2 52 52">
        {mood === "waiting" ? (
          <Rect
            x={1}
            y={5}
            width={46}
            height={42}
            rx={17}
            fill="none"
            stroke={RING}
            strokeWidth={2.5}
          />
        ) : null}
        <Accessory kind={accessory} color={body} />
        <Rect x={5} y={8} width={38} height={36} rx={14} fill={body} />
        <Eyes mood={mood} />
        <FaceAccessory kind={accessory} />
        {mood === "error" ? (
          <Rect
            x={19}
            y={34}
            width={10}
            height={2.6}
            rx={1.3}
            fill="#fff"
            opacity={0.8}
            transform="rotate(-8 24 35)"
          />
        ) : (
          <Rect x={20} y={33} width={8} height={2.6} rx={1.3} fill="#fff" opacity={0.8} />
        )}
      </Svg>
    </View>
  );
}

function Eyes(props: { readonly mood: BotMood }) {
  switch (props.mood) {
    case "working":
      return (
        <>
          <Circle cx={16} cy={21} r={4.2} fill="#fff" />
          <Circle cx={32} cy={21} r={4.2} fill="#fff" />
          <Circle cx={18} cy={21} r={2.2} fill="#111" />
          <Circle cx={34} cy={21} r={2.2} fill="#111" />
        </>
      );
    case "waiting":
      return (
        <>
          <Circle cx={16} cy={21} r={4.6} fill="#fff" />
          <Circle cx={32} cy={21} r={4.6} fill="#fff" />
          <Circle cx={16} cy={19.5} r={2.3} fill="#111" />
          <Circle cx={32} cy={19.5} r={2.3} fill="#111" />
        </>
      );
    case "error":
      return (
        <>
          <Line
            x1={12.5}
            y1={18}
            x2={19.5}
            y2={24}
            stroke="#fff"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Line
            x1={19.5}
            y1={18}
            x2={12.5}
            y2={24}
            stroke="#fff"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Line
            x1={28.5}
            y1={18}
            x2={35.5}
            y2={24}
            stroke="#fff"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Line
            x1={35.5}
            y1={18}
            x2={28.5}
            y2={24}
            stroke="#fff"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </>
      );
    default:
      return (
        <>
          <Rect x={11.5} y={20} width={9} height={3.2} rx={1.6} fill="#fff" />
          <Rect x={27.5} y={20} width={9} height={3.2} rx={1.6} fill="#fff" />
        </>
      );
  }
}

function Accessory(props: { readonly kind: BotAccessory; readonly color: string }) {
  switch (props.kind) {
    case "antenna":
      return (
        <>
          <Line
            x1={24}
            y1={6}
            x2={24}
            y2={1.5}
            stroke={props.color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Circle cx={24} cy={1.8} r={2.2} fill={props.color} />
        </>
      );
    case "ears":
      return (
        <>
          <Circle cx={6} cy={24} r={3.5} fill={props.color} />
          <Circle cx={42} cy={24} r={3.5} fill={props.color} />
        </>
      );
    case "horns":
      return (
        <>
          <Rect
            x={11}
            y={3}
            width={5}
            height={9}
            rx={2.5}
            fill={props.color}
            transform="rotate(-20 13.5 7.5)"
          />
          <Rect
            x={32}
            y={3}
            width={5}
            height={9}
            rx={2.5}
            fill={props.color}
            transform="rotate(20 34.5 7.5)"
          />
        </>
      );
    default:
      return null;
  }
}

/** Glasses and headbands sit on the face, so they draw after the eyes. */
function FaceAccessory(props: { readonly kind: BotAccessory }) {
  switch (props.kind) {
    case "glasses":
      return (
        <>
          <Rect
            x={9}
            y={15.5}
            width={14}
            height={11}
            rx={5}
            fill="none"
            stroke="#111"
            strokeWidth={1.6}
          />
          <Rect
            x={25}
            y={15.5}
            width={14}
            height={11}
            rx={5}
            fill="none"
            stroke="#111"
            strokeWidth={1.6}
          />
          <Line x1={23} y1={21} x2={25} y2={21} stroke="#111" strokeWidth={1.6} />
        </>
      );
    case "band":
      return <Rect x={6} y={9} width={36} height={5} rx={2.5} fill="#111" opacity={0.85} />;
    default:
      return null;
  }
}

export function BotFaceStack(props: {
  readonly bots: ReadonlyArray<Pick<Bot, "id" | "color" | "emoji">>;
  readonly size?: number;
  readonly max?: number;
}) {
  const size = props.size ?? 30;
  const shown = props.bots.slice(0, props.max ?? 4);
  return (
    <View style={{ flexDirection: "row" }}>
      {shown.map((bot, index) => (
        <View key={bot.id} style={{ marginLeft: index === 0 ? 0 : -size * 0.32 }}>
          <BotFace bot={bot} size={size} />
        </View>
      ))}
    </View>
  );
}
