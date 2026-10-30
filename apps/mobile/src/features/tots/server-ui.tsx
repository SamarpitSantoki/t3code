import { View } from "react-native";

import { useWorkspaceEnvironments } from "../../state/workspace";
import { serverTone, type ServerSummary } from "./server-model";
import { useTotsColors } from "./theme";

/** Every saved server, in Settings order, with its live connection state. */
export function useServers(): ReadonlyArray<ServerSummary> {
  return useWorkspaceEnvironments();
}

export function useServer(environmentId: string | null): ServerSummary | null {
  const servers = useServers();
  return servers.find((server) => server.environmentId === environmentId) ?? null;
}

export function ServerDot(props: {
  readonly server: ServerSummary | null | undefined;
  readonly size?: number;
}) {
  const colors = useTotsColors();
  const size = props.size ?? 8;
  const color = {
    connected: colors.green,
    connecting: colors.amber,
    offline: colors.placeholder,
  }[serverTone(props.server)];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}
