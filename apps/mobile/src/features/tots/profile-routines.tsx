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
import { View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { readEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import type { Bot } from "../bots/bots-model";
import {
  ROUTINE_PRESETS,
  describeRoutineForm,
  describeRoutineSchedule,
  type RoutinePreset,
} from "./routine-schedule";
import { TotsCard, TotsText, TotsToggle } from "./ui";

/** T3 scheduled tasks whose runs land in this bot's main chat. */
export function ProfileRoutines(props: { readonly bot: Bot }) {
  const { bot } = props;
  const navigation = useNavigation();
  const environmentId = EnvironmentId.make(bot.environmentId);
  const tasks = useEnvironmentQuery(
    serverEnvironment.scheduledTasksLive({ environmentId, input: {} }),
  );
  const canOperate = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(environmentId),
  );
  const routines = (tasks.data?.tasks ?? []).filter((task) => task.threadId === bot.threadId);
  const openNew = (preset?: RoutinePreset["id"]) =>
    navigation.navigate("BotRoutine", preset ? { botId: bot.id, preset } : { botId: bot.id });

  if (tasks.error && !tasks.data) {
    return (
      <TotsCard tone="sunken">
        <TotsText variant="small" tone="red">
          {tasks.error}
        </TotsText>
      </TotsCard>
    );
  }
  if (!tasks.data) {
    return (
      <TotsText variant="small" tone="muted" style={{ textAlign: "center", padding: 12 }}>
        Loading routines
      </TotsText>
    );
  }

  return (
    <>
      {routines.map((task) => (
        <RoutineRow
          key={task.id}
          task={task}
          environmentId={environmentId}
          canOperate={canOperate}
          onPress={() => navigation.navigate("BotRoutine", { botId: bot.id, taskId: task.id })}
        />
      ))}
      {routines.length === 0 ? (
        <>
          <TotsText variant="small" tone="muted" style={{ paddingHorizontal: 6 }}>
            {`Routines run ${bot.name} on a schedule. Results show up in the main chat. Try one:`}
          </TotsText>
          {ROUTINE_PRESETS.map((preset) => (
            <TotsCard
              key={preset.id}
              tone="sunken"
              onPress={canOperate ? () => openNew(preset.id) : undefined}
              accessibilityLabel={`${preset.name}, ${describeRoutineForm(preset.schedule)}`}
              style={{ gap: 2 }}
            >
              <TotsText style={{ fontWeight: "600" }}>{`${preset.glyph} ${preset.name}`}</TotsText>
              <TotsText variant="small" tone="muted">
                {describeRoutineForm(preset.schedule)}
              </TotsText>
            </TotsCard>
          ))}
        </>
      ) : null}
      <TotsCard
        onPress={canOperate ? () => openNew() : undefined}
        accessibilityLabel="New routine"
        style={{ alignItems: "center", opacity: canOperate ? 1 : 0.5 }}
      >
        <TotsText tone="blue" style={{ fontWeight: "700" }}>
          + New routine
        </TotsText>
      </TotsCard>
      {canOperate ? null : (
        <TotsText variant="small" tone="muted" style={{ textAlign: "center" }}>
          This connection cannot change routines.
        </TotsText>
      )}
    </>
  );
}

function RoutineRow(props: {
  readonly task: ScheduledTask;
  readonly environmentId: EnvironmentId;
  readonly canOperate: boolean;
  readonly onPress: () => void;
}) {
  const { task, environmentId } = props;
  const setEnabled = useAtomCommand(serverEnvironment.setScheduledTaskEnabled, {
    label: "bot routine enabled",
    reportFailure: false,
  });
  // Shows the flip at once and keeps it until the live list agrees.
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  if (pending !== null && task.enabled === pending) setPending(null);
  const enabled = pending ?? task.enabled;

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
      accessibilityLabel={`${task.title}, ${describeRoutineSchedule(task.schedule)}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <TotsText style={{ fontWeight: "600" }} numberOfLines={1}>
          {task.title}
        </TotsText>
        <TotsText variant="small" tone="muted" numberOfLines={1}>
          {describeRoutineSchedule(task.schedule)}
        </TotsText>
        {task.lastRunError ? (
          <TotsText variant="small" tone="red" numberOfLines={1}>
            {`Last run failed: ${task.lastRunError}`}
          </TotsText>
        ) : null}
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
