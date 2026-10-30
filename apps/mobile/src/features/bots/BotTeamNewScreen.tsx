import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, ScrollView as RNScrollView, View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { BotFace } from "../tots/BotFace";
import { TotsField, TotsFormScreen, TotsFormSection, TotsScreenOptions } from "../tots/profile-ui";
import { useTotsColors } from "../tots/theme";
import { TotsButton, TotsCard, TotsText } from "../tots/ui";
import { addTeam, type Bot } from "./bots-model";
import { createTeam, useBotRegistry, useUpdateBotRegistry } from "./bots-state";

const MAX_TEAMMATES = 5;

function selectionHaptic() {
  void Haptics.selectionAsync().catch(() => undefined);
}

export function BotTeamNewScreen() {
  const navigation = useNavigation();
  const { registry } = useBotRegistry();
  const updateRegistry = useUpdateBotRegistry();
  const [name, setName] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<ReadonlyArray<string>>([]);
  const [saving, setSaving] = useState(false);

  const bots = registry.bots;
  const lead = bots.find((bot) => bot.id === leadId) ?? bots[0] ?? null;
  // Thread-to-thread messages stay inside one environment.
  const canJoin = (bot: Bot) => bot.id !== lead?.id && bot.environmentId === lead?.environmentId;
  const candidates = bots.filter((bot) => bot.id !== lead?.id);
  const members = bots.filter((bot) => canJoin(bot) && memberIds.includes(bot.id));
  const atCap = members.length >= MAX_TEAMMATES;
  const valid = name.trim().length > 0 && lead !== null && members.length > 0;

  const chooseLead = (bot: Bot) => {
    if (saving || bot.id === lead?.id) return;
    selectionHaptic();
    setLeadId(bot.id);
    setMemberIds((current) =>
      current.filter((id) => {
        const member = bots.find((candidate) => candidate.id === id);
        return id !== bot.id && member?.environmentId === bot.environmentId;
      }),
    );
  };

  const toggleMember = (bot: Bot) => {
    if (saving) return;
    const selected = members.some((member) => member.id === bot.id);
    if (!selected && (atCap || !canJoin(bot))) return;
    selectionHaptic();
    setMemberIds((current) =>
      selected ? current.filter((id) => id !== bot.id) : [...current, bot.id],
    );
  };

  const save = async () => {
    if (saving) return;
    if (!valid || !lead) {
      Dialog.alert("Incomplete team", "Add a name, a lead, and at least one teammate.");
      return;
    }
    setSaving(true);
    try {
      const team = await createTeam({ name, lead, members });
      updateRegistry((current) => addTeam(current, team));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      setSaving(false);
      Dialog.alert("Could not create team", String(error));
    }
  };

  const hint = !lead
    ? "Hire a bot first"
    : name.trim().length === 0
      ? "Name your team"
      : members.length === 0
        ? "Pick at least one teammate"
        : `${lead.name} leads ${members.length} ${members.length === 1 ? "teammate" : "teammates"}`;

  const candidateRows: Bot[][] = [];
  for (let index = 0; index < candidates.length; index += 2) {
    candidateRows.push(candidates.slice(index, index + 2));
  }

  return (
    <>
      <TotsScreenOptions title="New team" />
      <TotsFormScreen
        footer={
          <>
            <TotsText
              variant="small"
              tone="muted"
              style={{ textAlign: "center" }}
              numberOfLines={1}
            >
              {hint}
            </TotsText>
            <TotsButton
              label="Create team"
              size="large"
              loading={saving}
              disabled={!valid}
              onPress={() => void save()}
            />
          </>
        }
      >
        <TotsFormSection title="Name" hint="Pick a lead and the teammates they can hand work to.">
          <TotsField
            value={name}
            onChangeText={setName}
            editable={!saving}
            placeholder="Launch crew"
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={60}
            large
          />
        </TotsFormSection>

        <TotsFormSection title="Lead" hint="You talk to the lead. The lead splits the work." flush>
          {bots.length === 0 ? (
            <View style={{ paddingHorizontal: 20 }}>
              <Notice text="Hire a bot first. Then come back to build a team." />
            </View>
          ) : (
            <RNScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 10 }}
            >
              {bots.map((bot) => (
                <LeadChip
                  key={bot.id}
                  bot={bot}
                  selected={bot.id === lead?.id}
                  onPress={() => chooseLead(bot)}
                />
              ))}
            </RNScrollView>
          )}
        </TotsFormSection>

        <TotsFormSection
          title="Teammates"
          hint={`${members.length} of ${MAX_TEAMMATES} picked. Teammates must be on the lead's server.`}
        >
          {candidates.length === 0 ? (
            <Notice text="Hire another bot on the same server to add teammates." />
          ) : (
            candidateRows.map((row) => (
              <View
                key={row.map((bot) => bot.id).join(":")}
                style={{ flexDirection: "row", gap: 10 }}
              >
                {row.map((bot) => {
                  const selected = members.some((member) => member.id === bot.id);
                  const sameServer = canJoin(bot);
                  return (
                    <TeammateCard
                      key={bot.id}
                      bot={bot}
                      selected={selected}
                      disabled={saving || !sameServer || (!selected && atCap)}
                      note={sameServer ? null : "Different server"}
                      onPress={() => toggleMember(bot)}
                    />
                  );
                })}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))
          )}
        </TotsFormSection>
      </TotsFormScreen>
    </>
  );
}

function Notice(props: { readonly text: string }) {
  return (
    <TotsCard tone="sunken">
      <TotsText variant="small" tone="muted">
        {props.text}
      </TotsText>
    </TotsCard>
  );
}

function LeadChip(props: {
  readonly bot: Bot;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: props.selected }}
      accessibilityLabel={`Lead: ${props.bot.name}`}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 76,
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          padding: 4,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: props.selected ? colors.ink : "transparent",
        }}
      >
        <BotFace bot={props.bot} size={52} />
        {props.selected ? (
          <View
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.amberLine,
            }}
          >
            <TotsText variant="small" style={{ color: colors.amber }}>
              ♛
            </TotsText>
          </View>
        ) : null}
      </View>
      <TotsText
        variant="small"
        tone={props.selected ? "ink" : "muted"}
        numberOfLines={1}
        style={{ fontWeight: props.selected ? "700" : "500" }}
      >
        {props.bot.name}
      </TotsText>
    </Pressable>
  );
}

function TeammateCard(props: {
  readonly bot: Bot;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly note: string | null;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  const dimmed = props.disabled && !props.selected;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.selected, disabled: props.disabled }}
      accessibilityLabel={props.bot.name}
      disabled={dimmed}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        gap: 10,
        padding: 14,
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: props.selected ? colors.ink : colors.line,
        opacity: dimmed ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <BotFace bot={props.bot} size={42} />
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: props.selected ? colors.primary : "transparent",
            borderWidth: props.selected ? 0 : 1.5,
            borderColor: colors.line,
          }}
        >
          {props.selected ? (
            <TotsText variant="small" tone="onPrimary" style={{ fontWeight: "700" }}>
              ✓
            </TotsText>
          ) : null}
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <TotsText style={{ fontWeight: "700" }} numberOfLines={1}>
          {props.bot.name}
        </TotsText>
        <TotsText variant="small" tone="muted" numberOfLines={2}>
          {props.note ?? props.bot.role}
        </TotsText>
      </View>
    </Pressable>
  );
}
