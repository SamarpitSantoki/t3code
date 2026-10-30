import { useAtomValue } from "@effect/atom-react";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  EnvironmentId,
  type ScheduledTask,
} from "@t3tools/contracts";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { readEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import type { Bot } from "../bots/bots-model";
import { useBotRegistry, useBotThreadTarget } from "../bots/bots-state";
import { buildRoutineUpsertInput } from "./routine-input";
import {
  DEFAULT_ROUTINE_SCHEDULE,
  ROUTINE_INTERVAL_STEPS,
  ROUTINE_PRESETS,
  ROUTINE_WEEK,
  findRoutinePreset,
  formatRoutineInterval,
  formatRoutineTime,
  routineFormFromSchedule,
  stepRoutineInterval,
  timeOfDayFromParts,
  timeOfDayParts,
  toggleRoutineDay,
  type RoutinePreset,
  type RoutineRepeat,
  type RoutineScheduleForm,
} from "./routine-schedule";
import {
  TotsField,
  TotsFormScreen,
  TotsFormSection,
  TotsMessageScreen,
  TotsScreenOptions,
  TotsSegmented,
  TotsStepper,
} from "./profile-ui";
import { useTotsColors } from "./theme";
import { TotsButton, TotsCard, TotsText, TotsToggle } from "./ui";

type BotRoutineScreenProps = StaticScreenProps<{
  readonly botId: string;
  readonly taskId?: string;
  /** A ROUTINE_PRESETS id to start a new routine from. */
  readonly preset?: string;
}>;

const REPEAT_OPTIONS: ReadonlyArray<{ readonly id: RoutineRepeat; readonly label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "interval", label: "Interval" },
];

export function BotRoutineScreen({ route }: BotRoutineScreenProps) {
  const { registry, loaded } = useBotRegistry();
  const bot = registry.bots.find((candidate) => candidate.id === route.params.botId) ?? null;
  if (!bot) {
    return (
      <>
        <TotsScreenOptions title="Routine" />
        <TotsMessageScreen
          title={loaded ? "Bot not found" : "Loading"}
          detail={loaded ? "This bot was removed." : undefined}
        />
      </>
    );
  }
  return (
    <RoutineLoader
      bot={bot}
      taskId={route.params.taskId ?? null}
      preset={findRoutinePreset(route.params.preset)}
    />
  );
}

function RoutineLoader(props: {
  readonly bot: Bot;
  readonly taskId: string | null;
  readonly preset: RoutinePreset | null;
}) {
  const environmentId = EnvironmentId.make(props.bot.environmentId);
  const tasks = useEnvironmentQuery(
    serverEnvironment.scheduledTasksLive({ environmentId, input: {} }),
  );
  if (props.taskId === null) {
    return <RoutineForm bot={props.bot} task={null} preset={props.preset} />;
  }
  const task = tasks.data?.tasks.find((candidate) => candidate.id === props.taskId) ?? null;
  if (!task) {
    return (
      <>
        <TotsScreenOptions title="Routine" />
        <TotsMessageScreen
          title={
            tasks.error ? "Could not load routine" : tasks.data ? "Routine not found" : "Loading"
          }
          detail={tasks.error ?? (tasks.data ? "It may have been deleted." : undefined)}
        />
      </>
    );
  }
  return <RoutineForm key={task.id} bot={props.bot} task={task} preset={null} />;
}

function RoutineForm(props: {
  readonly bot: Bot;
  readonly task: ScheduledTask | null;
  readonly preset: RoutinePreset | null;
}) {
  const { bot, task } = props;
  const preset = task ? null : props.preset;
  const navigation = useNavigation();
  const colors = useTotsColors();
  const environmentId = EnvironmentId.make(bot.environmentId);
  const target = useBotThreadTarget(bot);
  const canOperate = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(environmentId),
  );
  const upsert = useAtomCommand(serverEnvironment.upsertScheduledTask, {
    label: "bot routine upsert",
    reportFailure: false,
  });
  const remove = useAtomCommand(serverEnvironment.deleteScheduledTask, {
    label: "bot routine delete",
    reportFailure: false,
  });
  const setTaskEnabled = useAtomCommand(serverEnvironment.setScheduledTaskEnabled, {
    label: "bot routine enabled",
    reportFailure: false,
  });
  const initialSchedule = task
    ? routineFormFromSchedule(task.schedule)
    : (preset?.schedule ?? DEFAULT_ROUTINE_SCHEDULE);
  const [name, setName] = useState(task?.title ?? preset?.name ?? "");
  const [prompt, setPrompt] = useState(task?.prompt ?? preset?.prompt ?? "");
  const [schedule, setSchedule] = useState<RoutineScheduleForm>(
    initialSchedule ?? DEFAULT_ROUTINE_SCHEDULE,
  );
  const [enabled, setEnabled] = useState(task?.enabled ?? true);
  const [presetId, setPresetId] = useState<RoutinePreset["id"] | null>(preset?.id ?? null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const editable = initialSchedule !== null;

  const failure = (title: string, result: AtomCommandResult<unknown, unknown>) => {
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      Dialog.alert(title, String(squashAtomCommandFailure(result)));
    }
  };

  const applyPreset = (preset: RoutinePreset) => {
    setPresetId(preset.id);
    setName(preset.name);
    setPrompt(preset.prompt);
    setSchedule(preset.schedule);
  };

  const save = async () => {
    if (busy || !editable) return;
    if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) {
      Dialog.alert("Not allowed", "This connection cannot change routines.");
      return;
    }
    const built = buildRoutineUpsertInput({
      draft: { name, prompt, schedule, enabled },
      botThreadId: bot.threadId,
      target: target
        ? {
            projectId: target.project.id,
            modelSelection: target.modelSelection,
            runtimeMode: target.runtimeMode,
          }
        : null,
      existing: task,
    });
    if (!built.ok) {
      Dialog.alert("Almost there", built.reason);
      return;
    }
    setBusy(true);
    const result = await upsert({ environmentId, input: built.input });
    setBusy(false);
    if (result._tag === "Failure") {
      failure("Could not save routine", result);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const changeEnabled = async (next: boolean) => {
    // Save is off for schedules this form cannot edit, so the toggle saves on its own.
    if (editable || !task) {
      setEnabled(next);
      return;
    }
    if (busy) return;
    if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) {
      Dialog.alert("Not allowed", "This connection cannot change routines.");
      return;
    }
    setEnabled(next);
    setBusy(true);
    const result = await setTaskEnabled({ environmentId, input: { id: task.id, enabled: next } });
    setBusy(false);
    if (result._tag === "Failure") {
      setEnabled(!next);
      failure("Could not update routine", result);
    }
  };

  const confirmDelete = () => {
    if (!task || busy) return;
    Dialog.confirm({
      title: `Delete ${task.title}?`,
      message: `${bot.name} stops running it. Past results stay in the chat.`,
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        void (async () => {
          if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) {
            Dialog.alert("Not allowed", "This connection cannot change routines.");
            return;
          }
          setBusy(true);
          const result = await remove({ environmentId, input: { id: task.id } });
          setBusy(false);
          if (result._tag === "Failure") {
            failure("Could not delete routine", result);
            return;
          }
          navigation.goBack();
        })();
      },
    });
  };

  const time = timeOfDayParts(schedule.timeOfDay);
  const pickerValue = new Date(2000, 0, 1, time.hours, time.minutes);

  return (
    <>
      <TotsScreenOptions title={task ? "Edit routine" : "New routine"} />
      <TotsFormScreen
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            {task ? (
              <TotsButton
                label="Delete"
                kind="danger"
                size="large"
                disabled={!canOperate || busy}
                onPress={confirmDelete}
              />
            ) : null}
            <TotsButton
              label={task ? "Save" : "Add routine"}
              size="large"
              grow
              loading={busy}
              disabled={!canOperate || !editable}
              onPress={() => void save()}
            />
          </View>
        }
      >
        {!canOperate ? (
          <View style={{ paddingHorizontal: 20 }}>
            <TotsCard tone="amber">
              <TotsText variant="small" style={{ color: colors.amberInk }}>
                This connection cannot change routines.
              </TotsText>
            </TotsCard>
          </View>
        ) : null}

        {task ? null : (
          <TotsFormSection title="Start from" flush>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
            >
              {ROUTINE_PRESETS.map((preset) => (
                <PresetChip
                  key={preset.id}
                  preset={preset}
                  selected={preset.id === presetId}
                  onPress={() => applyPreset(preset)}
                />
              ))}
            </ScrollView>
          </TotsFormSection>
        )}

        <TotsFormSection title="Name">
          <TotsField
            value={name}
            onChangeText={(next) => {
              setName(next);
              setPresetId(null);
            }}
            placeholder="Morning brief"
            autoCapitalize="sentences"
            maxLength={80}
            editable={!busy}
            large
          />
        </TotsFormSection>

        <TotsFormSection title={`What should ${bot.name} do?`}>
          <TotsField
            value={prompt}
            onChangeText={(next) => {
              setPrompt(next);
              setPresetId(null);
            }}
            placeholder="Check open pull requests and tell me which need me."
            multiline
            editable={!busy}
            hint={`Runs in ${bot.name}'s main chat, so you see each result there.`}
          />
        </TotsFormSection>

        <TotsFormSection title="Schedule">
          {editable ? (
            <>
              <TotsSegmented
                options={REPEAT_OPTIONS}
                value={schedule.repeat}
                disabled={busy}
                onChange={(repeat) => setSchedule({ ...schedule, repeat })}
              />
              {schedule.repeat === "weekly" ? (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {ROUTINE_WEEK.map((entry) => (
                    <DayChip
                      key={entry.day}
                      label={entry.short}
                      selected={schedule.days.includes(entry.day)}
                      onPress={() =>
                        setSchedule({
                          ...schedule,
                          days: toggleRoutineDay(schedule.days, entry.day),
                        })
                      }
                    />
                  ))}
                </View>
              ) : null}
              {schedule.repeat === "interval" ? (
                <TotsStepper
                  label="interval"
                  value={formatRoutineInterval(schedule.everyMs)}
                  canDecrease={schedule.everyMs > ROUTINE_INTERVAL_STEPS[0]}
                  canIncrease={schedule.everyMs < ROUTINE_INTERVAL_STEPS.at(-1)!}
                  onStep={(direction) =>
                    setSchedule({
                      ...schedule,
                      everyMs: stepRoutineInterval(schedule.everyMs, direction),
                    })
                  }
                />
              ) : (
                <TotsCard
                  onPress={() => setTimePickerOpen(!timePickerOpen)}
                  accessibilityLabel={`Time, ${formatRoutineTime(schedule.timeOfDay)}`}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  <TotsText style={{ flex: 1 }}>Time</TotsText>
                  <TotsText variant="heading">{formatRoutineTime(schedule.timeOfDay)}</TotsText>
                </TotsCard>
              )}
              {timePickerOpen && schedule.repeat !== "interval" ? (
                <DateTimePicker
                  value={pickerValue}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onDismiss={() => setTimePickerOpen(false)}
                  onValueChange={(_, selected) => {
                    if (Platform.OS === "android") setTimePickerOpen(false);
                    setSchedule({
                      ...schedule,
                      timeOfDay: timeOfDayFromParts(selected.getHours(), selected.getMinutes()),
                    });
                  }}
                />
              ) : null}
              {schedule.repeat === "interval" ? null : (
                <TotsText variant="small" tone="muted" style={{ paddingHorizontal: 6 }}>
                  Runs on your T3 server's clock.
                </TotsText>
              )}
            </>
          ) : (
            <TotsCard tone="sunken">
              <TotsText variant="small" tone="muted">
                This routine runs on a webhook. Change its schedule in T3 settings.
              </TotsText>
            </TotsCard>
          )}
        </TotsFormSection>

        <View style={{ paddingHorizontal: 20 }}>
          <TotsCard style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <TotsText>On</TotsText>
              <TotsText variant="small" tone="muted">
                {enabled ? "Runs on schedule" : "Paused"}
              </TotsText>
            </View>
            <TotsToggle
              accessibilityLabel="Routine on"
              value={enabled}
              disabled={busy || (!editable && !canOperate)}
              onChange={(next) => void changeEnabled(next)}
            />
          </TotsCard>
        </View>
      </TotsFormScreen>
    </>
  );
}

function PresetChip(props: {
  readonly preset: RoutinePreset;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      accessibilityLabel={props.preset.name}
      onPress={() => {
        void Haptics.selectionAsync();
        props.onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        minHeight: 38,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: props.selected ? colors.primary : colors.line,
        backgroundColor: props.selected ? colors.primary : colors.card,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <TotsText variant="label" tone={props.selected ? "onPrimary" : "ink"}>
        {`${props.preset.glyph} ${props.preset.name}`}
      </TotsText>
    </Pressable>
  );
}

function DayChip(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const colors = useTotsColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.selected }}
      accessibilityLabel={props.label}
      onPress={() => {
        void Haptics.selectionAsync();
        props.onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: props.selected ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: props.selected ? colors.primary : colors.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <TotsText variant="small" tone={props.selected ? "onPrimary" : "inkSoft"}>
        {props.label}
      </TotsText>
    </Pressable>
  );
}
