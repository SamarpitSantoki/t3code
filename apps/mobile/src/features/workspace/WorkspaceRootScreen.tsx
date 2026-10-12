import { useNavigation } from "@react-navigation/native";
import { use, useCallback, useMemo } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { CompactBrandTitle } from "../../components/CompactBrandTitle";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
import {
  useNativeColumnLayoutMetrics,
  useNativeLayoutMetrics,
} from "../../native/native-layout-metrics";
import { HomeRouteScreen } from "../home/HomeRouteScreen";
import { dispatchHardwareKeyboardCommand } from "../keyboard/hardwareKeyboardCommands";
import { WorkspaceConnectionTitle } from "../home/WorkspaceConnectionTitle";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { PullRequestsScreen } from "../pull-requests/PullRequestsScreen";
import {
  WorkspaceTabsContext,
  WorkspaceTabsProvider,
  useWorkspaceTabs,
} from "./WorkspaceTabsContext";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { WORKSPACE_DOCK, workspaceToolbarHeight } from "./workspace-tabs-state";
import { WorkspaceSidebarTabs } from "./WorkspaceSidebarTabs";
import { useSidebarWorkspaceTabs, useSystemWorkspaceTabBar } from "./useSystemWorkspaceTabBar";

const TAB_TITLES = {
  threads: "Threads",
  pullRequests: "Pull requests",
};

/** Brand and connection status occupy the same leading slot in both roots. */
function WorkspaceRootTitle(props: {
  readonly maxWidth: number;
  readonly onOpenEnvironments: () => void;
}) {
  const { state } = useWorkspaceTabs()!;
  return (
    <View style={{ width: props.maxWidth, minHeight: 32, justifyContent: "center" }}>
      <WorkspaceConnectionTitle
        brand={
          <CompactBrandTitle accessibilityLabel={`T3 Code, ${TAB_TITLES[state.selectedTab]}`} />
        }
        maxWidth={props.maxWidth}
        onPress={props.onOpenEnvironments}
      />
    </View>
  );
}

function WorkspaceRootContent() {
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const { layout } = useAdaptiveWorkspaceLayout();
  const primaryColumn = use(NativePrimaryColumnContext);
  const columnMetrics = useNativeColumnLayoutMetrics();
  const nativeMetrics = useNativeLayoutMetrics();
  const systemTabBar = useSystemWorkspaceTabBar();
  const sidebarTabs = useSidebarWorkspaceTabs();
  const sidebarNavigation =
    primaryColumn !== null &&
    (layout.usesSplitView ||
      (Platform.OS === "ios" && Platform.isPad) ||
      (nativeMetrics !== null && nativeMetrics.verticalBarEdge !== "none"));
  const width = columnMetrics?.width ?? windowWidth;
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((keyboard) => keyboard.height);
  const workspace = useWorkspaceTabs()!;
  const { state } = workspace;
  const renderHeaderTitle = useCallback(
    () => (
      <WorkspaceRootTitle
        maxWidth={Math.max(0, width - (Platform.OS === "android" ? 168 : 160))}
        onOpenEnvironments={() =>
          navigation.navigate("SettingsSheet", {
            screen: "SettingsContent",
            params: { screen: "SettingsEnvironments" },
          })
        }
      />
    ),
    [width, navigation],
  );
  const tab = state.tabs[state.selectedTab];
  const bottomClearance =
    Platform.OS === "ios"
      ? Math.max(insets.bottom, keyboardHeight) +
        (systemTabBar || sidebarTabs || tab.searchMode !== "resting"
          ? 16
          : WORKSPACE_DOCK.height + WORKSPACE_DOCK.bottomGap + 16)
      : keyboardHeight > 0 && tab.searchMode !== "resting"
        ? keyboardHeight + 64
        : Math.max(insets.bottom, 12) + workspaceToolbarHeight(tab.searchMode) + 16;
  const context = useMemo(() => ({ ...workspace, bottomClearance }), [workspace, bottomClearance]);

  return (
    <WorkspaceTabsContext value={context}>
      <View
        className="flex-1 bg-screen"
        style={sidebarTabs ? { paddingTop: insets.top } : undefined}
      >
        {Platform.OS === "ios" ? (
          <NativeStackScreenOptions
            optionsVersion={[state.selectedTab, state.selectionRevision, width, sidebarNavigation]}
            options={{
              title: TAB_TITLES[state.selectedTab],
              headerShown: true,
              unstable_headerLeftItems: () => [],
              headerTitle: renderHeaderTitle,
            }}
          />
        ) : (
          <>
            {/* Home's stack options request the iOS header; Android draws its own in-flow. */}
            <NativeStackScreenOptions options={{ headerShown: false }} />
            <AndroidScreenHeader
              title="T3 Code"
              // Align the brand with the list rows' 20dp leading inset.
              titleContent={<View className="pl-2">{renderHeaderTitle()}</View>}
              actions={[
                {
                  accessibilityLabel:
                    state.selectedTab === "threads" ? "Search threads" : "Search pull requests",
                  icon: "magnifyingglass",
                  onPress: () => {
                    dispatchHardwareKeyboardCommand("focusSearch");
                  },
                },
                {
                  accessibilityLabel: "Settings",
                  icon: "gearshape",
                  onPress: () =>
                    navigation.navigate("SettingsSheet", {
                      screen: "SettingsContent",
                      params: { screen: "Settings" },
                    }),
                },
              ]}
            />
          </>
        )}
        {sidebarTabs ? <WorkspaceSidebarTabs /> : null}
        {/* The pinned picker already clears the navigation bar; lists must not inset it again. */}
        <SafeAreaInsetsContext value={sidebarTabs ? { ...insets, top: 0 } : insets}>
          {state.selectedTab === "threads" ? <HomeRouteScreen /> : <PullRequestsScreen />}
        </SafeAreaInsetsContext>
        <WorkspaceToolbar
          sidebar={sidebarNavigation}
          onNewTask={() => navigation.navigate("NewTaskSheet", { screen: "NewTask" })}
        />
      </View>
    </WorkspaceTabsContext>
  );
}

/** Android split views list threads and pull requests in the sidebar; Home is the empty detail. */
function AndroidSplitDetail() {
  const workspace = useWorkspaceTabs();
  if (workspace?.state.selectedTab !== "pullRequests") return <HomeRouteScreen />;
  return (
    <>
      <NativeStackScreenOptions options={{ headerShown: false }} />
      <AndroidScreenHeader title="Pull requests" />
      <View className="flex-1 items-center justify-center px-10">
        <EmptyState
          title="Select a pull request"
          detail="Choose a pull request from the sidebar to review it."
          variant="plain"
        />
      </View>
    </>
  );
}

/** Keep workspace state mounted as the native columns expand and collapse. */
export function WorkspaceRootScreen() {
  const { layout } = useAdaptiveWorkspaceLayout();
  const workspace = useWorkspaceTabs();
  return Platform.OS === "android" && layout.usesSplitView ? (
    <AndroidSplitDetail />
  ) : workspace ? (
    <WorkspaceRootContent />
  ) : (
    <WorkspaceTabsProvider>
      <WorkspaceRootContent />
    </WorkspaceTabsProvider>
  );
}
