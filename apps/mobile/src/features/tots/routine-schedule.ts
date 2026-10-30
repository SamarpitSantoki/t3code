import type { ScheduledTaskSchedule, ScheduledTaskUpsertSchedule } from "@t3tools/contracts";

export type RoutineRepeat = "daily" | "weekdays" | "weekly" | "interval";

export interface RoutineScheduleForm {
  readonly repeat: RoutineRepeat;
  /** "HH:MM", 24-hour. */
  readonly timeOfDay: string;
  /** Days for "weekly": 0 is Sunday, 6 is Saturday. */
  readonly days: ReadonlyArray<number>;
  readonly everyMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const ROUTINE_INTERVAL_STEPS = [
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  4 * HOUR,
  6 * HOUR,
  8 * HOUR,
  12 * HOUR,
  24 * HOUR,
] as const;

export const DEFAULT_ROUTINE_SCHEDULE: RoutineScheduleForm = {
  repeat: "daily",
  timeOfDay: "09:00",
  days: [1],
  everyMs: 2 * HOUR,
};

/** Monday first, the way people read a week. */
export const ROUTINE_WEEK = [
  { day: 1, short: "Mon", plural: "Mondays" },
  { day: 2, short: "Tue", plural: "Tuesdays" },
  { day: 3, short: "Wed", plural: "Wednesdays" },
  { day: 4, short: "Thu", plural: "Thursdays" },
  { day: 5, short: "Fri", plural: "Fridays" },
  { day: 6, short: "Sat", plural: "Saturdays" },
  { day: 0, short: "Sun", plural: "Sundays" },
] as const;

const WEEKDAYS = [1, 2, 3, 4, 5] as const;

function sameDays(left: ReadonlyArray<number>, right: ReadonlyArray<number>) {
  const set = new Set(left);
  return set.size === right.length && right.every((day) => set.has(day));
}

function sortDays(days: ReadonlyArray<number>) {
  return ROUTINE_WEEK.map((entry) => entry.day).filter((day) => days.includes(day));
}

/** Null for schedules this form cannot edit, such as webhooks. */
export function routineFormFromSchedule(
  schedule: ScheduledTaskSchedule,
): RoutineScheduleForm | null {
  if (schedule.type === "interval") {
    // The server allows less than a minute; the form does not, so snap to the shortest step.
    const everyMs = schedule.everyMs < MINUTE ? ROUTINE_INTERVAL_STEPS[0] : schedule.everyMs;
    return { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "interval", everyMs };
  }
  if (schedule.type !== "fixed_time") return null;
  const timeOfDay = normalizeTimeOfDay(schedule.timeOfDay);
  const days = schedule.weekdays ?? [];
  if (days.length === 0 || new Set(days).size === 7) {
    return { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "daily", timeOfDay };
  }
  if (sameDays(days, WEEKDAYS)) {
    return { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "weekdays", timeOfDay };
  }
  return { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "weekly", timeOfDay, days: sortDays(days) };
}

/** Null when the form is not valid yet, such as a weekly routine with no days. */
export function routineScheduleFromForm(
  form: RoutineScheduleForm,
): ScheduledTaskUpsertSchedule | null {
  switch (form.repeat) {
    case "interval":
      return form.everyMs >= MINUTE ? { type: "interval", everyMs: form.everyMs } : null;
    case "daily":
      return { type: "fixed_time", timeOfDay: form.timeOfDay };
    case "weekdays":
      return { type: "fixed_time", timeOfDay: form.timeOfDay, weekdays: [...WEEKDAYS] };
    case "weekly":
      return form.days.length === 0
        ? null
        : { type: "fixed_time", timeOfDay: form.timeOfDay, weekdays: sortDays(form.days) };
  }
}

export function normalizeTimeOfDay(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "09:00";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeOfDayFromParts(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeOfDayParts(value: string): {
  readonly hours: number;
  readonly minutes: number;
} {
  const [hours, minutes] = normalizeTimeOfDay(value).split(":").map(Number);
  return { hours: hours ?? 9, minutes: minutes ?? 0 };
}

/** "08:00" reads as "8:00". */
export function formatRoutineTime(value: string): string {
  const { hours, minutes } = timeOfDayParts(value);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatRoutineInterval(everyMs: number): string {
  if (everyMs % HOUR === 0) {
    const hours = everyMs / HOUR;
    if (hours === 1) return "Every hour";
    if (hours === 24) return "Every day";
    return `Every ${hours} hours`;
  }
  if (everyMs % MINUTE === 0) {
    const minutes = everyMs / MINUTE;
    return minutes === 1 ? "Every minute" : `Every ${minutes} minutes`;
  }
  return `Every ${Math.max(1, Math.round(everyMs / 1000))} seconds`;
}

export function formatRoutineDays(days: ReadonlyArray<number>): string {
  const unique = sortDays(days);
  if (unique.length === 0 || unique.length === 7) return "Every day";
  if (sameDays(unique, WEEKDAYS)) return "Weekdays";
  if (sameDays(unique, [0, 6])) return "Weekends";
  if (unique.length === 1) {
    return ROUTINE_WEEK.find((entry) => entry.day === unique[0])?.plural ?? "Weekly";
  }
  return unique
    .map((day) => ROUTINE_WEEK.find((entry) => entry.day === day)?.short ?? "")
    .join(", ");
}

/** "Every day · 8:00", "Weekdays · 9:00", "Every 2 hours". */
export function describeRoutineSchedule(schedule: ScheduledTaskSchedule): string {
  if (schedule.type === "interval") return formatRoutineInterval(schedule.everyMs);
  if (schedule.type === "fixed_time") {
    return `${formatRoutineDays(schedule.weekdays ?? [])} · ${formatRoutineTime(schedule.timeOfDay)}`;
  }
  return "On webhook";
}

export function describeRoutineForm(form: RoutineScheduleForm): string {
  const schedule = routineScheduleFromForm(form);
  return schedule === null || schedule.type === "webhook"
    ? "Pick a day"
    : describeRoutineSchedule(schedule);
}

/** Moves to the next interval step; a value between steps snaps to the nearest one that way. */
export function stepRoutineInterval(everyMs: number, direction: 1 | -1): number {
  if (direction === 1) {
    return ROUTINE_INTERVAL_STEPS.find((step) => step > everyMs) ?? everyMs;
  }
  return [...ROUTINE_INTERVAL_STEPS].reverse().find((step) => step < everyMs) ?? everyMs;
}

export function toggleRoutineDay(days: ReadonlyArray<number>, day: number): number[] {
  return days.includes(day) ? days.filter((value) => value !== day) : sortDays([...days, day]);
}

export interface RoutinePreset {
  readonly id: "morning-brief" | "daily-standup" | "weekly-summary";
  readonly name: string;
  readonly glyph: string;
  readonly prompt: string;
  readonly schedule: RoutineScheduleForm;
}

export const ROUTINE_PRESETS: ReadonlyArray<RoutinePreset> = [
  {
    id: "morning-brief",
    name: "Morning brief",
    glyph: "☀",
    prompt:
      "Send me a short morning brief: what changed in this project since yesterday, what is still open, and what needs me today.",
    schedule: { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "daily", timeOfDay: "08:00" },
  },
  {
    id: "daily-standup",
    name: "Daily standup",
    glyph: "◷",
    prompt:
      "Post a short standup: what you did since the last one, what you will do next, and anything that blocks you.",
    schedule: { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "weekdays", timeOfDay: "09:00" },
  },
  {
    id: "weekly-summary",
    name: "Weekly summary",
    glyph: "≡",
    prompt:
      "Write a weekly summary of this project: what shipped, what is in progress, and the risks for next week. Keep it short.",
    schedule: { ...DEFAULT_ROUTINE_SCHEDULE, repeat: "weekly", timeOfDay: "17:00", days: [5] },
  },
];

export function findRoutinePreset(id: string | undefined): RoutinePreset | null {
  return ROUTINE_PRESETS.find((preset) => preset.id === id) ?? null;
}
