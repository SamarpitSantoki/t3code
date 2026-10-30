import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadState } from "@t3tools/client-runtime/state/threads";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import { useEffect } from "react";

import { appAtomRegistry } from "../../state/atom-registry";
import { useThreadShells } from "../../state/entities";
import { orchestrationEnvironment } from "../../state/orchestration";
import { environmentThreads } from "../../state/threads";
import { deriveBotStatus, type BotStatus } from "./bot-status-model";
import { useBotRegistry } from "./bots-state";
import {
  firstUserMessage,
  serverBotCandidates,
  serverBotSetup,
  serverThreadKey,
  type ServerBotEntry,
  type ServerBotSetup,
} from "./server-bots-model";

export interface ServerBot extends ServerBotEntry {
  readonly status: BotStatus;
}

interface ProbeTarget {
  readonly environmentId: string;
  readonly threadId: string;
}

/** Each thread's first message never changes, so one answer per thread lasts the session. */
const probesAtom = Atom.make<Readonly<Record<string, ServerBotSetup | null>>>({}).pipe(
  Atom.keepAlive,
  Atom.withLabel("mobile:server-bots:probes"),
);

const PROBE_CONCURRENCY = 2;
const LOAD_TIMEOUT_MS = 15_000;
const RETRY_AFTER_MS = 60_000;

const queue: ProbeTarget[] = [];
const queued = new Set<string>();
const failedAt = new Map<string, number>();
let running = 0;

function record(key: string, setup: ServerBotSetup | null) {
  appAtomRegistry.set(probesAtom, { ...appAtomRegistry.get(probesAtom), [key]: setup });
}

function enqueue(targets: ReadonlyArray<ProbeTarget>) {
  const now = Date.now();
  for (const target of targets) {
    const key = serverThreadKey(target.environmentId, target.threadId);
    if (queued.has(key) || now - (failedAt.get(key) ?? -Infinity) < RETRY_AFTER_MS) continue;
    queued.add(key);
    queue.push(target);
  }
  pump();
}

function pump() {
  while (running < PROBE_CONCURRENCY && queue.length > 0) {
    const target = queue.shift()!;
    const key = serverThreadKey(target.environmentId, target.threadId);
    running += 1;
    void probeThread(target)
      .catch(() => undefined)
      .then((setup) => {
        if (setup === undefined) failedAt.set(key, Date.now());
        else record(key, setup);
      })
      .finally(() => {
        queued.delete(key);
        running -= 1;
        pump();
      });
  }
}

/** The thread as the chat screen loads it: a bounded window of its newest history. */
function loadThreadWindow(target: ProbeTarget): Promise<EnvironmentThreadState | null> {
  const atom = environmentThreads.stateAtom(
    EnvironmentId.make(target.environmentId),
    ThreadId.make(target.threadId),
  );
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const finish = (state: EnvironmentThreadState | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe?.();
      resolve(state);
    };
    const timeout = setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
    const check = (result: AsyncResult.AsyncResult<EnvironmentThreadState, unknown>) => {
      if (AsyncResult.isFailure(result)) return finish(null);
      const state = Option.getOrNull(AsyncResult.value(result));
      if (state?.status === "live" || state?.status === "deleted") finish(state);
    };
    unsubscribe = appAtomRegistry.subscribe(atom, check);
    if (settled) unsubscribe();
    else check(appAtomRegistry.get(atom));
  });
}

/** The first user message of the full transcript, for threads longer than one window. */
async function loadFirstTranscriptMessage(target: ProbeTarget) {
  const result = await runAtomCommand(
    appAtomRegistry,
    orchestrationEnvironment.threadTranscript,
    {
      environmentId: EnvironmentId.make(target.environmentId),
      input: { threadId: ThreadId.make(target.threadId) },
    },
    { reportFailure: false },
  );
  if (result._tag !== "Success") return undefined;
  for (const row of result.value.items) {
    if (row.item.type === "user_message") return { id: row.item.messageId, text: row.item.text };
  }
  return null;
}

/** Undefined when the answer is not known yet, so the thread is tried again later. */
async function probeThread(target: ProbeTarget): Promise<ServerBotSetup | null | undefined> {
  const state = await loadThreadWindow(target);
  if (state === null) return undefined;
  if (state.status === "deleted") return null;
  const projection = Option.getOrNull(state.data);
  if (projection === null) return undefined;
  if (state.history.hasMoreHistory) {
    const first = await loadFirstTranscriptMessage(target);
    return first === undefined ? undefined : serverBotSetup(first);
  }
  const first = firstUserMessage(
    projection.messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: DateTime.formatIso(message.createdAt),
    })),
  );
  // A thread whose first message has not arrived yet is asked again later.
  return first === null ? undefined : serverBotSetup(first);
}

/**
 * Bots on connected servers that this phone has not saved: the newest top-level threads whose
 * first message is a bot setup. Each thread is read once, a few at a time.
 */
export function useServerBots(): ReadonlyArray<ServerBot> {
  const shells = useThreadShells();
  const { loaded, registry } = useBotRegistry();
  const probes = useAtomValue(probesAtom);
  const candidates = loaded
    ? serverBotCandidates(
        shells.filter((shell) => shell.visibleItemCount > 0),
        registry,
      )
    : [];
  const unknown = JSON.stringify(
    candidates
      .filter((shell) => !(serverThreadKey(shell.environmentId, shell.id) in probes))
      .map((shell) => [shell.environmentId, shell.id]),
  );

  // oxlint-disable-next-line t3code/react-effect-budget -- starts server reads for threads that come into view; the queue drops repeats.
  useEffect(() => {
    const targets = JSON.parse(unknown) as ReadonlyArray<readonly [string, string]>;
    enqueue(targets.map(([environmentId, threadId]) => ({ environmentId, threadId })));
  }, [unknown]);

  return candidates.flatMap((shell) => {
    const setup = probes[serverThreadKey(shell.environmentId, shell.id)];
    return setup
      ? [
          {
            ...setup,
            environmentId: shell.environmentId,
            threadId: shell.id,
            createdAt: shell.createdAt,
            status: deriveBotStatus(shell),
          },
        ]
      : [];
  });
}
