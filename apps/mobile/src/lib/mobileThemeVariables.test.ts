import { describe, expect, it } from "vite-plus/test";

import { readDefaultMobileThemeVariables } from "./mobileTheme.test-support";
import { getMobileThemeVariables, MOBILE_THEME_IDS, themeColorWithAlpha } from "./mobileTheme";
import { getMobileThemeRuntimeVariables } from "./mobileThemeVariables";

describe("mobile theme runtime variables", () => {
  it("matches the standard base palette to the generated stylesheet", () => {
    expect(getMobileThemeRuntimeVariables("t3-code", "light", "web")).toEqual(
      readDefaultMobileThemeVariables("light"),
    );
    expect(getMobileThemeRuntimeVariables("t3-code", "dark", "web")).toEqual(
      readDefaultMobileThemeVariables("dark"),
    );
  });

  it("uses the same shared palette source as generated custom themes", () => {
    expect(getMobileThemeRuntimeVariables("ocean", "light", "ios")).toEqual(
      getMobileThemeVariables("ocean", "light"),
    );
    expect(getMobileThemeRuntimeVariables("iris", "dark", "ios")).toEqual(
      getMobileThemeVariables("iris", "dark"),
    );
  });

  it.each(MOBILE_THEME_IDS)("paints %s Android headers with the screen color", (themeId) => {
    for (const appearance of ["light", "dark"] as const) {
      const base = getMobileThemeVariables(
        themeId === "material-you" ? "t3-code" : themeId,
        appearance,
      );
      const android = getMobileThemeRuntimeVariables(themeId, appearance, "android");
      const ios = getMobileThemeRuntimeVariables(themeId, appearance, "ios");
      expect(android).toEqual({
        ...ios,
        "--color-header": themeColorWithAlpha(base["--color-screen"], 1),
        "--color-header-foreground": base["--color-foreground"],
      });
      expect(android["--color-header"]).toMatch(/^rgba\(\d+, \d+, \d+, 1\)$/);
    }
  });

  it.each(["t3-code", "material-you"] as const)(
    "adapts %s iPad chrome without reversing the dark desktop hierarchy",
    (themeId) => {
      for (const appearance of ["light", "dark"] as const) {
        const ios = getMobileThemeRuntimeVariables(themeId, appearance, "ios");
        const android = getMobileThemeRuntimeVariables(themeId, appearance, "android");
        if (appearance === "light") {
          expect(ios["--color-drawer"]).toBe("rgba(244, 244, 245, 1)");
          expect(ios["--color-header"]).toBe(ios["--color-drawer"]);
          expect(ios["--color-header-foreground"]).toBe(ios["--color-drawer-foreground"]);
        } else {
          expect(ios).toEqual(getMobileThemeVariables("t3-code", appearance));
          expect(ios["--color-drawer"]).toBe("#000000");
          expect(ios["--color-screen"]).toBe("#0a0a0a");
        }
        expect(themeColorWithAlpha(ios["--color-thread-hover"], 1)).not.toBe(
          themeColorWithAlpha(ios["--color-drawer"], 1),
        );
        expect(themeColorWithAlpha(ios["--color-thread-hover"], 1)).not.toBe(
          themeColorWithAlpha(ios["--color-thread-selected"], 1),
        );
        for (const role of [
          "--color-screen",
          "--color-drawer",
          "--color-card",
          "--color-composer-surface",
          "--color-grouped-card",
        ] as const) {
          expect(ios[role]).toBe(android[role]);
        }
      }
    },
  );
});
