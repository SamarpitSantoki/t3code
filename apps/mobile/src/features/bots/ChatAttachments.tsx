import { EnvironmentId } from "@t3tools/contracts";
import { Image as ExpoImage } from "expo-image";
import { useMemo } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";

import type { FilePreviewSource } from "../../components/FilePreviewModal";
import { Menu } from "../../components/ui/Menu";
import { assetImageSource } from "../../lib/assetImageSource";
import type { DraftComposerAttachment } from "../../lib/composerImages";
import { useAssetUrl } from "../../state/assets";
import { TOTS_FONT, TOTS_RADIUS, useTotsColors } from "../tots/theme";
import { TotsGlyph, TotsIconButton } from "../tots/ui";
import { attachmentSizeLabel, type ChatEntryAttachment } from "./chat-attachments";

const TRAY_SIZE = 64;
const BUBBLE_IMAGE = { width: 200, height: 150 };

/** The composer's "+" button: Photo and File, plus any screen-specific actions first. */
export function ChatAttachMenu(props: {
  readonly onPhoto: () => void;
  readonly onFile: () => void;
  readonly actions?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly onAction?: (id: string) => void;
  readonly disabled?: boolean;
}) {
  return (
    <Menu
      accessibilityLabel="Add"
      actions={[
        ...(props.actions ?? []),
        { id: "attach-photo", title: "Photo", image: "photo" },
        { id: "attach-file", title: "File", image: "doc" },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (props.disabled) return;
        if (nativeEvent.event === "attach-photo") props.onPhoto();
        else if (nativeEvent.event === "attach-file") props.onFile();
        else props.onAction?.(nativeEvent.event);
      }}
    >
      <TotsIconButton
        accessibilityLabel="Add"
        size={38}
        disabled={props.disabled}
        onPress={() => undefined}
      >
        <TotsGlyph size={20} tone="muted">
          +
        </TotsGlyph>
      </TotsIconButton>
    </Menu>
  );
}

/** Picked photos and files above the input, each with a remove button. */
export function ChatAttachmentTray(props: {
  readonly attachments: ReadonlyArray<DraftComposerAttachment>;
  readonly onRemove: (id: string) => void;
  readonly picking?: boolean;
}) {
  const colors = useTotsColors();
  if (props.attachments.length === 0 && !props.picking) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2 }}
    >
      {props.attachments.map((attachment) => (
        <View key={attachment.id} style={{ paddingTop: 6, paddingRight: 6 }}>
          {attachment.type === "image" ? (
            <Image
              accessibilityLabel={attachment.name}
              source={{ uri: attachment.previewUri }}
              style={{
                width: TRAY_SIZE,
                height: TRAY_SIZE,
                borderRadius: 14,
                backgroundColor: colors.sunken,
              }}
            />
          ) : (
            <FileChip
              name={attachment.name}
              sizeBytes={attachment.sizeBytes}
              height={TRAY_SIZE}
              maxWidth={180}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${attachment.name}`}
            hitSlop={8}
            onPress={() => props.onRemove(attachment.id)}
            style={({ pressed }) => ({
              position: "absolute",
              top: 0,
              right: 0,
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{ color: colors.onPrimary, fontSize: 13, fontWeight: "700", lineHeight: 15 }}
            >
              ×
            </Text>
          </Pressable>
        </View>
      ))}
      {props.picking ? (
        <View
          style={{
            marginTop: 6,
            width: TRAY_SIZE,
            height: TRAY_SIZE,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.sunken,
          }}
        >
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : null}
    </ScrollView>
  );
}

/** The photos and files of a sent message, stacked above its text bubble. */
export function ChatMessageAttachments(props: {
  readonly attachments: ReadonlyArray<ChatEntryAttachment>;
  readonly environmentId: string | null;
  readonly dimmed?: boolean;
  readonly onPreview?: (source: FilePreviewSource) => void;
}) {
  if (props.attachments.length === 0) return null;
  return (
    <View
      style={{
        alignItems: "flex-end",
        gap: 6,
        opacity: props.dimmed ? 0.6 : 1,
      }}
    >
      {props.attachments.map((attachment) =>
        attachment.kind === "image" ? (
          <MessageImage
            key={attachment.id}
            attachment={attachment}
            environmentId={props.environmentId}
            onPreview={props.onPreview}
          />
        ) : (
          <FileChip
            key={attachment.id}
            name={attachment.name}
            sizeBytes={attachment.sizeBytes}
            maxWidth={260}
          />
        ),
      )}
    </View>
  );
}

function MessageImage(props: {
  readonly attachment: ChatEntryAttachment;
  readonly environmentId: string | null;
  readonly onPreview: ((source: FilePreviewSource) => void) | undefined;
}) {
  const colors = useTotsColors();
  const { attachment } = props;
  const environmentId = props.environmentId ? EnvironmentId.make(props.environmentId) : null;
  const resource = useMemo(
    () =>
      attachment.assetId
        ? {
            _tag: "attachment" as const,
            attachmentId: attachment.assetId,
            fileName: attachment.name,
            mimeType: attachment.mimeType,
          }
        : null,
    [attachment.assetId, attachment.name, attachment.mimeType],
  );
  const serverUri = useAssetUrl(resource ? environmentId : null, resource);
  const frame = {
    ...BUBBLE_IMAGE,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    backgroundColor: colors.sunken,
  };
  const preview: FilePreviewSource | null =
    resource && environmentId
      ? { kind: "image", name: attachment.name, environmentId, resource }
      : attachment.localUri
        ? { kind: "image", name: attachment.name, uri: attachment.localUri }
        : null;
  const image =
    resource && environmentId ? (
      serverUri === null ? (
        <View style={[frame, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : (
        <ExpoImage
          source={assetImageSource(environmentId, resource, serverUri)}
          cachePolicy="memory-disk"
          contentFit="cover"
          style={frame}
        />
      )
    ) : attachment.localUri ? (
      <Image source={{ uri: attachment.localUri }} style={frame} resizeMode="cover" />
    ) : (
      <View style={frame} />
    );
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Open ${attachment.name}`}
      disabled={!preview || !props.onPreview}
      onPress={() => {
        if (preview) props.onPreview?.(preview);
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {image}
    </Pressable>
  );
}

function FileChip(props: {
  readonly name: string;
  readonly sizeBytes: number;
  readonly height?: number;
  readonly maxWidth: number;
}) {
  const colors = useTotsColors();
  const size = attachmentSizeLabel(props.sizeBytes);
  const extension = /\.([a-z0-9]{1,5})$/i.exec(props.name)?.[1]?.toUpperCase() ?? "FILE";
  return (
    <View
      accessibilityLabel={size ? `${props.name}, ${size}` : props.name}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: props.height,
        maxWidth: props.maxWidth,
        borderRadius: props.height ? 14 : TOTS_RADIUS.card,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        paddingVertical: 8,
        paddingLeft: 8,
        paddingRight: 14,
      }}
    >
      <View
        style={{
          minWidth: 40,
          height: 40,
          borderRadius: 10,
          paddingHorizontal: 4,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.blueSoft,
        }}
      >
        <Text numberOfLines={1} style={[TOTS_FONT.caps, { color: colors.blueInk, fontSize: 10 }]}>
          {extension}
        </Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={[TOTS_FONT.label, { color: colors.ink }]}>
          {props.name}
        </Text>
        {size ? (
          <Text numberOfLines={1} style={[TOTS_FONT.small, { color: colors.muted }]}>
            {size}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
