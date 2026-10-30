import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { StackActions, useNavigation } from "@react-navigation/native";

import { startOpeningEnvironmentThread } from "../../state/threads";

/**
 * Drills into the full T3 thread over the bot chat. Selecting it as a workspace detail would
 * reset the stack to Home and Thread, so Back would skip the chat.
 */
export function useOpenThreadSteps() {
  const navigation = useNavigation();
  return (environmentId: string, threadId: string) => {
    startOpeningEnvironmentThread(EnvironmentId.make(environmentId), ThreadId.make(threadId));
    navigation.dispatch(StackActions.push("Thread", { environmentId, threadId }));
  };
}
