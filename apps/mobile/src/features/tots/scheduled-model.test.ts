import type { ScheduledTask, ScheduledTaskSchedule } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { Bot } from "../bots/bots-model";
import {
  environmentRoutineStatus,
  formatNextRun,
  groupBotsByEnvironment,
  nextRoutineRun,
  routineRunLine,
  routinesForBot,
  scheduledSubtitle,
  summarizeScheduled,
  type EnvironmentRoutineReport,
} from "./scheduled-model";

// Wednesday 28 October 2026, 7:00 device time.
const NOW = new Date(2026, 9, 28, 7, 0);

function bot(id: string, name: string, environmentId = "env-a"): Bot {
  return {
    id,
    name,
    role: "",
    environmentId,
    threadId: `thread-${id}`,
    setupMessageId: "setup",
    createdAt: "2026-10-01T00:00:00.000Z",
  };
}

function task(input: {
  readonly id: string;
  readonly title: string;
  readonly threadId: string | null;
  readonly schedule: ScheduledTaskSchedule;
  readonly enabled?: boolean;
  readonly nextRunAt?: string | null;
  readonly lastRunAt?: string | null;
}): ScheduledTask {
  return {
    id: input.id,
    title: input.title,
    enabled: input.enabled ?? true,
    schedule: input.schedule,
    threadId: input.threadId,
    nextRunAt: input.nextRunAt ?? null,
    lastRunAt: input.lastRunAt ?? null,
    createdAt: new Date(2026, 9, 27, 10, 0).toISOString(),
  } as unknown as ScheduledTask;
}

const ready = (tasks: ReadonlyArray<ScheduledTask>): EnvironmentRoutineReport => ({
  status: "ready",
  tasks,
});

describe("groupBotsByEnvironment", () => {
  it("groups by server in registry order", () => {
    const groups = groupBotsByEnvironment([
      bot("ora", "Ora"),
      bot("rex", "Rex", "env-b"),
      bot("ivy", "Ivy"),
    ]);
    expect(groups.map((group) => [group.environmentId, group.bots.map((b) => b.id)])).toEqual([
      ["env-a", ["ora", "ivy"]],
      ["env-b", ["rex"]],
    ]);
  });
});

describe("environmentRoutineStatus", () => {
  it("keeps cached routines while reconnecting and calls a dead server offline", () => {
    expect(environmentRoutineStatus({ phase: "connected", hasData: true, hasError: false })).toBe(
      "ready",
    );
    expect(
      environmentRoutineStatus({ phase: "reconnecting", hasData: true, hasError: false }),
    ).toBe("ready");
    expect(environmentRoutineStatus({ phase: "connecting", hasData: false, hasError: false })).toBe(
      "loading",
    );
    expect(environmentRoutineStatus({ phase: "connected", hasData: false, hasError: true })).toBe(
      "error",
    );
    expect(environmentRoutineStatus({ phase: "offline", hasData: true, hasError: false })).toBe(
      "offline",
    );
    expect(environmentRoutineStatus({ phase: null, hasData: false, hasError: false })).toBe(
      "offline",
    );
  });
});

describe("nextRoutineRun", () => {
  it("trusts the server's next run", () => {
    const at = new Date(2026, 9, 28, 12, 30);
    expect(
      nextRoutineRun(
        task({
          id: "t",
          title: "Brief",
          threadId: null,
          schedule: { type: "fixed_time", timeOfDay: "08:00" },
          nextRunAt: at.toISOString(),
        }),
        NOW,
      ),
    ).toEqual(at);
  });

  it("finds the next fixed time, skipping days off", () => {
    const daily = task({
      id: "t",
      title: "Brief",
      threadId: null,
      schedule: { type: "fixed_time", timeOfDay: "08:00" },
    });
    expect(nextRoutineRun(daily, NOW)).toEqual(new Date(2026, 9, 28, 8, 0));
    const early = task({
      id: "t",
      title: "Brief",
      threadId: null,
      schedule: { type: "fixed_time", timeOfDay: "06:00" },
    });
    expect(nextRoutineRun(early, NOW)).toEqual(new Date(2026, 9, 29, 6, 0));
    const friday = task({
      id: "t",
      title: "Summary",
      threadId: null,
      schedule: { type: "fixed_time", timeOfDay: "17:00", weekdays: [5] },
    });
    expect(nextRoutineRun(friday, NOW)).toEqual(new Date(2026, 9, 30, 17, 0));
  });

  it("counts intervals from the last run", () => {
    const hourly = task({
      id: "t",
      title: "Check",
      threadId: null,
      schedule: { type: "interval", everyMs: 3_600_000 },
      lastRunAt: new Date(2026, 9, 28, 6, 30).toISOString(),
    });
    expect(nextRoutineRun(hourly, NOW)).toEqual(new Date(2026, 9, 28, 7, 30));
    const stale = task({
      id: "t",
      title: "Check",
      threadId: null,
      schedule: { type: "interval", everyMs: 3_600_000 },
      lastRunAt: new Date(2026, 9, 28, 2, 15).toISOString(),
    });
    expect(nextRoutineRun(stale, NOW)).toEqual(new Date(2026, 9, 28, 7, 15));
  });

  it("has none for paused routines and webhooks", () => {
    expect(
      nextRoutineRun(
        task({
          id: "t",
          title: "Brief",
          threadId: null,
          schedule: { type: "fixed_time", timeOfDay: "08:00" },
          enabled: false,
        }),
        NOW,
      ),
    ).toBeNull();
    const hook = task({
      id: "t",
      title: "PR review",
      threadId: null,
      schedule: { type: "webhook", signature: null },
    });
    expect(nextRoutineRun(hook, NOW)).toBeNull();
    expect(routineRunLine(hook, NOW)).toBe("Runs when the webhook fires");
  });
});

describe("formatNextRun", () => {
  it("reads as a day and a time", () => {
    expect(formatNextRun(new Date(2026, 9, 28, 8, 0), NOW)).toBe("today at 8:00");
    expect(formatNextRun(new Date(2026, 9, 29, 9, 5), NOW)).toBe("tomorrow at 9:05");
    expect(formatNextRun(new Date(2026, 9, 30, 17, 0), NOW)).toBe("Fri at 17:00");
    expect(formatNextRun(new Date(2026, 10, 9, 17, 0), NOW)).toBe("Nov 9 at 17:00");
  });
});

describe("summary", () => {
  const ora = bot("ora", "Ora");
  const rex = bot("rex", "Rex");
  const ivy = bot("ivy", "Ivy", "env-b");
  const brief = task({
    id: "brief",
    title: "Morning brief",
    threadId: ora.threadId,
    schedule: { type: "fixed_time", timeOfDay: "08:00" },
  });
  const summary = task({
    id: "summary",
    title: "Weekly summary",
    threadId: ora.threadId,
    schedule: { type: "fixed_time", timeOfDay: "17:00", weekdays: [5] },
  });
  const stranger = task({
    id: "other",
    title: "Someone else",
    threadId: "thread-not-a-bot",
    schedule: { type: "fixed_time", timeOfDay: "07:30" },
  });

  it("only counts tasks that land in a bot's main chat, soonest first", () => {
    expect(routinesForBot(ora, [summary, stranger, brief], NOW).map((t) => t.id)).toEqual([
      "brief",
      "summary",
    ]);
  });

  it("names the next run across bots", () => {
    const result = summarizeScheduled({
      bots: [ora, rex],
      reports: new Map([["env-a", ready([summary, brief, stranger])]]),
      now: NOW,
    });
    expect(result.routineCount).toBe(2);
    expect(result.botsWithout.map((b) => b.id)).toEqual(["rex"]);
    expect(scheduledSubtitle(result, NOW)).toBe("2 routines · next: Ora's Morning brief at 8:00");
  });

  it("says when the next run is not today, or when all are paused", () => {
    const later = summarizeScheduled({
      bots: [ora],
      reports: new Map([["env-a", ready([summary])]]),
      now: NOW,
    });
    expect(scheduledSubtitle(later, NOW)).toBe(
      "1 routine · next: Ora's Weekly summary Fri at 17:00",
    );
    const paused = summarizeScheduled({
      bots: [ora],
      reports: new Map([["env-a", ready([{ ...summary, enabled: false }])]]),
      now: NOW,
    });
    expect(scheduledSubtitle(paused, NOW)).toBe("1 routine · all paused");
  });

  it("only settles on no routines once every server answered", () => {
    const waiting = summarizeScheduled({
      bots: [ora, ivy],
      reports: new Map([["env-a", ready([])]]),
      now: NOW,
    });
    expect(waiting).toMatchObject({ loading: true, settled: false });
    expect(scheduledSubtitle(waiting, NOW)).toBe("Loading routines");
    const offline = summarizeScheduled({
      bots: [ora, ivy],
      reports: new Map([
        ["env-a", ready([])],
        ["env-b", { status: "offline", tasks: [] }],
      ]),
      now: NOW,
    });
    expect(offline).toMatchObject({ loading: false, settled: false });
    expect(offline.botsWithout.map((b) => b.id)).toEqual(["ora"]);
    expect(scheduledSubtitle(offline, NOW)).toBe("Some servers are offline");
    const none = summarizeScheduled({
      bots: [ora],
      reports: new Map([["env-a", ready([stranger])]]),
      now: NOW,
    });
    expect(none.settled).toBe(true);
    expect(scheduledSubtitle(none, NOW)).toBe("No routines yet");
  });
});
