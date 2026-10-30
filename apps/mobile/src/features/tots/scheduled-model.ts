import type { ScheduledTask } from "@t3tools/contracts";

import type { Bot } from "../bots/bots-model";
import { ROUTINE_WEEK, formatRoutineTime, timeOfDayFromParts } from "./routine-schedule";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type EnvironmentRoutineStatus = "loading" | "offline" | "error" | "ready";

/** What one environment's subscription knows, lifted to the tab for the header and empty states. */
export interface EnvironmentRoutineReport {
  readonly status: EnvironmentRoutineStatus;
  readonly tasks: ReadonlyArray<ScheduledTask>;
}

export interface BotEnvironmentGroup {
  readonly environmentId: string;
  readonly bots: ReadonlyArray<Bot>;
}

/** Keeps the registry order, so the list does not jump around. */
export function groupBotsByEnvironment(bots: ReadonlyArray<Bot>): BotEnvironmentGroup[] {
  const groups = new Map<string, Bot[]>();
  for (const bot of bots) {
    const group = groups.get(bot.environmentId);
    if (group) group.push(bot);
    else groups.set(bot.environmentId, [bot]);
  }
  return [...groups].map(([environmentId, members]) => ({ environmentId, bots: members }));
}

/**
 * Cached data wins while the connection comes back; with nothing cached a dropped
 * server reads as offline rather than as a spinner that never ends.
 */
export function environmentRoutineStatus(input: {
  readonly phase: string | null;
  readonly hasData: boolean;
  readonly hasError: boolean;
}): EnvironmentRoutineStatus {
  const live =
    input.phase === "connected" || input.phase === "connecting" || input.phase === "reconnecting";
  if (!live) return "offline";
  if (input.hasData) return "ready";
  if (input.hasError) return "error";
  return "loading";
}

/** Routines are tasks whose runs land in the bot's main chat. */
export function routinesForBot(
  bot: Pick<Bot, "threadId">,
  tasks: ReadonlyArray<ScheduledTask>,
  now: Date,
): ScheduledTask[] {
  return tasks
    .filter((task) => task.threadId === bot.threadId)
    .sort((left, right) => compareRoutines(left, right, now));
}

function compareRoutines(left: ScheduledTask, right: ScheduledTask, now: Date): number {
  const leftNext = nextRoutineRun(left, now)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightNext = nextRoutineRun(right, now)?.getTime() ?? Number.POSITIVE_INFINITY;
  if (leftNext !== rightNext) return leftNext < rightNext ? -1 : 1;
  return left.title.localeCompare(right.title);
}

/** The server's own next run when it has one, else worked out from the schedule in device time. */
export function nextRoutineRun(task: ScheduledTask, now: Date): Date | null {
  if (!task.enabled) return null;
  if (task.nextRunAt) {
    const at = new Date(task.nextRunAt);
    if (!Number.isNaN(at.getTime())) return at;
  }
  const schedule = task.schedule;
  if (schedule.type === "fixed_time") {
    return nextFixedTime(schedule.timeOfDay, schedule.weekdays ?? [], now);
  }
  if (schedule.type === "interval") {
    const base = new Date(task.lastRunAt ?? task.createdAt).getTime();
    if (Number.isNaN(base) || schedule.everyMs <= 0) return null;
    if (base + schedule.everyMs > now.getTime()) return new Date(base + schedule.everyMs);
    const steps = Math.ceil((now.getTime() - base) / schedule.everyMs);
    const next = base + steps * schedule.everyMs;
    return new Date(next > now.getTime() ? next : next + schedule.everyMs);
  }
  return null;
}

function nextFixedTime(timeOfDay: string, weekdays: ReadonlyArray<number>, now: Date): Date {
  const [hours = 9, minutes = 0] = timeOfDay.split(":").map(Number);
  const days = new Set(weekdays.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : weekdays);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() > now.getTime() && days.has(candidate.getDay())) return candidate;
  }
  return new Date(now.getTime() + DAY);
}

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "today", "tomorrow", "Fri", or "Mar 3", from the device's calendar. */
export function formatRunDay(at: Date, now: Date): string {
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return ROUTINE_WEEK.find((entry) => entry.day === at.getDay())?.short ?? "soon";
  return `${MONTHS[at.getMonth()]} ${at.getDate()}`;
}

/** "8:00" in 24-hour time, like the schedules. */
export function formatRunTime(at: Date): string {
  return formatRoutineTime(timeOfDayFromParts(at.getHours(), at.getMinutes()));
}

/** "today at 8:00", "tomorrow at 8:00", "Fri at 17:00". */
export function formatNextRun(at: Date, now: Date): string {
  return `${formatRunDay(at, now)} at ${formatRunTime(at)}`;
}

/** The second line under a routine. */
export function routineRunLine(task: ScheduledTask, now: Date): string {
  if (!task.enabled) return "Paused";
  const next = nextRoutineRun(task, now);
  if (next) return `Next ${formatNextRun(next, now)}`;
  return task.schedule.type === "webhook" ? "Runs when the webhook fires" : "Not scheduled";
}

export interface ScheduledSummary {
  readonly botCount: number;
  readonly routineCount: number;
  readonly enabledCount: number;
  /** Some environment has not answered yet. */
  readonly loading: boolean;
  /** Every environment answered, so "no routines" is the truth. */
  readonly settled: boolean;
  readonly next: {
    readonly bot: Bot;
    readonly task: ScheduledTask;
    readonly at: Date;
  } | null;
  /** Bots on answered servers with no routine yet. */
  readonly botsWithout: ReadonlyArray<Bot>;
}

export function summarizeScheduled(input: {
  readonly bots: ReadonlyArray<Bot>;
  readonly reports: ReadonlyMap<string, EnvironmentRoutineReport>;
  readonly now: Date;
}): ScheduledSummary {
  let routineCount = 0;
  let enabledCount = 0;
  let loading = false;
  let settled = true;
  let next: ScheduledSummary["next"] = null;
  const botsWithout: Bot[] = [];
  for (const group of groupBotsByEnvironment(input.bots)) {
    const report = input.reports.get(group.environmentId);
    if (!report || report.status === "loading") loading = true;
    if (report?.status !== "ready") {
      settled = false;
      continue;
    }
    for (const bot of group.bots) {
      const routines = routinesForBot(bot, report.tasks, input.now);
      if (routines.length === 0) botsWithout.push(bot);
      routineCount += routines.length;
      for (const task of routines) {
        if (task.enabled) enabledCount += 1;
        const at = nextRoutineRun(task, input.now);
        if (at && (!next || at.getTime() < next.at.getTime())) next = { bot, task, at };
      }
    }
  }
  return {
    botCount: input.bots.length,
    routineCount,
    enabledCount,
    loading,
    settled,
    next,
    botsWithout,
  };
}

/** "5 routines · next: Ora's Morning brief at 8:00". */
export function scheduledSubtitle(summary: ScheduledSummary, now: Date): string {
  if (summary.botCount === 0) return "Routines run your bots on a schedule";
  if (summary.routineCount === 0) {
    if (summary.loading) return "Loading routines";
    return summary.settled ? "No routines yet" : "Some servers are offline";
  }
  const count = `${summary.routineCount} ${summary.routineCount === 1 ? "routine" : "routines"}`;
  if (summary.next) {
    const day = formatRunDay(summary.next.at, now);
    const when = `${day === "today" ? "" : `${day} `}at ${formatRunTime(summary.next.at)}`;
    return `${count} · next: ${summary.next.bot.name}'s ${summary.next.task.title} ${when}`;
  }
  if (summary.enabledCount === 0) return `${count} · all paused`;
  return count;
}
