import { requireNativeView } from "expo";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { androidWorkspaceNavigationState } from "../../lib/android-workspace-navigation";
import {
  Keyboard,
  processColor,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAndroidControlSizing } from "../../components/useAndroidControlSizing";
import { androidWorkspaceNavigationColors } from "./android-workspace-navigation-colors";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { useWorkspaceTabs } from "./WorkspaceTabsContext";
import type { WorkspaceTab } from "./workspace-tabs-state";

export const ANDROID_WORKSPACE_RAIL_WIDTH = 80;

interface NativeNavigationProps extends ViewProps {
  readonly rail: boolean;
  readonly selectedTab: WorkspaceTab;
  readonly dark: boolean;
  readonly textScale: number;
  readonly containerColor: number;
  readonly selectedColor: number;
  readonly indicatorColor: number;
  readonly unselectedColor: number;
  readonly onTabSelected: (event: NativeSyntheticEvent<{ readonly tab: WorkspaceTab }>) => void;
}

const NativeNavigation = requireNativeView<NativeNavigationProps>("T3WorkspaceNavigation");

function nativeColor(value: string) {
  const color = processColor(value);
  return typeof color === "number" ? color : 0;
}

export function AndroidWorkspaceNavigation(props: { readonly onSelect?: () => void }) {
  const workspace = useWorkspaceTabs()!;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance, themeVariables: colors } = useAppearancePreferences();
  const { scale } = useAndroidControlSizing();
  const { containerColor, indicatorColor, selectedColor, unselectedColor } =
    androidWorkspaceNavigationColors(colors, true);

  return (
    <View
      style={{
        backgroundColor: containerColor,
        flex: 1,
        width: ANDROID_WORKSPACE_RAIL_WIDTH * Math.max(1, scale),
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <NativeNavigation
        rail
        selectedTab={workspace.state.selectedTab}
        dark={themeAppearance === "dark"}
        textScale={scale}
        containerColor={nativeColor(containerColor)}
        selectedColor={nativeColor(selectedColor)}
        indicatorColor={nativeColor(indicatorColor)}
        unselectedColor={nativeColor(unselectedColor)}
        onTabSelected={(event) => {
          Keyboard.dismiss();
          const tab = event.nativeEvent.tab;
          if (tab !== workspace.state.selectedTab) {
            workspace.dispatch({ type: "select", tab });
            navigation.dispatch((state) =>
              CommonActions.reset(androidWorkspaceNavigationState(state)),
            );
          }
          props.onSelect?.();
        }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
