import { Platform, Text, View, type TextStyle } from "react-native";

import { TOTS_FONT, useTotsColors } from "../tots/theme";
import { chatMarkdownKey, parseChatMarkdown, type InlineSpan } from "./bot-markdown";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

function Spans(props: { readonly spans: ReadonlyArray<InlineSpan>; readonly codeBg: string }) {
  return props.spans.map((span, index) =>
    span.kind === "bold" ? (
      <Text key={chatMarkdownKey(span.kind, index)} style={{ fontWeight: "700" }}>
        {span.text}
      </Text>
    ) : span.kind === "code" ? (
      <Text
        key={chatMarkdownKey(span.kind, index)}
        style={{ fontFamily: MONO, fontSize: 13.5, backgroundColor: props.codeBg }}
      >
        {` ${span.text} `}
      </Text>
    ) : (
      span.text
    ),
  );
}

export function BotMarkdown(props: {
  readonly text: string;
  /** Kept for callers that pass layout classes; colors come from the Tots palette. */
  readonly textClassName?: string;
  readonly color?: string;
}) {
  const colors = useTotsColors();
  const blocks = parseChatMarkdown(props.text);
  const textStyle: TextStyle = { ...TOTS_FONT.body, color: props.color ?? colors.ink };
  return (
    <View style={{ gap: 6 }}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return (
              <Text
                key={chatMarkdownKey(block.kind, index)}
                className={props.textClassName}
                style={[textStyle, { fontWeight: "700", fontSize: 16 }]}
              >
                <Spans spans={block.spans} codeBg={colors.code} />
              </Text>
            );
          case "bullet":
            return (
              <View
                key={chatMarkdownKey(block.kind, index)}
                style={{ flexDirection: "row", gap: 8, paddingLeft: 2 }}
              >
                <Text style={[textStyle, { color: colors.muted }]}>{block.marker}</Text>
                <Text className={props.textClassName} style={[textStyle, { flex: 1 }]}>
                  <Spans spans={block.spans} codeBg={colors.code} />
                </Text>
              </View>
            );
          case "code":
            return (
              <View
                key={chatMarkdownKey(block.kind, index)}
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.code,
                  borderWidth: 1,
                  borderColor: colors.line,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <Text
                  selectable
                  style={{ fontFamily: MONO, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}
                >
                  {block.text}
                </Text>
              </View>
            );
          default:
            return (
              <Text
                key={chatMarkdownKey(block.kind, index)}
                className={props.textClassName}
                style={textStyle}
              >
                <Spans spans={block.spans} codeBg={colors.code} />
              </Text>
            );
        }
      })}
    </View>
  );
}
