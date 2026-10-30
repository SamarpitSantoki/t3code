import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";

/** Tots owns its look instead of following the T3 theme, only its light or dark mode. */
const LIGHT = {
  bg: "#F6F5F2",
  card: "#FFFFFF",
  sunken: "#EFEDE8",
  code: "#F4F3EF",
  ink: "#121212",
  inkSoft: "#3A3A3C",
  muted: "#86868B",
  placeholder: "#A5A5A9",
  line: "#ECEAE6",
  inverse: "#FFFFFF",
  primary: "#121212",
  onPrimary: "#FFFFFF",
  blue: "#3D7BFA",
  blueSoft: "#EAF1FF",
  blueInk: "#2456C7",
  amber: "#F2A93B",
  amberSoft: "#FFF6E6",
  amberLine: "#F7DDAE",
  amberInk: "#7A5A20",
  amberText: "#C27C0E",
  green: "#2FB36D",
  red: "#E5484D",
  redSoft: "#FDECEC",
  toggleOff: "#D9D7D2",
} as const;

const DARK: { readonly [K in keyof typeof LIGHT]: string } = {
  bg: "#0E0E10",
  card: "#1A1A1D",
  sunken: "#232327",
  code: "#232327",
  ink: "#F4F4F5",
  inkSoft: "#D4D4D8",
  muted: "#8E8E93",
  placeholder: "#6B6B70",
  line: "#2A2A2E",
  inverse: "#121212",
  primary: "#F4F4F5",
  onPrimary: "#121212",
  blue: "#5B8EFF",
  blueSoft: "#1B2741",
  blueInk: "#9BB8FF",
  amber: "#F2A93B",
  amberSoft: "#2A2112",
  amberLine: "#4A3816",
  amberInk: "#F0C987",
  amberText: "#F2B65A",
  green: "#36C27A",
  red: "#FF6369",
  redSoft: "#3A1C1E",
  toggleOff: "#3A3A3E",
};

export type TotsColors = typeof DARK;

export function useTotsColors(): TotsColors {
  const { themeAppearance } = useAppearancePreferences();
  return themeAppearance === "dark" ? DARK : LIGHT;
}

export const TOTS_RADIUS = { card: 20, pill: 999, input: 26, sheet: 28 } as const;

export const TOTS_FONT = {
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "600" },
  small: { fontSize: 12.5 },
  caps: { fontSize: 11.5, fontWeight: "600", letterSpacing: 0.6 },
} as const;
