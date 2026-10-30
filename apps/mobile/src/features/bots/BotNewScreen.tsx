import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { ModelSelection } from "@t3tools/contracts";
import * as Haptics from "expo-haptics";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView as RNScrollView, View } from "react-native";

import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import {
  buildModelOptions,
  resolveDefaultableModelSelection,
  resolveNewTaskModelSelection,
} from "../../lib/modelOptions";
import { scopedProjectKey } from "../../lib/scopedEntities";
import { useProjects } from "../../state/entities";
import { useNewTaskProjectDefaults } from "../threads/use-new-task-project-defaults";
import { BotFace } from "../tots/BotFace";
import { botAccessory } from "../tots/bot-face-model";
import { botNameTaken } from "../tots/profile-model";
import {
  hireBlockedReason,
  pickDefaultServer,
  projectsOnServer,
  serverName,
  serverStatusLabel,
  type ServerSummary,
} from "../tots/server-model";
import { ServerDot, useServers } from "../tots/server-ui";
import {
  TotsField,
  TotsFormScreen,
  TotsFormSection,
  TotsLookPicker,
  TotsScreenOptions,
} from "../tots/profile-ui";
import { useTotsColors } from "../tots/theme";
import { TotsButton, TotsCard, TotsGlyph, TotsText } from "../tots/ui";
import { BOT_COLORS, BOT_TEMPLATES } from "./bot-identity";
import { addBot } from "./bots-model";
import { createBot, useBotRegistry, useUpdateBotRegistry } from "./bots-state";

type BotNewScreenProps = StaticScreenProps<{ readonly template?: string } | undefined>;

// Tots no longer shows emoji, but older clients still read it.
const FALLBACK_EMOJI = "🤖";

export function BotNewScreen({ route }: BotNewScreenProps) {
  const navigation = useNavigation();
  const colors = useTotsColors();
  const projects = useProjects();
  const servers = useServers();
  const { registry } = useBotRegistry();
  const updateRegistry = useUpdateBotRegistry();
  const initial = BOT_TEMPLATES.find((template) => template.id === route.params?.template);
  const [templateId, setTemplateId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState<string>(initial?.name ?? "");
  const [role, setRole] = useState<string>(initial?.role ?? "");
  const [emoji, setEmoji] = useState<string>(initial?.emoji ?? FALLBACK_EMOJI);
  const [color, setColor] = useState<string>(initial?.color ?? BOT_COLORS[0]);
  const [accessory, setAccessory] = useState<string>(
    botAccessory({ id: initial?.id ?? "new-bot" }),
  );
  const [serverId, setServerId] = useState<string | null>(null);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const keyOf = (project: EnvironmentProject) =>
    scopedProjectKey(project.environmentId, project.id);
  const environmentId = pickDefaultServer({ servers, projects, chosenEnvironmentId: serverId });
  const server = servers.find((candidate) => candidate.environmentId === environmentId) ?? null;
  const serverProjects = projectsOnServer(projects, environmentId);
  const project =
    serverProjects.find((candidate) => keyOf(candidate) === projectKey) ??
    serverProjects[0] ??
    null;
  const blockedReason = hireBlockedReason(server);
  const defaults = useNewTaskProjectDefaults(project);
  const selectableModels = buildModelOptions(
    defaults.serverConfig,
    null,
    undefined,
    project?.id ?? null,
  ).filter((option) => !option.isUnavailable && !option.isHidden);
  const model: ModelSelection | null =
    selectableModels.find((option) => option.key === modelKey)?.selection ??
    resolveNewTaskModelSelection({
      draftSelection: null,
      projectDefaultSelection: resolveDefaultableModelSelection(
        defaults.serverConfig,
        defaults.projectSettings.settings.defaultModelSelection,
        project?.id ?? null,
      ),
      stickySelection: null,
      modelOptions: selectableModels,
    });
  const modelOption = selectableModels.find(
    (option) =>
      option.selection.instanceId === model?.instanceId && option.selection.model === model.model,
  );

  const trimmedName = name.trim();
  const nameTaken = trimmedName.length > 0 && botNameTaken(registry, trimmedName);
  const ready =
    trimmedName.length > 0 &&
    role.trim().length > 0 &&
    !!project &&
    !!model &&
    blockedReason === null;

  const pickTemplate = (id: string) => {
    const template = BOT_TEMPLATES.find((candidate) => candidate.id === id);
    if (!template) return;
    void Haptics.selectionAsync();
    setTemplateId(template.id);
    setName(template.name);
    setRole(template.role);
    setEmoji(template.emoji);
    setColor(template.color);
    setAccessory(botAccessory({ id: template.id }));
  };

  const save = async () => {
    if (saving) return;
    if (blockedReason !== null) {
      Dialog.alert("Server offline", blockedReason);
      return;
    }
    if (!ready || !project || !model) {
      Dialog.alert("Almost there", "Give your bot a name, a job, a project, and a model.");
      return;
    }
    if (nameTaken) {
      Dialog.alert("Name in use", "Each bot needs its own name, so teams can @mention it.");
      return;
    }
    setSaving(true);
    try {
      const bot = await createBot({
        name,
        role,
        emoji,
        color,
        accessory,
        template: templateId,
        project,
        modelSelection: model,
        runtimeMode: defaults.projectSettings.settings.defaultRuntimeMode,
      });
      updateRegistry((current) => addBot(current, bot));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      setSaving(false);
      Dialog.alert("Could not hire bot", String(error));
    }
  };

  return (
    <>
      <TotsScreenOptions title="New bot" />
      <TotsFormScreen
        footer={
          <View style={{ gap: 10 }}>
            {blockedReason !== null ? (
              <TotsText variant="small" tone="amber" style={{ textAlign: "center" }}>
                {blockedReason}
              </TotsText>
            ) : null}
            <TotsButton
              label={trimmedName ? `Hire ${trimmedName}` : "Hire bot"}
              size="large"
              loading={saving}
              disabled={!ready || nameTaken}
              onPress={() => void save()}
            />
          </View>
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <TotsCard style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
            <BotFace bot={{ id: "preview", color, accessory }} size={84} mood="idle" />
            <TotsText variant="heading" style={{ fontSize: 22 }} numberOfLines={1}>
              {trimmedName || "Your new bot"}
            </TotsText>
            <TotsText
              tone="muted"
              numberOfLines={3}
              style={{ textAlign: "center", paddingHorizontal: 12 }}
            >
              {role.trim() || "Pick a template or describe its job below."}
            </TotsText>
          </TotsCard>
        </View>

        <TotsFormSection title="Start from a template" flush>
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
          >
            {BOT_TEMPLATES.map((template) => {
              const selected = template.id === templateId;
              return (
                <Pressable
                  key={template.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${template.name}, ${template.tagline}`}
                  accessibilityState={{ selected }}
                  onPress={() => pickTemplate(template.id)}
                  style={({ pressed }) => ({
                    width: 140,
                    gap: 6,
                    padding: 14,
                    borderRadius: 20,
                    backgroundColor: colors.card,
                    borderWidth: 2,
                    borderColor: selected ? colors.ink : colors.line,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <BotFace
                    bot={{
                      id: template.id,
                      color: template.color,
                      accessory: botAccessory({ id: template.id }),
                    }}
                    size={40}
                  />
                  <TotsText style={{ fontWeight: "700" }}>{template.name}</TotsText>
                  <TotsText variant="small" tone="muted" numberOfLines={2}>
                    {template.tagline}
                  </TotsText>
                </Pressable>
              );
            })}
          </RNScrollView>
        </TotsFormSection>

        <TotsFormSection title="Name">
          <TotsField
            value={name}
            onChangeText={setName}
            editable={!saving}
            placeholder="e.g. Nova"
            autoCapitalize="words"
            maxLength={40}
            large
            hint={nameTaken ? "Another bot already has this name." : undefined}
          />
        </TotsFormSection>

        <TotsFormSection title="Look" flush>
          <TotsLookPicker
            color={color}
            accessory={accessory}
            onColor={setColor}
            onAccessory={setAccessory}
            disabled={saving}
          />
        </TotsFormSection>

        <TotsFormSection
          title="Job"
          hint="One focused job works best. Say what good work looks like."
        >
          <TotsField
            value={role}
            onChangeText={(next) => {
              setRole(next);
              setTemplateId(null);
            }}
            editable={!saving}
            multiline
            placeholder="Review every PR for bugs and missing tests, and report findings by severity."
          />
        </TotsFormSection>

        <TotsFormSection
          title="Setup"
          hint="Bots in one project share its files. Team bots must be on one server."
        >
          <TotsCard style={{ padding: 0, overflow: "hidden" }}>
            {servers.length > 1 ? (
              <>
                <PickerRow
                  label="Server"
                  value={serverName(server)}
                  leading={<ServerDot server={server} size={10} />}
                  detail={serverDetail(server)}
                  actions={servers.map((candidate) => ({
                    id: candidate.environmentId,
                    title: serverName(candidate),
                    subtitle: serverDetail(candidate),
                    state: candidate.environmentId === environmentId ? "on" : undefined,
                  }))}
                  onSelect={(id) => {
                    setServerId(id);
                    setProjectKey(null);
                    setModelKey(null);
                  }}
                />
                <View style={{ height: 1, marginLeft: 16, backgroundColor: colors.line }} />
              </>
            ) : null}
            <PickerRow
              label="Project"
              value={project?.title ?? "No projects"}
              actions={serverProjects.map((candidate) => ({
                id: keyOf(candidate),
                title: candidate.title,
                state: project && keyOf(candidate) === keyOf(project) ? "on" : undefined,
              }))}
              onSelect={(id) => {
                setProjectKey(id);
                setModelKey(null);
              }}
            />
            <View style={{ height: 1, marginLeft: 16, backgroundColor: colors.line }} />
            <PickerRow
              label="Model"
              value={
                modelOption
                  ? `${modelOption.label} · ${modelOption.providerLabel}`
                  : (model?.model ?? "No models")
              }
              actions={selectableModels.map((option) => ({
                id: option.key,
                title: option.label,
                subtitle: option.providerLabel,
                state:
                  option.selection.instanceId === model?.instanceId &&
                  option.selection.model === model.model
                    ? "on"
                    : undefined,
              }))}
              onSelect={setModelKey}
            />
          </TotsCard>
        </TotsFormSection>
      </TotsFormScreen>
    </>
  );
}

type ComponentActions = Parameters<typeof Menu>[0]["actions"];

function serverDetail(server: ServerSummary | null): string {
  const status = serverStatusLabel(server);
  return server?.connectionError ? `${status} · ${server.connectionError}` : status;
}

function PickerRow(props: {
  readonly label: string;
  readonly value: string;
  readonly leading?: ReactNode;
  readonly detail?: string;
  readonly actions: ComponentActions;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <Menu
      actions={props.actions}
      onPressAction={({ nativeEvent }) => props.onSelect(nativeEvent.event)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.label}, ${props.value}${props.detail ? `, ${props.detail}` : ""}`}
        style={({ pressed }) => ({
          minHeight: 60,
          paddingVertical: props.detail ? 10 : 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <TotsText variant="small" tone="muted">
            {props.label}
          </TotsText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {props.leading}
            <TotsText style={{ fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
              {props.value}
            </TotsText>
          </View>
          {props.detail ? (
            <TotsText variant="small" tone="muted" numberOfLines={2}>
              {props.detail}
            </TotsText>
          ) : null}
        </View>
        <TotsGlyph tone="muted" size={14}>
          ⌄
        </TotsGlyph>
      </Pressable>
    </Menu>
  );
}
