import { useNavigation } from "@react-navigation/native";
import { View } from "react-native";

import { BOT_TEMPLATES } from "../bots/bot-identity";
import { BOT_ACCESSORIES } from "./bot-face-model";
import { BotFace, type BotMood } from "./BotFace";
import { TotsButton, TotsCard, TotsGlyph, TotsText } from "./ui";

type BotTemplate = (typeof BOT_TEMPLATES)[number];

const HERO_CAST: ReadonlyArray<{
  readonly template: BotTemplate;
  readonly accessory: string;
  readonly mood: BotMood;
  readonly size: number;
  readonly rotate: string;
}> = [
  { template: BOT_TEMPLATES[1], accessory: "antenna", mood: "idle", size: 58, rotate: "-8deg" },
  { template: BOT_TEMPLATES[0], accessory: "glasses", mood: "working", size: 78, rotate: "0deg" },
  { template: BOT_TEMPLATES[5], accessory: "ears", mood: "waiting", size: 58, rotate: "8deg" },
];

function HeroCast() {
  return (
    <View className="flex-row items-end justify-center">
      {HERO_CAST.map((member, index) => (
        <View
          key={member.template.id}
          style={{
            marginLeft: index === 0 ? 0 : -12,
            marginBottom: index === 1 ? 10 : 0,
            zIndex: index === 1 ? 1 : 0,
            transform: [{ rotate: member.rotate }],
          }}
        >
          <BotFace
            bot={{ ...member.template, accessory: member.accessory }}
            size={member.size}
            mood={member.mood}
          />
        </View>
      ))}
    </View>
  );
}

export function ConnectServerHero() {
  const navigation = useNavigation();
  return (
    <TotsCard style={{ paddingVertical: 32, paddingHorizontal: 24, gap: 18, alignItems: "center" }}>
      <HeroCast />
      <View className="items-center gap-2">
        <TotsText variant="heading" style={{ fontSize: 22, textAlign: "center" }}>
          Connect your T3 server
        </TotsText>
        <TotsText tone="muted" style={{ textAlign: "center" }}>
          Your bots live on your own T3 Code server and work in your projects. Connect it once, then
          hire bots from here.
        </TotsText>
      </View>
      <TotsButton
        label="Connect a server"
        size="large"
        onPress={() => navigation.navigate("SettingsEnvironmentNew")}
      />
    </TotsCard>
  );
}

export function HireFirstBot() {
  const navigation = useNavigation();
  const rows: BotTemplate[][] = [];
  for (let index = 0; index < BOT_TEMPLATES.length; index += 2) {
    rows.push(BOT_TEMPLATES.slice(index, index + 2));
  }
  return (
    <View className="gap-4">
      <View className="items-center gap-3 px-4 pt-4 pb-2">
        <HeroCast />
        <TotsText variant="heading" style={{ fontSize: 22, textAlign: "center" }}>
          Hire your first bot
        </TotsText>
        <TotsText tone="muted" style={{ textAlign: "center" }}>
          A bot has a name, one job and a long memory. Hand it work and it tells you when it needs
          you.
        </TotsText>
      </View>
      {rows.map((row) => (
        <View key={row.map((template) => template.id).join(":")} className="flex-row gap-3">
          {row.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
      <TotsButton
        label="Hire a custom bot"
        size="large"
        icon={<TotsGlyph tone="onPrimary">+</TotsGlyph>}
        onPress={() => navigation.navigate("BotNew")}
      />
    </View>
  );
}

function TemplateCard(props: { readonly template: BotTemplate }) {
  const navigation = useNavigation();
  const index = BOT_TEMPLATES.findIndex((template) => template.id === props.template.id);
  const accessory = BOT_ACCESSORIES[index % BOT_ACCESSORIES.length];
  return (
    <TotsCard
      style={{ flex: 1, gap: 10 }}
      accessibilityLabel={`Hire a ${props.template.name}`}
      onPress={() => navigation.navigate("BotNew", { template: props.template.id })}
    >
      <BotFace bot={{ ...props.template, accessory }} size={44} />
      <View className="gap-0.5">
        <TotsText style={{ fontWeight: "600" }}>{props.template.name}</TotsText>
        <TotsText variant="small" tone="muted" numberOfLines={2}>
          {props.template.tagline}
        </TotsText>
      </View>
    </TotsCard>
  );
}
