import { useAtomValue } from "@effect/atom-react";
import { useNavigation } from "@react-navigation/native";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  EnvironmentId,
  type ScheduledTask,
} from "@t3tools/contracts";
import { useState } from "react";
import { Pressable, View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import { serverEnvironment } from "../../state/server";
import { readEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import type { Bot } from "../bots/bots-model";
import { BotFace, BotFaceStack } from "./BotFace";
import { ROUTINE_PRESETS, describeRoutineForm, describeRoutineSchedule } from "./routine-schedule";
import { routineRunLine, routinesForBot, type EnvironmentRoutineReport } from "./scheduled-model";
import { TOTS_RADIUS, useTotsColors } from "./theme";
import {
  TotsButton,
  TotsCard,
  TotsGlyph,
  TotsIconButton,
  TotsSectionLabel,
  TotsText,
  TotsToggle,
} from "./ui";

/** One server's bots. Its own component so the permission hook runs once per server. */
export function ScheduledEnvironment(props: {
  readonly environmentId: string;
  readonly bots: ReadonlyArray<Bot>;
  readonly report: EnvironmentRoutineReport | undefined;
  readonly now: Date;
}) {
  const environmentId = EnvironmentId.make(props.environmentId);
  const canOperate = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(environmentId),
  );
  const status = props.report?.status ?? "loading";

  if (status === "offline" || status === "error") {
    return (
      <TotsCard tone="sunken" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <BotFaceStack bots={props.bots} size={28} max={3} />
        <View style={{ flex: 1, gap: 2 }}>
          <TotsText style={{ fontWeight: "600" }} numberOfLines={1}>
            {props.bots.map((bot) => bot.name).join(", ")}
          </TotsText>
          <TotsText variant="small" tone="muted">
            {status === "offline"
              ? "Server offline. Routines still run on the server."
              : "Could not load routines from this server."}
          </TotsText>
        </View>
      </TotsCard>
    );
  }
  if (status === "loading") {
    return (
      <TotsText variant="small" tone="muted" style={{ textAlign: "center", padding: 12 }}>
        Loading routines
      </TotsText>
    );
  }
  return props.bots.map((bot) => {
    const routines = routinesForBot(bot, props.report?.tasks ?? [], props.now);
    return routines.length === 0 ? null : (
      <BotRoutineSection
        key={bot.id}
        bot={bot}
        routines={routines}
        environmentId={environmentId}
        canOperate={canOperate}
        now={props.now}
      />
    );
  });
}

function BotRoutineSection(props: {
  readonly bot: Bot;
  readonly routines: ReadonlyArray<ScheduledTask>;
  readonly environmentId: EnvironmentId;
  readonly canOperate: boolean;
  readonly now: Date;
}) {
  const navigation = useNavigation();
  const colors = useTotsColors();
  const { bot } = props;
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${bot.name}, open profile`}
        onPress={() => navigation.navigate("BotProfile", { botId: bot.id })}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 6,
          paddingVertical: 4,
          borderRadius: TOTS_RADIUS.card - 6,
          backgroundColor: pressed ? colors.sunken : "transparent",
        })}
      >
        <BotFace bot={bot} size={30} />
        <TotsText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {bot.name}
        </TotsText>
        <TotsGlyph tone="muted" size={20}>
          ›
        </TotsGlyph>
      </Pressable>
      {props.routines.map((task) => (
        <ScheduledRoutineRow
          key={task.id}
          task={task}
          environmentId={props.environmentId}
          canOperate={props.canOperate}
          now={props.now}
          onPress={() => navigation.navigate("BotRoutine", { botId: bot.id, taskId: task.id })}
        />
      ))}
    </View>
  );
}

function ScheduledRoutineRow(props: {
  readonly task: ScheduledTask;
  readonly environmentId: EnvironmentId;
  readonly canOperate: boolean;
  readonly now: Date;
  readonly onPress: () => void;
}) {
  const { task, environmentId } = props;
  const setEnabled = useAtomCommand(serverEnvironment.setScheduledTaskEnabled, {
    label: "scheduled tab routine enabled",
    reportFailure: false,
  });
  // Shows the flip at once and keeps it until the live list agrees.
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  if (pending !== null && task.enabled === pending) setPending(null);
  const enabled = pending ?? task.enabled;
  const schedule = describeRoutineSchedule(task.schedule);
  const runLine = routineRunLine({ ...task, enabled }, props.now);

  const toggle = async (next: boolean) => {
    if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) {
      Dialog.alert("Not allowed", "This connection cannot change routines.");
      return;
    }
    setPending(next);
    setSaving(true);
    const result = await setEnabled({ environmentId, input: { id: task.id, enabled: next } });
    setSaving(false);
    if (result._tag === "Failure") {
      setPending(null);
      if (!isAtomCommandInterrupted(result)) {
        Dialog.alert("Could not update routine", String(squashAtomCommandFailure(result)));
      }
    }
  };

  return (
    <TotsCard
      onPress={props.onPress}
      accessibilityLabel={`${task.title}, ${schedule}, ${runLine}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <TotsText style={{ fontWeight: "600" }} numberOfLines={1}>
          {task.title}
        </TotsText>
        <TotsText variant="small" tone="muted" numberOfLines={1}>
          {schedule}
        </TotsText>
        {task.lastRunError ? (
          <TotsText variant="small" tone="red" numberOfLines={1}>
            {`Last run failed: ${task.lastRunError}`}
          </TotsText>
        ) : (
          <TotsText variant="small" tone={enabled ? "inkSoft" : "muted"} numberOfLines={1}>
            {runLine}
          </TotsText>
        )}
      </View>
      <TotsToggle
        accessibilityLabel={`${task.title} on`}
        value={enabled}
        disabled={!props.canOperate || saving}
        onChange={(next) => void toggle(next)}
      />
    </TotsCard>
  );
}

/** Bots with nothing scheduled, kept short at the bottom of the list. */
export function NoRoutinesList(props: { readonly bots: ReadonlyArray<Bot> }) {
  const navigation = useNavigation();
  return (
    <View style={{ gap: 4, marginTop: 8 }}>
      <TotsSectionLabel>No routines yet</TotsSectionLabel>
      {props.bots.map((bot) => (
        <View
          key={bot.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 6,
            paddingVertical: 4,
          }}
        >
          <BotFace bot={bot} size={28} />
          <TotsText style={{ flex: 1 }} numberOfLines={1}>
            {bot.name}
          </TotsText>
          <TotsButton
            label="Add"
            kind="light"
            size="small"
            accessibilityLabel={`Add a routine for ${bot.name}`}
            onPress={() =>
              navigation.navigate("BotRoutine", { botId: bot.id, preset: "morning-brief" })
            }
          />
        </View>
      ))}
    </View>
  );
}

/** Bots are hired but nothing is scheduled: offer the presets for one bot. */
export function NoRoutinesCard(props: { readonly bots: ReadonlyArray<Bot> }) {
  const navigation = useNavigation();
  const [botId, setBotId] = useState<string | null>(null);
  const bot = props.bots.find((candidate) => candidate.id === botId) ?? props.bots[0];
  if (!bot) return null;
  return (
    <TotsCard style={{ gap: 12, marginTop: 6 }}>
      <View style={{ alignItems: "center", gap: 6, paddingTop: 6 }}>
        <BotFace bot={bot} size={52} />
        <TotsText variant="heading" style={{ textAlign: "center" }}>
          Put a bot on a schedule
        </TotsText>
        <TotsText variant="small" tone="muted" style={{ textAlign: "center" }}>
          Routines run on your server, even with this app closed. Results land in the bot's chat.
        </TotsText>
      </View>
      {props.bots.length > 1 ? (
        <Menu
          title="Pick a bot"
          actions={props.bots.map((candidate) => ({ id: candidate.id, title: candidate.name }))}
          onPressAction={({ nativeEvent }) => setBotId(nativeEvent.event)}
        >
          <View pointerEvents="none" style={{ alignSelf: "center" }}>
            <TotsButton
              label={`For ${bot.name} ▾`}
              kind="light"
              size="small"
              accessibilityLabel={`For ${bot.name}, change bot`}
              onPress={() => undefined}
            />
          </View>
        </Menu>
      ) : null}
      {ROUTINE_PRESETS.map((preset) => (
        <TotsCard
          key={preset.id}
          tone="sunken"
          onPress={() => navigation.navigate("BotRoutine", { botId: bot.id, preset: preset.id })}
          accessibilityLabel={`${preset.name} for ${bot.name}, ${describeRoutineForm(preset.schedule)}`}
          style={{ gap: 2 }}
        >
          <TotsText style={{ fontWeight: "600" }}>{`${preset.glyph} ${preset.name}`}</TotsText>
          <TotsText variant="small" tone="muted">
            {describeRoutineForm(preset.schedule)}
          </TotsText>
        </TotsCard>
      ))}
    </TotsCard>
  );
}

export function HireFirstCard() {
  const navigation = useNavigation();
  return (
    <TotsCard style={{ alignItems: "center", gap: 10, paddingVertical: 28, marginTop: 6 }}>
      <TotsText variant="heading" style={{ textAlign: "center" }}>
        Nothing scheduled yet
      </TotsText>
      <TotsText variant="small" tone="muted" style={{ textAlign: "center" }}>
        Hire a bot, then give it routines like a morning brief or a weekly summary.
      </TotsText>
      <TotsButton
        label="Hire a bot first"
        icon={<TotsGlyph tone="onPrimary">+</TotsGlyph>}
        onPress={() => navigation.navigate("BotNew")}
      />
    </TotsCard>
  );
}

/** Header "+": pick which bot gets the new routine. */
export function AddRoutineMenu(props: { readonly bots: ReadonlyArray<Bot> }) {
  const navigation = useNavigation();
  if (props.bots.length === 0) {
    return (
      <TotsIconButton
        kind="dark"
        accessibilityLabel="Hire a bot"
        onPress={() => navigation.navigate("BotNew")}
      >
        <TotsGlyph tone="onPrimary">+</TotsGlyph>
      </TotsIconButton>
    );
  }
  return (
    <Menu
      title="New routine for"
      actions={props.bots.map((bot) => ({ id: bot.id, title: bot.name }))}
      onPressAction={({ nativeEvent }) =>
        navigation.navigate("BotRoutine", { botId: nativeEvent.event })
      }
    >
      <View pointerEvents="none">
        <TotsIconButton kind="dark" accessibilityLabel="New routine" onPress={() => undefined}>
          <TotsGlyph tone="onPrimary">+</TotsGlyph>
        </TotsIconButton>
      </View>
    </Menu>
  );
}
