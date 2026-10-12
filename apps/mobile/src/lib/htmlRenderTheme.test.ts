import { describe, expect, it } from "vite-plus/test";

import { mobileHtmlRenderTheme } from "./htmlRenderTheme";
import { getMobileThemeVariables } from "./mobileTheme";

describe("mobileHtmlRenderTheme", () => {
  it("paints the page with the screen color on every platform", () => {
    const variables = getMobileThemeVariables("grove", "dark");
    const theme = mobileHtmlRenderTheme({
      themeId: "grove",
      appearance: "dark",
      variables,
      systemColors: false,
    });
    expect(theme.variables["--background"]).toBe(variables["--color-screen"]);
  });

  it("takes Material You's system roles over the default palette", () => {
    const variables = {
      ...getMobileThemeVariables("t3-code", "light"),
      "--color-primary": "#6750A4FF",
      "--color-foreground": "#1D1B20FF",
    };
    const theme = mobileHtmlRenderTheme({
      themeId: "material-you",
      appearance: "light",
      variables,
      systemColors: true,
    });
    expect(theme.variables["--accent"]).toBe("#6750A4FF");
    expect(theme.variables["--foreground"]).toBe("#1D1B20FF");
  });
});
