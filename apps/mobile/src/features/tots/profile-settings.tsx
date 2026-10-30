import { StackActions, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { botIdentity } from "../bots/bot-identity";
import { removeBot, type Bot } from "../bots/bots-model";
import {
  sendToBot,
  useBotRegistry,
  useBotThreadTarget,
  useUpdateBotRegistry,
} from "../bots/bots-state";
import { botAccessory } from "./bot-face-model";
import { botNameTaken, buildRoleChangeMessage, updateBotProfile } from "./profile-model";
import { TotsField, TotsLookPicker } from "./profile-ui";
import { useTotsColors } from "./theme";
import { TotsButton, TotsCard, TotsSectionLabel, TotsText } from "./ui";

export function ProfileSettings(props: {
  readonly bot: Bot;
  readonly editing: boolean;
  readonly onEditingChange: (editing: boolean) => void;
}) {
  const { bot } = props;
  const navigation = useNavigation();
  const colors = useTotsColors();
  const target = useBotThreadTarget(bot);
  const updateRegistry = useUpdateBotRegistry();
  // Set after a saved name or job change, until the bot is told or the user moves on.
  const [announceFrom, setAnnounceFrom] = useState<string | null>(null);
  const [telling, setTelling] = useState(false);

  const tell = async () => {
    if (announceFrom === null || telling) return;
    setTelling(true);
    try {
      await sendToBot(
        bot,
        buildRoleChangeMessage({ previousName: announceFrom, name: bot.name, role: bot.role }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAnnounceFrom(null);
    } catch (error) {
      Dialog.alert("Could not send", String(error));
    }
    setTelling(false);
  };

  const confirmRemove = () => {
    Dialog.confirm({
      title: `Remove ${bot.name}?`,
      message: "Its chats stay in T3 Code. Teams it leads are removed.",
      confirmText: "Remove",
      destructive: true,
      onConfirm: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
        updateRegistry((registry) => removeBot(registry, bot.id));
      },
    });
  };

  return (
    <>
      {props.editing ? (
        <EditProfile
          bot={bot}
          onCancel={() => props.onEditingChange(false)}
          onSaved={(changedJob) => {
            props.onEditingChange(false);
            if (changedJob) setAnnounceFrom(announceFrom ?? bot.name);
          }}
        />
      ) : (
        <TotsCard style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <TotsText style={{ fontWeight: "600" }}>Name, job and look</TotsText>
            <TotsText variant="small" tone="muted" numberOfLines={1}>
              {bot.name}
            </TotsText>
          </View>
          <TotsButton
            label="Edit"
            kind="light"
            size="small"
            onPress={() => props.onEditingChange(true)}
          />
        </TotsCard>
      )}

      {announceFrom !== null ? (
        <TotsCard tone="blue" style={{ gap: 10 }}>
          <TotsText variant="small" style={{ color: colors.blueInk }}>
            {`New threads use the new job. ${bot.name}'s main chat still knows the old one.`}
          </TotsText>
          <TotsButton
            label={`Tell ${bot.name} about the new job`}
            size="small"
            loading={telling}
            onPress={() => void tell()}
          />
        </TotsCard>
      ) : null}

      <TotsSectionLabel>Setup</TotsSectionLabel>
      <TotsCard style={{ gap: 12 }}>
        <SetupRow label="Project" value={target?.project.title ?? "Loading"} />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <SetupRow label="Model" value={target?.modelSelection.model ?? "Loading"} />
      </TotsCard>
      <TotsText variant="small" tone="muted" style={{ paddingHorizontal: 6 }}>
        New threads use the main chat's project and model.
      </TotsText>

      <View style={{ marginTop: 18 }}>
        <TotsButton label={`Remove ${bot.name}`} kind="danger" onPress={confirmRemove} />
      </View>
    </>
  );
}

function SetupRow(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <TotsText tone="muted" style={{ width: 70 }}>
        {props.label}
      </TotsText>
      <TotsText style={{ flex: 1, textAlign: "right" }} numberOfLines={1}>
        {props.value}
      </TotsText>
    </View>
  );
}

function EditProfile(props: {
  readonly bot: Bot;
  readonly onCancel: () => void;
  readonly onSaved: (changedJob: boolean) => void;
}) {
  const { bot } = props;
  const { registry } = useBotRegistry();
  const updateRegistry = useUpdateBotRegistry();
  const [name, setName] = useState(bot.name);
  const [role, setRole] = useState(bot.role);
  const [color, setColor] = useState(botIdentity(bot).color);
  const [accessory, setAccessory] = useState<string>(botAccessory(bot));
  const nameTaken = botNameTaken(registry, name, bot.id);

  const save = () => {
    if (!name.trim() || !role.trim()) {
      Dialog.alert("Almost there", "Give your bot a name and a job.");
      return;
    }
    if (nameTaken) {
      Dialog.alert("Name in use", "Each bot needs its own name, so teams can @mention it.");
      return;
    }
    const changedJob = name.trim() !== bot.name || role.trim() !== bot.role.trim();
    updateRegistry((current) =>
      updateBotProfile(current, bot.id, { name, role, color, accessory }),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    props.onSaved(changedJob);
  };

  return (
    <TotsCard style={{ gap: 14, paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: 14, gap: 14 }}>
        <TotsField
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
          hint={nameTaken ? "Another bot already has this name." : undefined}
        />
        <TotsField
          label="Job"
          value={role}
          onChangeText={setRole}
          multiline
          hint="Changes apply to new threads. You can tell the main chat after you save."
        />
        <TotsText variant="label" tone="inkSoft" style={{ paddingHorizontal: 6 }}>
          Look
        </TotsText>
      </View>
      <TotsLookPicker
        color={color}
        accessory={accessory}
        onColor={setColor}
        onAccessory={setAccessory}
      />
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
        <TotsButton label="Cancel" kind="light" grow onPress={props.onCancel} />
        <TotsButton label="Save" grow disabled={nameTaken} onPress={save} />
      </View>
    </TotsCard>
  );
}
