import { Pressable, View } from "react-native";

import { SymbolView } from "../../components/ui/AppSymbol";
import { BotFace, BotFaceStack, moodForStatus } from "./BotFace";
import type { ChatRow } from "./chats-model";
import { rowTime } from "./home-model";
import { TOTS_RADIUS, useTotsColors } from "./theme";
import { TotsButton, TotsText } from "./ui";

/** One conversation in the Chats list. */
export function ChatRowView(props: {
  readonly row: ChatRow;
  readonly onPress: () => void;
  readonly onLongPress?: (() => void) | undefined;
  readonly onSave?: (() => void) | undefined;
}) {
  const colors = useTotsColors();
  const { row } = props;
  const state = [
    row.unread ? "Unread" : null,
    row.pinned ? "Pinned" : null,
    row.muted ? "Muted" : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[row.title, ...state, row.preview.text].join(". ")}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 6,
        paddingVertical: 9,
        borderRadius: TOTS_RADIUS.card - 6,
        backgroundColor: pressed ? colors.sunken : colors.bg,
      })}
    >
      <View style={{ width: 46, alignItems: "center" }}>
        <ChatLeading row={row} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <TitleLine row={row} />
        <View className="flex-row items-center gap-1.5">
          {row.preview.botTalk ? <TalkBadge /> : null}
          <TotsText
            variant="small"
            numberOfLines={1}
            tone={row.preview.tone === "talk" ? "inkSoft" : row.preview.tone}
            style={{
              fontSize: 13.5,
              flexShrink: 1,
              fontStyle: row.preview.tone === "talk" ? "italic" : "normal",
            }}
          >
            {row.preview.text}
          </TotsText>
          <View className="flex-1" />
          {row.unread ? (
            <View
              accessibilityElementsHidden
              style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.blue }}
            />
          ) : null}
        </View>
      </View>
      {props.onSave ? (
        <TotsButton
          label="Save"
          size="small"
          onPress={props.onSave}
          accessibilityLabel={`Save ${row.title} on this phone`}
        />
      ) : null}
    </Pressable>
  );
}

function ChatLeading(props: { readonly row: ChatRow }) {
  const colors = useTotsColors();
  const { row } = props;
  const mood = moodForStatus(row.status.kind);
  if (row.kind === "team") return <BotFaceStack bots={row.roster} size={30} max={3} />;
  if (row.kind === "server") return <BotFace bot={row.face} size={46} mood={mood} />;
  if (row.kind === "bot") return <BotFace bot={row.bot} size={46} mood={mood} />;
  // A side thread: the bot smaller, with a branch badge, so it reads as its own agent thread.
  return (
    <View style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
      <BotFace bot={row.bot} size={34} mood={mood} />
      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 1,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <SymbolView name="arrow.triangle.branch" size={11} tintColor={colors.inkSoft} />
      </View>
    </View>
  );
}

function TitleLine(props: { readonly row: ChatRow }) {
  const colors = useTotsColors();
  const { row } = props;
  return (
    <View className="flex-row items-center gap-1.5">
      <TotsText numberOfLines={1} style={{ fontWeight: row.unread ? "700" : "600", flexShrink: 1 }}>
        {row.title}
      </TotsText>
      {row.kind === "thread" ? (
        <View
          style={{
            flexShrink: 0,
            maxWidth: 120,
            paddingHorizontal: 7,
            paddingVertical: 1,
            borderRadius: TOTS_RADIUS.pill,
            backgroundColor: colors.sunken,
          }}
        >
          <TotsText variant="small" tone="muted" numberOfLines={1} style={{ fontSize: 11.5 }}>
            {row.subtitle}
          </TotsText>
        </View>
      ) : null}
      {row.status.kind === "working" ? (
        <View
          accessibilityElementsHidden
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue }}
        />
      ) : null}
      {row.pinned ? <SymbolView name="pin" size={12} tintColor={colors.muted} /> : null}
      {row.muted ? <SymbolView name="moon" size={12} tintColor={colors.muted} /> : null}
      <View className="flex-1" />
      <TotsText variant="small" tone="muted">
        {rowTime(row.status)}
      </TotsText>
    </View>
  );
}

function TalkBadge() {
  const colors = useTotsColors();
  return (
    <View
      accessibilityLabel="Bot to bot"
      style={{
        paddingHorizontal: 5,
        borderRadius: TOTS_RADIUS.pill,
        backgroundColor: colors.blueSoft,
      }}
    >
      <TotsText variant="small" style={{ fontSize: 11, color: colors.blueInk, fontWeight: "700" }}>
        ↔
      </TotsText>
    </View>
  );
}
