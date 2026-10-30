import { StackActions, useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
import { useTotsColors } from "./theme";
import { TotsCard, TotsGlyph, TotsSectionLabel, TotsText, TotsToggle } from "./ui";
import { useSetTotsClassic, useTotsClassic } from "./use-tots-classic";

export function TotsSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useTotsColors();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const classic = useTotsClassic();
  const setClassic = useSetTotsClassic();
  const connected = connectedEnvironments.filter(
    (environment) => environment.connectionState === "connected",
  ).length;
  const version = Constants.expoConfig?.version ?? "0.0.0";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 18) + 18,
        gap: 6,
      }}
    >
      <TotsCard style={{ padding: 0, overflow: "hidden" }}>
        <LinkRow
          label="Servers"
          value={
            connectedEnvironments.length === 0
              ? "None"
              : `${connected} of ${connectedEnvironments.length} connected`
          }
          onPress={() => navigation.navigate("SettingsEnvironments")}
        />
        <Divider />
        <LinkRow label="Appearance" onPress={() => navigation.navigate("SettingsAppearance")} />
        <Divider />
        <LinkRow
          label="Notifications"
          onPress={() => navigation.navigate("SettingsNotifications")}
        />
      </TotsCard>

      <TotsSectionLabel>Advanced</TotsSectionLabel>
      <TotsCard style={{ gap: 6 }}>
        <View className="flex-row items-center gap-3">
          <TotsText style={{ flex: 1, fontWeight: "600" }}>Classic T3 Code</TotsText>
          <TotsToggle
            accessibilityLabel="Classic T3 Code"
            value={classic}
            onChange={(value) => {
              void setClassic(value);
              if (value) navigation.dispatch(StackActions.popToTop());
            }}
          />
        </View>
        <TotsText variant="small" tone="muted">
          Shows the full T3 Code app with chats, pull requests and usage. Turn off to come back to
          Tots.
        </TotsText>
      </TotsCard>

      <View className="items-center gap-0.5 pt-8">
        <TotsText variant="label" tone="muted">
          Tots by t3code
        </TotsText>
        <TotsText variant="small" tone="muted">
          Version {version}
        </TotsText>
      </View>
    </ScrollView>
  );
}

function LinkRow(props: {
  readonly label: string;
  readonly value?: string;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.value ? `${props.label}, ${props.value}` : props.label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 52,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.sunken : "transparent",
      })}
    >
      <TotsText style={{ flex: 1, fontWeight: "600" }}>{props.label}</TotsText>
      {props.value ? (
        <TotsText variant="small" tone="muted" numberOfLines={1}>
          {props.value}
        </TotsText>
      ) : null}
      <TotsGlyph tone="muted" size={20}>
        ›
      </TotsGlyph>
    </Pressable>
  );
}

function Divider() {
  const colors = useTotsColors();
  return <View style={{ height: 1, marginLeft: 16, backgroundColor: colors.line }} />;
}
