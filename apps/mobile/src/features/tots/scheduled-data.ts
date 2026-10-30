import { useAtomValue } from "@effect/atom-react";
import { EnvironmentId, type ScheduledTask } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";

import { serverEnvironment } from "../../state/server";
import { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
import {
  environmentRoutineStatus,
  type BotEnvironmentGroup,
  type EnvironmentRoutineReport,
} from "./scheduled-model";

interface EnvironmentTasks {
  readonly environmentId: string;
  readonly tasks: ReadonlyArray<ScheduledTask> | null;
  readonly failed: boolean;
}

/** One read over each server's live task list; the per-server atoms are shared with other screens. */
const scheduledTasksByEnvironmentsAtom = Atom.family((key: string) =>
  Atom.make((get): ReadonlyArray<EnvironmentTasks> =>
    key
      .split("\n")
      .filter(Boolean)
      .map((environmentId) => {
        const result = get(
          serverEnvironment.scheduledTasksLive({
            environmentId: EnvironmentId.make(environmentId),
            input: {},
          }),
        );
        return {
          environmentId,
          tasks: Option.getOrNull(AsyncResult.value(result))?.tasks ?? null,
          failed: result._tag === "Failure",
        };
      }),
  ).pipe(Atom.withLabel(`mobile:tots-scheduled-tasks:${key}`)),
);

export function useScheduledReports(
  groups: ReadonlyArray<BotEnvironmentGroup>,
): ReadonlyMap<string, EnvironmentRoutineReport> {
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const lists = useAtomValue(
    scheduledTasksByEnvironmentsAtom(groups.map((group) => group.environmentId).join("\n")),
  );
  const reports = new Map<string, EnvironmentRoutineReport>();
  for (const list of lists) {
    const phase =
      connectedEnvironments.find((environment) => environment.environmentId === list.environmentId)
        ?.connectionState ?? null;
    reports.set(list.environmentId, {
      status: environmentRoutineStatus({
        phase,
        hasData: list.tasks !== null,
        hasError: list.failed,
      }),
      tasks: list.tasks ?? [],
    });
  }
  return reports;
}
