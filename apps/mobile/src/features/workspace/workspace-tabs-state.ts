export type WorkspaceTab = "threads" | "pullRequests";
export type WorkspaceSearchMode = "resting" | "active" | "expanded";

export interface WorkspaceTabState {
  readonly query: string;
  readonly searchMode: WorkspaceSearchMode;
  readonly scrollOffset: number;
  readonly searchEntryOffset: number;
}

export interface WorkspaceTabsState {
  readonly selectedTab: WorkspaceTab;
  readonly selectionRevision: number;
  readonly tabs: Readonly<Record<WorkspaceTab, WorkspaceTabState>>;
}

function emptyTab(): WorkspaceTabState {
  return { query: "", searchMode: "resting", scrollOffset: 0, searchEntryOffset: 0 };
}

export function initialWorkspaceTabsState(): WorkspaceTabsState {
  return {
    selectedTab: "threads",
    selectionRevision: 0,
    tabs: { threads: emptyTab(), pullRequests: emptyTab() },
  };
}

export type WorkspaceTabsAction =
  | { readonly type: "select"; readonly tab: WorkspaceTab }
  | { readonly type: "search"; readonly tab?: WorkspaceTab }
  | { readonly type: "query"; readonly query: string; readonly tab?: WorkspaceTab }
  | { readonly type: "expand"; readonly tab?: WorkspaceTab }
  | { readonly type: "cancel"; readonly tab?: WorkspaceTab }
  | { readonly type: "scroll"; readonly tab: WorkspaceTab; readonly offset: number };

/** Each root retains its own search; leaving search restores the unfiltered list position. */
export function workspaceTabsReducer(
  state: WorkspaceTabsState,
  action: WorkspaceTabsAction,
): WorkspaceTabsState {
  if (action.type === "select")
    return action.tab === state.selectedTab
      ? state
      : {
          ...state,
          selectedTab: action.tab,
          selectionRevision: state.selectionRevision + 1,
        };
  const tab = action.tab ?? state.selectedTab;
  const current = state.tabs[tab];
  let next: WorkspaceTabState;
  switch (action.type) {
    case "search":
      next = {
        ...current,
        searchMode: "active",
        searchEntryOffset:
          current.searchMode === "resting" ? current.scrollOffset : current.searchEntryOffset,
      };
      break;
    case "query":
      next = { ...current, query: action.query };
      break;
    case "expand":
      if (current.searchMode === "resting") return state;
      next = { ...current, searchMode: "expanded" };
      break;
    case "cancel":
      next = {
        ...current,
        query: "",
        searchMode: "resting",
        scrollOffset: current.searchEntryOffset,
      };
      break;
    case "scroll":
      if (current.scrollOffset === action.offset) return state;
      next = { ...current, scrollOffset: action.offset };
      break;
  }
  return { ...state, tabs: { ...state.tabs, [tab]: next } };
}

/** Android's floating search row; `height` is the search field and its round buttons. */
export const WORKSPACE_TOOLBAR = { height: 48, expandedGap: 10, edge: 16, gap: 8 };
export const WORKSPACE_DOCK = { height: 48, bottomGap: 6 };
/** Android's floating tab pill and compose button, sized like the iOS 26 tab bar. */
export const ANDROID_WORKSPACE_DOCK = { height: 56, tabsWidth: 196, gap: 12 };

/** Height of Android's floating bottom controls: the dock, the search row, or both. */
export function workspaceToolbarHeight(mode: WorkspaceSearchMode): number {
  switch (mode) {
    case "resting":
      return ANDROID_WORKSPACE_DOCK.height;
    case "active":
      return WORKSPACE_TOOLBAR.height;
    case "expanded":
      return (
        WORKSPACE_TOOLBAR.height + WORKSPACE_TOOLBAR.expandedGap + ANDROID_WORKSPACE_DOCK.height
      );
  }
}
