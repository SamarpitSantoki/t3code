import * as Haptics from "expo-haptics";
import { useRef, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { SymbolView, type AppSymbolName } from "../../components/ui/AppSymbol";
import { useTotsColors, type TotsColors } from "./theme";
import { TotsText } from "./ui";

export interface ChatSwipeAction {
  readonly id: string;
  readonly label: string;
  readonly icon: AppSymbolName;
  readonly tone: "blue" | "amber" | "ink" | "green" | "red";
  readonly onPress: () => void;
}

const ACTION_WIDTH = 64;
// A clearly sideways pan is a swipe; anything else scrolls the list.
const FAIL_OFFSET_Y: [number, number] = [-10, 10];

function toneColor(colors: TotsColors, tone: ChatSwipeAction["tone"]) {
  return {
    blue: colors.blue,
    amber: colors.amber,
    ink: colors.inkSoft,
    green: colors.green,
    red: colors.red,
  }[tone];
}

/** A chat row with actions on both sides: swipe right for `left`, left for `right`. */
export function ChatSwipeRow(props: {
  readonly left: ReadonlyArray<ChatSwipeAction>;
  readonly right: ReadonlyArray<ChatSwipeAction>;
  /** Called as the row opens, so the list can close the row opened before. */
  readonly onOpen: (methods: SwipeableMethods) => void;
  readonly children: ReactNode;
}) {
  const colors = useTotsColors();
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const renderActions = (actions: ReadonlyArray<ChatSwipeAction>) =>
    actions.length === 0 ? null : (
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        {actions.map((action) => (
          <SwipeActionButton
            key={action.id}
            action={action}
            color={toneColor(colors, action.tone)}
            onPress={() => {
              swipeableRef.current?.close();
              void Haptics.selectionAsync();
              action.onPress();
            }}
          />
        ))}
      </View>
    );
  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      failOffsetY={FAIL_OFFSET_Y}
      enabled={props.left.length + props.right.length > 0}
      containerStyle={{ backgroundColor: colors.bg }}
      childrenContainerStyle={{ backgroundColor: colors.bg }}
      onSwipeableWillOpen={() => {
        if (swipeableRef.current) props.onOpen(swipeableRef.current);
      }}
      renderLeftActions={props.left.length > 0 ? () => renderActions(props.left) : undefined}
      renderRightActions={props.right.length > 0 ? () => renderActions(props.right) : undefined}
    >
      {props.children}
    </ReanimatedSwipeable>
  );
}

function SwipeActionButton(props: {
  readonly action: ChatSwipeAction;
  readonly color: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.action.label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: ACTION_WIDTH,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: props.color,
        }}
      >
        <SymbolView name={props.action.icon} size={15} tintColor="#FFFFFF" />
      </View>
      <TotsText variant="small" tone="muted" numberOfLines={1} style={{ fontSize: 11 }}>
        {props.action.label}
      </TotsText>
    </Pressable>
  );
}
