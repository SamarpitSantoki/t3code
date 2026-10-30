import { useNavigation } from "@react-navigation/native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNowMinuteMs } from "../../lib/clock";
import { useBotRegistry } from "../bots/bots-state";
import { TabHeader } from "./home-rows";
import { useScheduledReports } from "./scheduled-data";
import { groupBotsByEnvironment, scheduledSubtitle, summarizeScheduled } from "./scheduled-model";
import {
  AddRoutineMenu,
  HireFirstCard,
  NoRoutinesCard,
  NoRoutinesList,
  ScheduledEnvironment,
} from "./scheduled-sections";
import { TOTS_TAB_BAR_HEIGHT } from "./tab-bar";
import { useTotsColors } from "./theme";
import { TotsGlyph, TotsIconButton } from "./ui";

/** The Scheduled tab: every bot's routines. Fills the area above the Tots tab bar. */
export function TotsScheduledTab() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useTotsColors();
  const { registry } = useBotRegistry();
  const now = new Date(useNowMinuteMs());
  const groups = groupBotsByEnvironment(registry.bots);
  const reports = useScheduledReports(groups);
  const summary = summarizeScheduled({ bots: registry.bots, reports, now });
  const showEmpty = summary.settled && summary.routineCount === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 16,
          paddingBottom: TOTS_TAB_BAR_HEIGHT + insets.bottom + 16,
          gap: 8,
        }}
      >
        <TabHeader
          title="Scheduled"
          summary={scheduledSubtitle(summary, now)}
          trailing={
            <>
              <AddRoutineMenu bots={registry.bots} />
              <TotsIconButton
                accessibilityLabel="Settings"
                onPress={() => navigation.navigate("TotsSettings")}
              >
                <TotsGlyph size={16}>···</TotsGlyph>
              </TotsIconButton>
            </>
          }
        />
        {registry.bots.length === 0 ? <HireFirstCard /> : null}
        {showEmpty ? <NoRoutinesCard bots={registry.bots} /> : null}
        {registry.bots.length > 0 && !showEmpty ? (
          <>
            {groups.map((group) => (
              <ScheduledEnvironment
                key={group.environmentId}
                environmentId={group.environmentId}
                bots={group.bots}
                report={reports.get(group.environmentId)}
                now={now}
              />
            ))}
            {summary.botsWithout.length > 0 ? <NoRoutinesList bots={summary.botsWithout} /> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
