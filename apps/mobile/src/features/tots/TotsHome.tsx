import { useNavigation } from "@react-navigation/native";
import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useConnectionsReady } from "../../state/workspace";
import { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
import { useBotRegistry } from "../bots/bots-state";
import { ConnectServerHero } from "./home-empty";
import { TabHeader } from "./home-rows";
import { TotsTabBar, type TotsTab } from "./tab-bar";
import { TotsChatsTab } from "./tab-chats";
import { TotsScheduledTab } from "./tab-scheduled";
import { TotsTeamTab } from "./tab-team";
import { useTotsColors } from "./theme";
import { TotsGlyph, TotsIconButton } from "./ui";
import { useBotsActivity } from "./use-bot-activity";

export function TotsHome() {
  const colors = useTotsColors();
  const connectionsReady = useConnectionsReady();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const { loaded } = useBotRegistry();

  const ready = connectionsReady && loaded;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NativeStackScreenOptions options={{ headerShown: false }} />
      {!ready ? null : connectedEnvironments.length === 0 ? <NoServer /> : <TabShell />}
    </View>
  );
}

function TabShell() {
  const { registry } = useBotRegistry();
  const activity = useBotsActivity(registry.bots);
  const [selected, setSelected] = useState<TotsTab>("chats");
  // Tabs mount on first visit and stay mounted so they keep their scroll position.
  const [visited, setVisited] = useState<ReadonlySet<TotsTab>>(() => new Set(["chats"]));
  const needsYou = [...activity.values()].some((entry) => entry.status.kind === "needs_you");

  const select = (tab: TotsTab) => {
    setSelected(tab);
    if (!visited.has(tab)) setVisited(new Set([...visited, tab]));
  };

  return (
    <>
      <TabPane tab="chats" selected={selected} visited={visited}>
        <TotsChatsTab />
      </TabPane>
      <TabPane tab="team" selected={selected} visited={visited}>
        <TotsTeamTab />
      </TabPane>
      <TabPane tab="scheduled" selected={selected} visited={visited}>
        <TotsScheduledTab />
      </TabPane>
      <TotsTabBar selected={selected} onSelect={select} needsYou={needsYou} />
    </>
  );
}

function TabPane(props: {
  readonly tab: TotsTab;
  readonly selected: TotsTab;
  readonly visited: ReadonlySet<TotsTab>;
  readonly children: ReactNode;
}) {
  if (!props.visited.has(props.tab)) return null;
  return (
    <View style={{ flex: 1, display: props.selected === props.tab ? "flex" : "none" }}>
      {props.children}
    </View>
  );
}

function NoServer() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 12) + 20,
        gap: 10,
      }}
    >
      <TabHeader
        title="Tots"
        byline="by t3code"
        trailing={
          <TotsIconButton
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate("TotsSettings")}
          >
            <TotsGlyph size={16}>···</TotsGlyph>
          </TotsIconButton>
        }
      />
      <ConnectServerHero />
    </ScrollView>
  );
}
