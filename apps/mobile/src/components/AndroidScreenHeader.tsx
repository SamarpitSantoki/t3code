import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { SymbolView, type AppSymbolName } from "./AppSymbol";
import { AppText as Text } from "./AppText";
import { cn } from "../lib/cn";
import { themeColorWithAlpha } from "../lib/mobileTheme";
import { useAppearancePreferences } from "../features/settings/appearance/AppearancePreferencesProvider";
import { AndroidAnchoredMenu } from "./AndroidAnchoredMenu";
import { GlassSurface } from "./GlassSurface";
import { useScaledTextRole } from "../features/settings/appearance/useScaledTextRole";
import { useMaterialToolbarLayout } from "./useMaterialToolbarLayout";

export interface AndroidHeaderAction {
  readonly accessibilityLabel: string;
  readonly icon: AppSymbolName;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly selected?: boolean;
}

const HEADER_CONTROL_SIZE = 48;
const HEADER_ICON_SIZE = 22;

/** Round header control; group several inside `AndroidHeaderGlass` to match iOS bar items. */
export function AndroidHeaderIconButton(props: {
  readonly accessibilityLabel: string;
  readonly icon: AppSymbolName;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly selected?: boolean;
}) {
  const { themeVariables } = useAppearancePreferences();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(props.disabled), selected: props.selected }}
      android_ripple={{
        color: themeColorWithAlpha(themeVariables["--color-header-foreground"], 0.1),
        borderless: true,
        radius: HEADER_CONTROL_SIZE / 2,
      }}
      className={cn(
        "items-center justify-center rounded-full",
        props.selected && "bg-subtle-strong",
      )}
      style={{ width: HEADER_CONTROL_SIZE, height: HEADER_CONTROL_SIZE }}
    >
      <SymbolView
        // Shared screens pass the iOS overflow glyph; Android header overflow is vertical.
        name={props.icon === "ellipsis" ? { ios: "ellipsis", android: "more_vert" } : props.icon}
        size={HEADER_ICON_SIZE}
        tintColorClassName={
          props.disabled
            ? "accent-icon-subtle"
            : props.selected
              ? "accent-focus"
              : "accent-header-foreground"
        }
      />
    </Pressable>
  );
}

/** Frosted capsule behind header controls, the Android stand-in for iOS glass bar items. */
export function AndroidHeaderGlass(props: { readonly children: ReactNode }) {
  return (
    <GlassSurface
      className="flex-row items-center"
      style={{ minWidth: HEADER_CONTROL_SIZE, minHeight: HEADER_CONTROL_SIZE, borderRadius: 24 }}
    >
      {props.children}
    </GlassSurface>
  );
}

export function AndroidScreenHeader(props: {
  readonly title: string;
  readonly titleContent?: ReactNode;
  readonly subtitle?: string | null;
  readonly actions?: ReadonlyArray<AndroidHeaderAction>;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onBack?: () => void;
  readonly embedded?: boolean;
}) {
  const titleTypography = useScaledTextRole("headline");
  const subtitleTypography = useScaledTextRole("label");
  const { height: materialToolbarHeight, ...headerPadding } = useMaterialToolbarLayout(
    props.embedded,
  );
  const [headerWidth, setHeaderWidth] = useState(0);
  const actions = props.actions ?? [];
  const directCount = actions.length > 2 ? (headerWidth >= 600 ? 3 : 1) : actions.length;
  const visibleActions = actions.slice(0, directCount);
  const overflowActions = actions.slice(directCount);
  const hasControls = actions.length > 0 || props.trailing != null;

  return (
    <View
      onLayout={(event) => setHeaderWidth(event.nativeEvent.layout.width)}
      className="bg-header px-3"
      style={headerPadding}
    >
      <View style={{ minHeight: materialToolbarHeight }} className="flex-row items-center gap-2">
        {props.onBack ? (
          <AndroidHeaderGlass>
            <AndroidHeaderIconButton
              accessibilityLabel="Navigate up"
              icon="arrow.left"
              onPress={props.onBack}
            />
          </AndroidHeaderGlass>
        ) : null}

        {props.leading}

        <View className={cn("min-w-0 flex-1", !props.onBack && "pl-2")}>
          {props.titleContent ?? (
            <Text
              numberOfLines={1}
              style={titleTypography}
              className="font-t3-bold text-header-foreground"
            >
              {props.title}
            </Text>
          )}
          {props.subtitle ? (
            <Text
              numberOfLines={1}
              style={subtitleTypography}
              className="text-[13px] text-foreground-muted"
            >
              {props.subtitle}
            </Text>
          ) : null}
        </View>

        {hasControls ? (
          <AndroidHeaderGlass>
            {visibleActions.map((action) =>
              action.loading ? (
                <View
                  key={action.accessibilityLabel}
                  accessibilityLabel={action.accessibilityLabel}
                  className="items-center justify-center"
                  style={{ width: HEADER_CONTROL_SIZE, height: HEADER_CONTROL_SIZE }}
                >
                  <ActivityIndicator colorClassName="accent-header-foreground" />
                </View>
              ) : (
                <AndroidHeaderIconButton
                  key={action.accessibilityLabel}
                  accessibilityLabel={action.accessibilityLabel}
                  disabled={action.disabled}
                  selected={action.selected}
                  icon={action.icon}
                  onPress={action.onPress}
                />
              ),
            )}
            {overflowActions.length > 0 ? (
              <AndroidAnchoredMenu
                actions={overflowActions.map((action, index) => ({
                  id: String(index),
                  title: action.accessibilityLabel,
                  attributes: {
                    disabled: Boolean(action.disabled),
                    state: action.selected ? "on" : undefined,
                  },
                }))}
                onPressAction={({ nativeEvent }) =>
                  overflowActions[Number(nativeEvent.event)]?.onPress()
                }
              >
                {(open) => (
                  <AndroidHeaderIconButton
                    accessibilityLabel="More actions"
                    icon={{ ios: "ellipsis", android: "more_vert" }}
                    onPress={open}
                  />
                )}
              </AndroidAnchoredMenu>
            ) : null}
            {props.trailing}
          </AndroidHeaderGlass>
        ) : null}
      </View>
    </View>
  );
}

export function AndroidSheetHeader(
  props: Omit<Parameters<typeof AndroidScreenHeader>[0], "embedded">,
) {
  return <AndroidScreenHeader {...props} embedded />;
}
