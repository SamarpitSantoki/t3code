import defaultThemeVariables from "../../generated-uniwind-default-theme-variables.json";
import {
  DEFAULT_MOBILE_THEME_ID,
  getMobileThemeVariables,
  themeColorWithAlpha,
  type MobileThemeAppearance,
  type MobileThemeId,
  type MobileThemeVariables,
} from "./mobileTheme";

const defaults = defaultThemeVariables as Readonly<
  Record<MobileThemeAppearance, MobileThemeVariables>
>;

/**
 * Complete palette for native and third-party APIs that cannot consume a
 * Uniwind className. Every palette shares the source that generates its
 * registered CSS theme.
 */
export function getMobileThemeRuntimeVariables(
  themeId: MobileThemeId,
  appearance: MobileThemeAppearance,
  platform: string,
): MobileThemeVariables {
  const usesDefaultPalette = themeId === DEFAULT_MOBILE_THEME_ID || themeId === "material-you";
  const variables = usesDefaultPalette
    ? defaults[appearance]
    : getMobileThemeVariables(themeId, appearance);
  // Light tablet sidebars use a stronger tonal fill; dark sidebars retain the
  // shared black pane beneath the near-black chat canvas. System colors
  // replace these roles later.
  const frame = themeColorWithAlpha(variables["--color-row-hover"], 1);
  const tablet =
    usesDefaultPalette && appearance === "light"
      ? {
          ...variables,
          "--color-drawer": frame,
          "--color-drawer-foreground-muted": variables["--color-foreground-muted"],
        }
      : variables;
  if (platform === "ios") {
    return tablet === variables
      ? variables
      : {
          ...tablet,
          "--color-header": frame,
          "--color-header-foreground": variables["--color-drawer-foreground"],
        };
  }
  if (platform !== "android") return variables;

  // Android draws its headers in JS on the canvas, like iOS's transparent bars,
  // so no tinted band separates them from content.
  return {
    ...tablet,
    "--color-header": themeColorWithAlpha(variables["--color-screen"], 1),
    "--color-header-foreground": variables["--color-foreground"],
  };
}
