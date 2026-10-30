import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../../native/native-glass";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { ScreenScrollView } from "../../components/ui/ScreenScrollView";
import { BOT_COLORS } from "../bots/bot-identity";
import { BotFace } from "./BotFace";
import { BOT_ACCESSORIES } from "./bot-face-model";
import { TOTS_RADIUS, useTotsColors } from "./theme";
import { TotsGlyph, TotsText } from "./ui";

/** Paints the native header and screen in Tots colours. */
export function TotsScreenOptions(props: { readonly title?: string }) {
  const colors = useTotsColors();
  return (
    <NativeStackScreenOptions
      optionsVersion={[colors.bg, props.title]}
      options={{
        ...(props.title === undefined ? {} : { title: props.title }),
        contentStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontSize: 17, fontWeight: "700", color: colors.ink },
        ...(NATIVE_LIQUID_GLASS_SUPPORTED ? {} : { headerStyle: { backgroundColor: colors.bg } }),
      }}
    />
  );
}

export function TotsSegmented<T extends string>(props: {
  readonly options: ReadonlyArray<{ readonly id: T; readonly label: string }>;
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
}) {
  const colors = useTotsColors();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 6 }}>
      {props.options.map((option) => {
        const selected = option.id === props.value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: Boolean(props.disabled) }}
            disabled={props.disabled}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              props.onChange(option.id);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              backgroundColor: selected ? colors.primary : colors.sunken,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <TotsText variant="label" tone={selected ? "onPrimary" : "inkSoft"} numberOfLines={1}>
              {option.label}
            </TotsText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TotsField(
  props: {
    readonly label?: string;
    readonly hint?: string;
    readonly large?: boolean;
  } & Pick<
    TextInputProps,
    | "value"
    | "onChangeText"
    | "placeholder"
    | "multiline"
    | "editable"
    | "autoCapitalize"
    | "maxLength"
    | "returnKeyType"
  >,
) {
  const colors = useTotsColors();
  return (
    <View style={{ gap: 6 }}>
      {props.label ? (
        <TotsText variant="label" tone="inkSoft" style={{ paddingHorizontal: 6 }}>
          {props.label}
        </TotsText>
      ) : null}
      <TextInput
        accessibilityLabel={props.label ?? props.placeholder}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={props.multiline}
        editable={props.editable}
        autoCapitalize={props.autoCapitalize}
        maxLength={props.maxLength}
        returnKeyType={props.returnKeyType}
        textAlignVertical={props.multiline ? "top" : "center"}
        style={{
          backgroundColor: colors.card,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: props.multiline ? 12 : 0,
          minHeight: props.multiline ? 112 : 50,
          color: colors.ink,
          fontSize: props.large ? 18 : 15,
          fontWeight: props.large ? "600" : "400",
          lineHeight: props.multiline ? 21 : undefined,
        }}
      />
      {props.hint ? (
        <TotsText variant="small" tone="muted" style={{ paddingHorizontal: 6 }}>
          {props.hint}
        </TotsText>
      ) : null}
    </View>
  );
}

export function TotsStepper(props: {
  readonly label: string;
  readonly value: string;
  readonly onStep: (direction: 1 | -1) => void;
  readonly canDecrease: boolean;
  readonly canIncrease: boolean;
}) {
  const colors = useTotsColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.card,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 8,
        minHeight: 54,
      }}
    >
      <StepButton
        glyph="−"
        label={`Shorter ${props.label}`}
        disabled={!props.canDecrease}
        onPress={() => props.onStep(-1)}
      />
      <TotsText variant="heading" style={{ flex: 1, textAlign: "center" }}>
        {props.value}
      </TotsText>
      <StepButton
        glyph="+"
        label={`Longer ${props.label}`}
        disabled={!props.canIncrease}
        onPress={() => props.onStep(1)}
      />
    </View>
  );
}

function StepButton(props: {
  readonly glyph: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      hitSlop={6}
      onPress={() => {
        void Haptics.selectionAsync();
        props.onPress();
      }}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.sunken,
        opacity: props.disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <TotsGlyph>{props.glyph}</TotsGlyph>
    </Pressable>
  );
}

/** Form screen: scrolling content with a sticky footer that stays above the keyboard. */
export function TotsFormScreen(props: {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly gap?: number;
}) {
  const colors = useTotsColors();
  return (
    <KeyboardAvoidingView
      automaticOffset
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScreenScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ gap: props.gap ?? 22, paddingTop: 16, paddingBottom: 32 }}
      >
        {props.children}
      </ScreenScrollView>
      {props.footer ? <TotsFooter>{props.footer}</TotsFooter> : null}
    </KeyboardAvoidingView>
  );
}

function TotsFooter(props: { readonly children: ReactNode }) {
  const colors = useTotsColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        gap: 10,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12) + 4,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {props.children}
    </View>
  );
}

const ACCESSORY_LABELS: Readonly<Record<(typeof BOT_ACCESSORIES)[number], string>> = {
  antenna: "Antenna",
  glasses: "Glasses",
  band: "Headband",
  ears: "Ears",
  horns: "Horns",
  none: "Plain",
};

/** Colour swatches and accessory faces; the faces preview the chosen colour. */
export function TotsLookPicker(props: {
  readonly color: string;
  readonly accessory: string;
  readonly onColor: (color: string) => void;
  readonly onAccessory: (accessory: string) => void;
  readonly disabled?: boolean;
}) {
  const colors = useTotsColors();
  return (
    <View style={{ gap: 14 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
      >
        {BOT_ACCESSORIES.map((accessory) => {
          const selected = accessory === props.accessory;
          return (
            <Pressable
              key={accessory}
              accessibilityRole="radio"
              accessibilityLabel={ACCESSORY_LABELS[accessory]}
              accessibilityState={{ checked: selected, disabled: Boolean(props.disabled) }}
              disabled={props.disabled}
              onPress={() => {
                void Haptics.selectionAsync();
                props.onAccessory(accessory);
              }}
              style={({ pressed }) => ({
                alignItems: "center",
                gap: 4,
                paddingVertical: 8,
                paddingHorizontal: 6,
                width: 72,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor: selected ? colors.ink : colors.line,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <BotFace bot={{ id: accessory, color: props.color, accessory }} size={40} />
              <TotsText variant="small" tone={selected ? "ink" : "muted"} numberOfLines={1}>
                {ACCESSORY_LABELS[accessory]}
              </TotsText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20 }}>
        {BOT_COLORS.map((color) => {
          const selected = color === props.color;
          return (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${color}`}
              accessibilityState={{ checked: selected, disabled: Boolean(props.disabled) }}
              disabled={props.disabled}
              hitSlop={4}
              onPress={() => {
                void Haptics.selectionAsync();
                props.onColor(color);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: TOTS_RADIUS.pill,
                backgroundColor: color,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: selected ? colors.ink : "transparent",
              }}
            >
              {selected ? (
                <TotsText variant="label" style={{ color: "#FFFFFF" }}>
                  ✓
                </TotsText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A titled block; `flush` lets horizontal scrollers run to the screen edge. */
export function TotsFormSection(props: {
  readonly title: string;
  readonly hint?: string;
  readonly flush?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ paddingHorizontal: 20, gap: 2 }}>
        <TotsText variant="caps" tone="muted" style={{ paddingHorizontal: 6 }}>
          {props.title.toUpperCase()}
        </TotsText>
        {props.hint ? (
          <TotsText variant="small" tone="muted" style={{ paddingHorizontal: 6 }}>
            {props.hint}
          </TotsText>
        ) : null}
      </View>
      {props.flush ? (
        props.children
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>{props.children}</View>
      )}
    </View>
  );
}

export function TotsMessageScreen(props: { readonly title: string; readonly detail?: string }) {
  const colors = useTotsColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: 32,
        backgroundColor: colors.bg,
      }}
    >
      <TotsText variant="heading">{props.title}</TotsText>
      {props.detail ? (
        <TotsText tone="muted" style={{ textAlign: "center" }}>
          {props.detail}
        </TotsText>
      ) : null}
    </View>
  );
}
