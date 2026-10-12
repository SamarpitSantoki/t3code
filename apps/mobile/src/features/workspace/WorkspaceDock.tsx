import { CommonActions, useNavigation } from "@react-navigation/native";
import { Keyboard, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { SymbolView, type AppSymbolName } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { GlassSurface } from "../../components/GlassSurface";
import { androidWorkspaceNavigationState } from "../../lib/android-workspace-navigation";
import { useWorkspaceTabs } from "./WorkspaceTabsContext";
import { ANDROID_WORKSPACE_DOCK, type WorkspaceTab } from "./workspace-tabs-state";

const DOCK_TABS: ReadonlyArray<{
  readonly id: WorkspaceTab;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly icon: AppSymbolName;
}> = [
  { id: "threads", label: "Threads", accessibilityLabel: "Threads", icon: "text.bubble" },
  {
    id: "pullRequests",
    label: "Pulls",
    accessibilityLabel: "Pull requests",
    icon: "arrow.triangle.pull",
  },
];

/** Android's floating tab pill and compose button, matching the iOS tab bar layout. */
export function WorkspaceDock(props: { readonly onNewTask: () => void }) {
  const workspace = useWorkspaceTabs()!;
  const navigation = useNavigation();
  const ripple = useResolveClassNames("bg-foreground/10");
  const androidRipple = { color: ripple.backgroundColor, borderless: false };
  const { height, tabsWidth, gap } = ANDROID_WORKSPACE_DOCK;
  return (
    <View className="w-full flex-row items-center justify-between" style={{ gap }}>
      <GlassSurface style={{ width: tabsWidth, height, borderRadius: height / 2 }}>
        <View className="flex-1 flex-row p-1" accessibilityRole="tablist">
          {DOCK_TABS.map((tab) => {
            const selected = workspace.state.selectedTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityLabel={tab.accessibilityLabel}
                accessibilityState={{ selected }}
                android_ripple={androidRipple}
                onPress={() => {
                  if (selected) return;
                  Keyboard.dismiss();
                  workspace.dispatch({ type: "select", tab: tab.id });
                  // Peer tabs share one detail slot above Home; drop the other tab's detail.
                  navigation.dispatch((state) =>
                    CommonActions.reset(androidWorkspaceNavigationState(state)),
                  );
                }}
                className={
                  selected
                    ? "flex-1 items-center justify-center gap-0.5 overflow-hidden rounded-full bg-foreground/8"
                    : "flex-1 items-center justify-center gap-0.5 overflow-hidden rounded-full"
                }
              >
                <SymbolView
                  name={tab.icon}
                  size={22}
                  tintColorClassName={selected ? "accent-focus" : "accent-icon"}
                />
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  className={
                    selected
                      ? "text-[11px] leading-[14px] font-t3-medium text-focus"
                      : "text-[11px] leading-[14px] font-t3-medium text-foreground"
                  }
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
      <GlassSurface style={{ width: height, height, borderRadius: height / 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          android_ripple={androidRipple}
          onPress={props.onNewTask}
          className="flex-1 items-center justify-center"
        >
          <SymbolView name="square.and.pencil" size={23} tintColorClassName="accent-icon" />
        </Pressable>
      </GlassSurface>
    </View>
  );
}
