import {
  ThreadId,
  type ModelSelection,
  type ProjectId,
  type RuntimeMode,
  type ScheduledTask,
  type ScheduledTaskUpsertInput,
} from "@t3tools/contracts";

import { routineScheduleFromForm, type RoutineScheduleForm } from "./routine-schedule";

export interface RoutineDraft {
  readonly name: string;
  readonly prompt: string;
  readonly schedule: RoutineScheduleForm;
  readonly enabled: boolean;
}

export interface RoutineTarget {
  readonly projectId: ProjectId;
  readonly modelSelection: ModelSelection;
  readonly runtimeMode: RuntimeMode;
}

export type RoutineInputResult =
  | { readonly ok: true; readonly input: ScheduledTaskUpsertInput }
  | { readonly ok: false; readonly reason: string };

/** Runs land in the bot's main chat, so the routine reads like the bot talking. */
export function buildRoutineUpsertInput(input: {
  readonly draft: RoutineDraft;
  readonly botThreadId: string;
  readonly target: RoutineTarget | null;
  readonly existing: ScheduledTask | null;
}): RoutineInputResult {
  const title = input.draft.name.trim();
  const prompt = input.draft.prompt.trim();
  if (!title) return { ok: false, reason: "Give the routine a name." };
  if (!prompt) return { ok: false, reason: "Say what the bot should do." };
  const schedule = routineScheduleFromForm(input.draft.schedule);
  if (!schedule) {
    return {
      ok: false,
      reason:
        input.draft.schedule.repeat === "interval"
          ? "Pick an interval of at least a minute."
          : "Pick at least one day.",
    };
  }
  const target =
    input.target ??
    (input.existing
      ? {
          projectId: input.existing.projectId,
          modelSelection: input.existing.modelSelection,
          runtimeMode: input.existing.runtimeMode,
        }
      : null);
  if (!target) return { ok: false, reason: "This bot is still connecting. Try again soon." };
  return {
    ok: true,
    input: {
      ...(input.existing ? { id: input.existing.id, requireExisting: true } : {}),
      title,
      prompt,
      enabled: input.draft.enabled,
      schedule,
      projectId: target.projectId,
      modelSelection: target.modelSelection,
      runtimeMode: target.runtimeMode,
      threadId: ThreadId.make(input.botThreadId),
      workspaceStrategy: input.existing?.workspaceStrategy ?? { type: "root" },
      interactionMode: input.existing?.interactionMode ?? "default",
      creationSource: input.existing?.creationSource ?? "mobile",
    },
  };
}
