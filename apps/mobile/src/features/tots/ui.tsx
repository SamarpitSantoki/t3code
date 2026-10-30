import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { TOTS_FONT, TOTS_RADIUS, useTotsColors } from "./theme";

export function TotsText(props: {
  readonly children: ReactNode;
  readonly variant?: keyof typeof TOTS_FONT;
  readonly tone?: "ink" | "muted" | "inkSoft" | "blue" | "amber" | "red" | "onPrimary";
  readonly numberOfLines?: number;
  readonly selectable?: boolean;
  readonly style?: StyleProp<TextStyle>;
}) {
  const colors = useTotsColors();
  const color = {
    ink: colors.ink,
    muted: colors.muted,
    inkSoft: colors.inkSoft,
    blue: colors.blue,
    amber: colors.amberText,
    red: colors.red,
    onPrimary: colors.onPrimary,
  }[props.tone ?? "ink"];
  return (
    <Text
      numberOfLines={props.numberOfLines}
      selectable={props.selectable}
      style={[TOTS_FONT[props.variant ?? "body"], { color }, props.style]}
    >
      {props.children}
    </Text>
  );
}

export function TotsButton(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly kind?: "dark" | "light" | "danger" | "ghost";
  readonly size?: "small" | "medium" | "large";
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly grow?: boolean;
  readonly icon?: ReactNode;
  readonly accessibilityLabel?: string;
}) {
  const colors = useTotsColors();
  const kind = props.kind ?? "dark";
  const size = props.size ?? "medium";
  const background = {
    dark: colors.primary,
    light: colors.card,
    danger: colors.redSoft,
    ghost: "transparent",
  }[kind];
  const foreground = {
    dark: colors.onPrimary,
    light: colors.ink,
    danger: colors.red,
    ghost: colors.blue,
  }[kind];
  const disabled = props.disabled || props.loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(props.loading) }}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        props.onPress();
      }}
      style={({ pressed }) => ({
        flexGrow: props.grow ? 1 : 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: background,
        borderRadius: TOTS_RADIUS.pill,
        borderWidth: kind === "light" ? 1 : 0,
        borderColor: colors.line,
        paddingHorizontal: size === "small" ? 12 : size === "large" ? 22 : 16,
        minHeight: size === "small" ? 32 : size === "large" ? 50 : 40,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {props.loading ? <ActivityIndicator size="small" color={foreground} /> : props.icon}
      <Text
        style={{
          color: foreground,
          fontWeight: "600",
          fontSize: size === "small" ? 13 : size === "large" ? 16 : 14,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function TotsCard(props: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly tone?: "card" | "sunken" | "amber" | "blue";
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  readonly accessibilityLabel?: string;
}) {
  const colors = useTotsColors();
  const tone = props.tone ?? "card";
  const style: ViewStyle = {
    backgroundColor: {
      card: colors.card,
      sunken: colors.sunken,
      amber: colors.amberSoft,
      blue: colors.blueSoft,
    }[tone],
    borderRadius: TOTS_RADIUS.card,
    borderWidth: tone === "amber" ? 1 : tone === "card" ? 1 : 0,
    borderColor: tone === "amber" ? colors.amberLine : colors.line,
    padding: 14,
  };
  if (!props.onPress && !props.onLongPress) {
    return <View style={[style, props.style]}>{props.children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => [style, props.style, { opacity: pressed ? 0.8 : 1 }]}
    >
      {props.children}
    </Pressable>
  );
}

export function TotsSectionLabel(props: {
  readonly children: string;
  readonly trailing?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 6,
        marginTop: 10,
        marginBottom: 6,
      }}
    >
      <TotsText variant="caps" tone="muted">
        {props.children.toUpperCase()}
      </TotsText>
      {props.trailing}
    </View>
  );
}

export function TotsToggle(props: {
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
}) {
  const colors = useTotsColors();
  return (
    <Switch
      accessibilityLabel={props.accessibilityLabel}
      value={props.value}
      disabled={props.disabled}
      onValueChange={(value) => {
        void Haptics.selectionAsync();
        props.onChange(value);
      }}
      trackColor={{ false: colors.toggleOff, true: colors.green }}
      thumbColor="#FFFFFF"
    />
  );
}

/** Round icon button; pass a glyph or a small view as the child. */
export function TotsIconButton(props: {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly kind?: "dark" | "soft" | "plain";
  readonly size?: number;
  readonly disabled?: boolean;
}) {
  const colors = useTotsColors();
  const size = props.size ?? 36;
  const kind = props.kind ?? "soft";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: Boolean(props.disabled) }}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          kind === "dark" ? colors.primary : kind === "soft" ? colors.sunken : "transparent",
        opacity: props.disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      {props.children}
    </Pressable>
  );
}

export function TotsGlyph(props: {
  readonly children: string;
  readonly size?: number;
  readonly tone?: "ink" | "onPrimary" | "muted" | "blue";
}) {
  const colors = useTotsColors();
  const color = {
    ink: colors.ink,
    onPrimary: colors.onPrimary,
    muted: colors.muted,
    blue: colors.blue,
  }[props.tone ?? "ink"];
  return (
    <Text
      style={{
        color,
        fontSize: props.size ?? 18,
        fontWeight: "600",
        lineHeight: (props.size ?? 18) * 1.15,
      }}
    >
      {props.children}
    </Text>
  );
}
