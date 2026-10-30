import { useAtomValue } from "@effect/atom-react";
import {
  deriveThreadStructureRuntime,
  threadRuntimeHasInterruptibleRun,
} from "@t3tools/client-runtime/state/thread-execution";
import {
  seedUserInputDraftAnswers,
  type ThreadPendingApproval,
  type ThreadPendingUserInput,
  type ThreadUserInputQuestion,
} from "@t3tools/client-runtime/state/thread-requests";
import {
  AuthOrchestrationOperateScope,
  EnvironmentId,
  type ProviderApprovalDecision,
  type RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import { useState } from "react";

import {
  buildPendingUserInputAnswers,
  setPendingUserInputCustomAnswer,
  togglePendingUserInputOptionSelection,
  type PendingUserInputDraftAnswer,
} from "../../lib/threadActivity";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import { environmentThreadDetails, threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { useQuietThreadStructure } from "../../state/use-thread-detail";
import type { Bot } from "./bots-model";

export type BotPendingApproval = ThreadPendingApproval;
export type BotPendingUserInput = ThreadPendingUserInput;
export type BotUserInputAnswers = Record<string, string | ReadonlyArray<string>>;
type DraftsByQuestion = Record<string, PendingUserInputDraftAnswer>;

const EMPTY_APPROVALS: ReadonlyArray<BotPendingApproval> = [];
const EMPTY_USER_INPUTS: ReadonlyArray<BotPendingUserInput> = [];

export interface BotRequests {
  readonly approvals: ReadonlyArray<BotPendingApproval>;
  readonly userInputs: ReadonlyArray<BotPendingUserInput>;
  readonly hasPending: boolean;
  readonly canOperate: boolean;
  readonly respondingRequestId: RuntimeRequestId | null;
  readonly respondToApproval: (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<boolean>;
  readonly userInputDrafts: (request: BotPendingUserInput) => DraftsByQuestion;
  readonly userInputAnswers: (request: BotPendingUserInput) => BotUserInputAnswers | null;
  readonly selectUserInputOption: (
    requestId: RuntimeRequestId,
    question: ThreadUserInputQuestion,
    value: string,
  ) => void;
  readonly setUserInputCustomAnswer: (
    requestId: RuntimeRequestId,
    question: ThreadUserInputQuestion,
    text: string,
  ) => void;
  /** Sends `answers`, or the request's current drafts when omitted. */
  readonly submitUserInput: (
    request: BotPendingUserInput,
    answers?: BotUserInputAnswers,
  ) => Promise<boolean>;
  readonly dismissUserInput: (request: BotPendingUserInput) => Promise<boolean>;
  readonly canStop: boolean;
  readonly stopping: boolean;
  readonly stop: () => Promise<boolean>;
}

export function useBotRequests(bot: Pick<Bot, "environmentId" | "threadId">): BotRequests {
  const environmentId = EnvironmentId.make(bot.environmentId);
  const threadId = ThreadId.make(bot.threadId);
  const ref = { environmentId, threadId };

  const respondToApprovalCommand = useAtomCommand(
    threadEnvironment.respondToApproval,
    "bot approval response",
  );
  const respondToUserInputCommand = useAtomCommand(
    threadEnvironment.respondToUserInput,
    "bot user input response",
  );
  const dismissUserInputCommand = useAtomCommand(
    threadEnvironment.dismissUserInput,
    "bot user input dismissal",
  );
  const interruptTurnCommand = useAtomCommand(threadEnvironment.interruptTurn, "bot interrupt");

  const pending = useAtomValue(environmentThreadDetails.pendingRequestsAtom(ref));
  const structure = useQuietThreadStructure(ref);
  const canOperate = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const [draftsByRequest, setDraftsByRequest] = useState<Record<string, DraftsByQuestion>>({});
  const [respondingRequestId, setRespondingRequestId] = useState<RuntimeRequestId | null>(null);
  const [stopping, setStopping] = useState(false);

  const approvals = pending?.approvals ?? EMPTY_APPROVALS;
  const userInputs = pending?.userInputs ?? EMPTY_USER_INPUTS;
  const runtime = structure ? deriveThreadStructureRuntime(structure.projection) : null;
  const interruptibleRunId = threadRuntimeHasInterruptibleRun(runtime)
    ? (runtime?.activeRunId ?? null)
    : null;

  const operable = () => readEnvironmentScope(environmentId, AuthOrchestrationOperateScope);

  const userInputDrafts = (request: BotPendingUserInput): DraftsByQuestion =>
    seedUserInputDraftAnswers(request.questions, draftsByRequest[request.requestId] ?? {});

  const userInputAnswers = (request: BotPendingUserInput) =>
    buildPendingUserInputAnswers(request.questions, userInputDrafts(request));

  const updateDraft = (
    requestId: RuntimeRequestId,
    question: ThreadUserInputQuestion,
    next: (draft: PendingUserInputDraftAnswer | undefined) => PendingUserInputDraftAnswer,
  ) => {
    setDraftsByRequest((current) => {
      const drafts = seedUserInputDraftAnswers([question], current[requestId] ?? {});
      return { ...current, [requestId]: { ...drafts, [question.id]: next(drafts[question.id]) } };
    });
  };

  const clearDrafts = (requestId: RuntimeRequestId) => {
    setDraftsByRequest((current) => {
      if (!(requestId in current)) return current;
      const rest = { ...current };
      delete rest[requestId];
      return rest;
    });
  };

  const respondToApproval = async (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => {
    const approval = approvals.find((entry) => entry.requestId === requestId);
    if (!operable() || approval?.responseCapability !== "live") return false;
    setRespondingRequestId(requestId);
    const result = await respondToApprovalCommand({
      environmentId,
      input: { threadId, requestId, decision },
    });
    setRespondingRequestId((current) => (current === requestId ? null : current));
    return result._tag === "Success";
  };

  const submitUserInput = async (request: BotPendingUserInput, answers?: BotUserInputAnswers) => {
    const finalAnswers = answers ?? userInputAnswers(request);
    if (
      !operable() ||
      request.responseCapability === "not_resumable" ||
      finalAnswers === null ||
      respondingRequestId === request.requestId
    ) {
      return false;
    }
    setRespondingRequestId(request.requestId);
    const result = await respondToUserInputCommand({
      environmentId,
      input: { threadId, requestId: request.requestId, answers: finalAnswers },
    });
    setRespondingRequestId((current) => (current === request.requestId ? null : current));
    if (result._tag !== "Success") return false;
    clearDrafts(request.requestId);
    return true;
  };

  const dismissUserInput = async (request: BotPendingUserInput) => {
    if (!operable() || !request.dismissible) return false;
    setRespondingRequestId(request.requestId);
    const result = await dismissUserInputCommand({
      environmentId,
      input: { threadId, requestId: request.requestId },
    });
    setRespondingRequestId((current) => (current === request.requestId ? null : current));
    if (result._tag !== "Success") return false;
    clearDrafts(request.requestId);
    return true;
  };

  const stop = async () => {
    if (!operable() || interruptibleRunId === null || stopping) return false;
    setStopping(true);
    const result = await interruptTurnCommand({
      environmentId,
      input: { threadId, runId: interruptibleRunId },
    });
    setStopping(false);
    return result._tag === "Success";
  };

  return {
    approvals,
    userInputs,
    hasPending: approvals.length > 0 || userInputs.length > 0,
    canOperate,
    respondingRequestId,
    respondToApproval,
    userInputDrafts,
    userInputAnswers,
    selectUserInputOption: (requestId, question, value) =>
      updateDraft(requestId, question, (draft) =>
        togglePendingUserInputOptionSelection(question, draft, value),
      ),
    setUserInputCustomAnswer: (requestId, question, text) =>
      updateDraft(requestId, question, (draft) =>
        setPendingUserInputCustomAnswer(question, draft, text),
      ),
    submitUserInput,
    dismissUserInput,
    canStop: canOperate && interruptibleRunId !== null,
    stopping,
    stop,
  };
}
