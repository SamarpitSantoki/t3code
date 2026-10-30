import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";

export function useTotsClassic() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return AsyncResult.isSuccess(preferences) && preferences.value.totsClassic === true;
}

export function useSetTotsClassic() {
  const save = useAtomSet(updateMobilePreferencesAtom);
  return (classic: boolean) => save({ totsClassic: classic });
}
