import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { useTotsColors } from "./theme";

export type TotsTab = "chats" | "team" | "scheduled";

/** Bar height above the bottom safe area. */
export const TOTS_TAB_BAR_HEIGHT = 56;

const TABS: ReadonlyArray<{ readonly id: TotsTab; readonly label: string }> = [
  { id: "chats", label: "Chats" },
  { id: "team", label: "Team" },
  { id: "scheduled", label: "Scheduled" },
];

export function TotsTabBar(props: {
  readonly selected: TotsTab;
  readonly onSelect: (tab: TotsTab) => void;
  readonly needsYou: boolean;
}) {
  const colors = useTotsColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        height: TOTS_TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {TABS.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab.id}
          label={tab.label}
          selected={props.selected === tab.id}
          badge={props.needsYou && tab.id !== "scheduled"}
          onPress={() => {
            if (props.selected === tab.id) return;
            void Haptics.selectionAsync();
            props.onSelect(tab.id);
          }}
        />
      ))}
    </View>
  );
}

function TabItem(props: {
  readonly tab: TotsTab;
  readonly label: string;
  readonly selected: boolean;
  readonly badge: boolean;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  const color = props.selected ? colors.ink : colors.muted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.badge ? `${props.label}, needs you` : props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View>
        <TabIcon tab={props.tab} color={color} />
        {props.badge ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: colors.amber,
              borderWidth: 1.5,
              borderColor: colors.card,
            }}
          />
        ) : null}
      </View>
      <Text style={{ color, fontSize: 11, fontWeight: props.selected ? "600" : "500" }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function TabIcon(props: { readonly tab: TotsTab; readonly color: string }) {
  const stroke = {
    stroke: props.color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {props.tab === "chats" ? (
        <Path
          d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.5v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
          {...stroke}
        />
      ) : props.tab === "team" ? (
        <>
          <Rect x={3} y={4} width={8} height={7} rx={2.5} {...stroke} />
          <Rect x={13} y={4} width={8} height={7} rx={2.5} {...stroke} />
          <Rect x={3} y={13} width={8} height={7} rx={2.5} {...stroke} />
          <Rect x={13} y={13} width={8} height={7} rx={2.5} {...stroke} />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} />
        </>
      )}
    </Svg>
  );
}
