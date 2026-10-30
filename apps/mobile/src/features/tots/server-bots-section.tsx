import { View } from "react-native";

import { useServerBots, type ServerBot } from "../bots/server-bots";
import { serverBotToBot } from "../bots/server-bots-model";
import { BotFace, moodForStatus } from "./BotFace";
import { firstLine } from "./home-model";
import { RowText } from "./home-rows";
import { useSaveServerBot } from "./server-bot-save";
import { TotsButton, TotsSectionLabel } from "./ui";

/** Bots that live on a connected server but are not saved on this phone yet. */
export function ServerBotsSection() {
  const serverBots = useServerBots();
  if (serverBots.length === 0) return null;
  return (
    <View>
      <TotsSectionLabel>On your server</TotsSectionLabel>
      {serverBots.map((serverBot) => (
        <ServerBotRow key={`${serverBot.environmentId}:${serverBot.threadId}`} bot={serverBot} />
      ))}
    </View>
  );
}

function ServerBotRow(props: { readonly bot: ServerBot }) {
  const saveServerBot = useSaveServerBot();
  // Seeded by the thread, so the face shown here is the one saved.
  const face = serverBotToBot(props.bot, props.bot.threadId);
  const save = () => {
    saveServerBot(props.bot);
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 6,
        paddingVertical: 9,
      }}
    >
      <View style={{ minWidth: 46, alignItems: "center" }}>
        <BotFace bot={face} size={46} mood={moodForStatus(props.bot.status.kind)} />
      </View>
      <View className="min-w-0 flex-1">
        <RowText
          title={props.bot.name}
          line={firstLine(props.bot.role) ?? ""}
          tone="muted"
          time=""
        />
      </View>
      <TotsButton
        label="Save this Tot"
        size="small"
        onPress={save}
        accessibilityLabel={`Save ${props.bot.name} on this phone`}
      />
    </View>
  );
}
