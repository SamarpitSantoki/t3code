import {
  ProjectId,
  ProviderInstanceId,
  ScheduledTaskId,
  ThreadId,
  type ScheduledTask,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildRoutineUpsertInput } from "./routine-input";
import {
  DEFAULT_ROUTINE_SCHEDULE,
  ROUTINE_INTERVAL_STEPS,
  ROUTINE_PRESETS,
  describeRoutineForm,
  describeRoutineSchedule,
  findRoutinePreset,
  formatRoutineInterval,
  routineFormFromSchedule,
  routineScheduleFromForm,
  stepRoutineInterval,
  toggleRoutineDay,
} from "./routine-schedule";

const HOUR = 3_600_000;

describe("describeRoutineSchedule", () => {
  it("reads like a person would say it", () => {
    expect(describeRoutineSchedule({ type: "fixed_time", timeOfDay: "08:00" })).toBe(
      "Every day · 8:00",
    );
    expect(
      describeRoutineSchedule({
        type: "fixed_time",
        timeOfDay: "09:05",
        weekdays: [5, 1, 2, 3, 4],
      }),
    ).toBe("Weekdays · 9:05");
    expect(describeRoutineSchedule({ type: "fixed_time", timeOfDay: "17:00", weekdays: [5] })).toBe(
      "Fridays · 17:00",
    );
    expect(
      describeRoutineSchedule({ type: "fixed_time", timeOfDay: "10:30", weekdays: [3, 1] }),
    ).toBe("Mon, Wed · 10:30");
    expect(
      describeRoutineSchedule({ type: "fixed_time", timeOfDay: "10:30", weekdays: [6, 0] }),
    ).toBe("Weekends · 10:30");
    expect(describeRoutineSchedule({ type: "interval", everyMs: 2 * HOUR })).toBe("Every 2 hours");
    expect(describeRoutineSchedule({ type: "webhook", signature: null })).toBe("On webhook");
  });

  it("formats intervals in their largest whole unit", () => {
    expect(formatRoutineInterval(HOUR)).toBe("Every hour");
    expect(formatRoutineInterval(30 * 60_000)).toBe("Every 30 minutes");
    expect(formatRoutineInterval(90 * 60_000)).toBe("Every 90 minutes");
  });
});

describe("routine schedule form", () => {
  it("round-trips each repeat kind", () => {
    for (const schedule of [
      { type: "fixed_time", timeOfDay: "08:00" },
      { type: "fixed_time", timeOfDay: "09:00", weekdays: [1, 2, 3, 4, 5] },
      { type: "fixed_time", timeOfDay: "17:00", weekdays: [1, 5] },
      { type: "interval", everyMs: 3 * HOUR },
    ] as const) {
      const form = routineFormFromSchedule(schedule);
      expect(form).not.toBeNull();
      expect(routineScheduleFromForm(form!)).toEqual(schedule);
    }
  });

  it("treats all seven days as daily and pads short times", () => {
    const form = routineFormFromSchedule({
      type: "fixed_time",
      timeOfDay: "7:05",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(form?.repeat).toBe("daily");
    expect(form?.timeOfDay).toBe("07:05");
  });

  it("snaps intervals under a minute to the shortest step so they can save", () => {
    const form = routineFormFromSchedule({ type: "interval", everyMs: 30_000 });
    expect(form?.everyMs).toBe(ROUTINE_INTERVAL_STEPS[0]);
    expect(routineScheduleFromForm(form!)).toEqual({
      type: "interval",
      everyMs: ROUTINE_INTERVAL_STEPS[0],
    });
    expect(routineFormFromSchedule({ type: "interval", everyMs: 90 * 60_000 })?.everyMs).toBe(
      90 * 60_000,
    );
  });

  it("finds presets by id", () => {
    expect(findRoutinePreset("daily-standup")?.name).toBe("Daily standup");
    expect(findRoutinePreset("nope")).toBeNull();
    expect(findRoutinePreset(undefined)).toBeNull();
  });

  it("does not edit webhook schedules", () => {
    expect(routineFormFromSchedule({ type: "webhook", signature: null })).toBeNull();
  });

  it("needs a day for weekly routines", () => {
    expect(
      routineScheduleFromForm({ ...DEFAULT_ROUTINE_SCHEDULE, repeat: "weekly", days: [] }),
    ).toBeNull();
  });

  it("steps intervals and snaps odd values to the next step", () => {
    expect(stepRoutineInterval(HOUR, 1)).toBe(2 * HOUR);
    expect(stepRoutineInterval(HOUR, -1)).toBe(30 * 60_000);
    expect(stepRoutineInterval(90 * 60_000, 1)).toBe(2 * HOUR);
    expect(stepRoutineInterval(90 * 60_000, -1)).toBe(HOUR);
    expect(stepRoutineInterval(24 * HOUR, 1)).toBe(24 * HOUR);
    expect(stepRoutineInterval(15 * 60_000, -1)).toBe(15 * 60_000);
  });

  it("toggles days in week order", () => {
    expect(toggleRoutineDay([5], 1)).toEqual([1, 5]);
    expect(toggleRoutineDay([1, 5], 5)).toEqual([1]);
    expect(toggleRoutineDay([1], 0)).toEqual([1, 0]);
  });

  it("describes forms, including an unfinished weekly one", () => {
    expect(describeRoutineForm(ROUTINE_PRESETS[2]!.schedule)).toBe("Fridays · 17:00");
    expect(describeRoutineForm({ ...DEFAULT_ROUTINE_SCHEDULE, repeat: "weekly", days: [] })).toBe(
      "Pick a day",
    );
  });

  it("ships presets that save as valid schedules", () => {
    for (const preset of ROUTINE_PRESETS) {
      expect(routineScheduleFromForm(preset.schedule)).not.toBeNull();
    }
  });
});

describe("buildRoutineUpsertInput", () => {
  const target = {
    projectId: ProjectId.make("project-1"),
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
  } as const;
  const draft = {
    name: " Morning brief ",
    prompt: " Brief me ",
    schedule: { ...DEFAULT_ROUTINE_SCHEDULE, timeOfDay: "08:00" },
    enabled: true,
  };

  it("binds a new routine to the bot's main chat", () => {
    const result = buildRoutineUpsertInput({
      draft,
      botThreadId: "thread-1",
      target,
      existing: null,
    });
    expect(result).toEqual({
      ok: true,
      input: {
        title: "Morning brief",
        prompt: "Brief me",
        enabled: true,
        schedule: { type: "fixed_time", timeOfDay: "08:00" },
        projectId: target.projectId,
        modelSelection: target.modelSelection,
        runtimeMode: "full-access",
        threadId: ThreadId.make("thread-1"),
        workspaceStrategy: { type: "root" },
        interactionMode: "default",
        creationSource: "mobile",
      },
    });
  });

  it("edits require the task to still exist and keep its own fields", () => {
    const existing = {
      id: ScheduledTaskId.make("task-1"),
      projectId: ProjectId.make("project-old"),
      modelSelection: target.modelSelection,
      runtimeMode: "approval-required",
      interactionMode: "plan",
      creationSource: "web",
      workspaceStrategy: { type: "worktree", baseRef: "main" },
    } as unknown as ScheduledTask;
    const result = buildRoutineUpsertInput({
      draft,
      botThreadId: "thread-1",
      target: null,
      existing,
    });
    expect(result.ok && result.input).toMatchObject({
      id: "task-1",
      requireExisting: true,
      projectId: "project-old",
      runtimeMode: "approval-required",
      interactionMode: "plan",
      creationSource: "web",
      workspaceStrategy: { type: "worktree", baseRef: "main" },
    });
  });

  it("explains what is missing", () => {
    expect(
      buildRoutineUpsertInput({
        draft: { ...draft, prompt: " " },
        botThreadId: "thread-1",
        target,
        existing: null,
      }),
    ).toEqual({ ok: false, reason: "Say what the bot should do." });
    expect(
      buildRoutineUpsertInput({
        draft: {
          ...draft,
          schedule: { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "interval", everyMs: 0 },
        },
        botThreadId: "thread-1",
        target,
        existing: null,
      }),
    ).toEqual({ ok: false, reason: "Pick an interval of at least a minute." });
    expect(
      buildRoutineUpsertInput({ draft, botThreadId: "thread-1", target: null, existing: null }).ok,
    ).toBe(false);
  });
});
