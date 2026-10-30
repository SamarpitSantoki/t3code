import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { Bot } from "../bots/bots-model";
import { useBotRegistry } from "../bots/bots-state";
import { BotFace, moodForStatus } from "./BotFace";
import { ProfileRoutines } from "./profile-routines";
import { ProfileSettings } from "./profile-settings";
import { ProfileThreads } from "./profile-threads";
import { TotsFormScreen, TotsMessageScreen, TotsScreenOptions, TotsSegmented } from "./profile-ui";
import { useBotsActivity } from "./use-bot-activity";
import { TotsButton, TotsCard, TotsText } from "./ui";

type BotProfileScreenProps = StaticScreenProps<{ readonly botId: string }>;

type ProfileTab = "threads" | "routines" | "settings";

const TABS: ReadonlyArray<{ readonly id: ProfileTab; readonly label: string }> = [
  { id: "threads", label: "Threads" },
  { id: "routines", label: "Routines" },
  { id: "settings", label: "Settings" },
];

export function BotProfileScreen({ route }: BotProfileScreenProps) {
  const { registry, loaded } = useBotRegistry();
  const bot = registry.bots.find((candidate) => candidate.id === route.params.botId) ?? null;
  if (!bot) {
    return (
      <>
        <TotsScreenOptions title="" />
        <TotsMessageScreen
          title={loaded ? "Bot not found" : "Loading"}
          detail={loaded ? "This bot was removed." : undefined}
        />
      </>
    );
  }
  return <Profile bot={bot} />;
}

function Profile(props: { readonly bot: Bot }) {
  const { bot } = props;
  const navigation = useNavigation();
  const activity = useBotsActivity([bot]).get(bot.id);
  const [tab, setTab] = useState<ProfileTab>("threads");
  const [editing, setEditing] = useState(false);
  const [roleExpanded, setRoleExpanded] = useState(false);

  const startEdit = () => {
    void Haptics.selectionAsync();
    setTab("settings");
    setEditing(true);
  };

  return (
    <>
      <TotsScreenOptions title="" />
      <TotsFormScreen gap={14}>
        <View style={{ paddingHorizontal: 16 }}>
          <TotsCard style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${bot.name}`}
              hitSlop={10}
              onPress={startEdit}
              style={{ position: "absolute", top: 14, right: 16 }}
            >
              <TotsText tone="blue" style={{ fontWeight: "600" }}>
                Edit
              </TotsText>
            </Pressable>
            <BotFace bot={bot} size={72} mood={moodForStatus(activity?.status.kind)} />
            <TotsText variant="heading" style={{ fontSize: 22 }} numberOfLines={1}>
              {bot.name}
            </TotsText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={roleExpanded ? "Show less" : "Show the full job"}
              onPress={() => setRoleExpanded(!roleExpanded)}
              style={{ paddingHorizontal: 12 }}
            >
              <TotsText
                tone="muted"
                numberOfLines={roleExpanded ? undefined : 3}
                style={{ textAlign: "center" }}
              >
                {bot.role}
              </TotsText>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <TotsButton
                label="Message"
                onPress={() => navigation.navigate("BotChat", { botId: bot.id })}
              />
              <TotsButton
                label="New thread"
                kind="light"
                onPress={() => navigation.navigate("BotChat", { botId: bot.id, newThread: true })}
              />
            </View>
          </TotsCard>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <TotsSegmented options={TABS} value={tab} onChange={setTab} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {tab === "threads" ? <ProfileThreads bot={bot} /> : null}
          {tab === "routines" ? <ProfileRoutines bot={bot} /> : null}
          {tab === "settings" ? (
            <ProfileSettings bot={bot} editing={editing} onEditingChange={setEditing} />
          ) : null}
        </View>
      </TotsFormScreen>
    </>
  );
}
