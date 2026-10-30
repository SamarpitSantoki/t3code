import { useNavigation } from "@react-navigation/native";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBotRegistry } from "../bots/bots-state";
import { HireFirstBot } from "./home-empty";
import { rosterSummary } from "./home-model";
import { BotRow, NeedsYouCard, TabHeader, TeamRow } from "./home-rows";
import { ServerBotsSection } from "./server-bots-section";
import { TOTS_TAB_BAR_HEIGHT } from "./tab-bar";
import { TOTS_RADIUS, useTotsColors } from "./theme";
import { TotsButton, TotsGlyph, TotsIconButton, TotsSectionLabel } from "./ui";
import { useBotsActivity } from "./use-bot-activity";

const PILL_BAR_HEIGHT = 50;

/** The board: who needs you, teams, and every bot. Tapping a bot opens its profile. */
export function TotsTeamTab() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useTotsColors();
  const { registry } = useBotRegistry();
  const { bots, teams } = registry;
  const activity = useBotsActivity(bots);

  const hasBots = bots.length > 0;
  const waiting = bots.flatMap((bot) => {
    const current = activity.get(bot.id);
    return current?.status.kind === "needs_you" ? [{ bot, threadId: current.threadId }] : [];
  });
  const barBottom = TOTS_TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 16,
          paddingBottom: barBottom + 16 + (hasBots ? PILL_BAR_HEIGHT + 20 : 0),
          gap: 10,
        }}
      >
        <TabHeader
          title="Team"
          summary={
            hasBots
              ? rosterSummary(
                  bots.length,
                  bots.map((bot) => activity.get(bot.id)),
                )
              : undefined
          }
          trailing={
            <TotsIconButton
              accessibilityLabel="Settings"
              onPress={() => navigation.navigate("TotsSettings")}
            >
              <TotsGlyph size={16}>···</TotsGlyph>
            </TotsIconButton>
          }
        />

        {!hasBots ? (
          <HireFirstBot />
        ) : (
          <>
            {waiting.map(({ bot, threadId }) => (
              <NeedsYouCard key={bot.id} bot={bot} threadId={threadId} />
            ))}

            {teams.length > 0 ? (
              <View>
                <TotsSectionLabel>Teams</TotsSectionLabel>
                {teams.map((team) => (
                  <TeamRow key={team.id} team={team} bots={bots} />
                ))}
              </View>
            ) : null}

            <View>
              <TotsSectionLabel>Bots</TotsSectionLabel>
              {bots.map((bot) => (
                <BotRow
                  key={bot.id}
                  bot={bot}
                  activity={activity.get(bot.id)}
                  ledTeams={teams.filter((team) => team.leadBotId === bot.id)}
                />
              ))}
            </View>
          </>
        )}

        <ServerBotsSection />
      </ScrollView>

      {hasBots ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: barBottom + 12,
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Floating color={colors.primary}>
            <TotsButton
              label="New bot"
              size="large"
              icon={<TotsGlyph tone="onPrimary">+</TotsGlyph>}
              onPress={() => navigation.navigate("BotNew")}
            />
          </Floating>
          <Floating color={colors.card}>
            <TotsButton
              label="New team"
              kind="light"
              size="large"
              disabled={bots.length < 2}
              onPress={() => navigation.navigate("BotTeamNew")}
            />
          </Floating>
        </View>
      ) : null}
    </View>
  );
}

/** Android draws elevation only under an opaque background. */
function Floating(props: { readonly color: string; readonly children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: props.color,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      {props.children}
    </View>
  );
}
