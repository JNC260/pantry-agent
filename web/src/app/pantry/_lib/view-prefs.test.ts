import { describe, expect, it } from "vitest";
import { parsePrefs } from "./view-prefs";

describe("parsePrefs", () => {
  it("defaults when nothing is saved or it isn't valid JSON", () => {
    const defaults = { compact: false, collapsed: [] };
    expect(parsePrefs(null)).toEqual(defaults);
    expect(parsePrefs("{not json")).toEqual(defaults);
    expect(parsePrefs("42")).toEqual(defaults);
  });

  it("reads saved prefs, dropping unknown categories", () => {
    expect(
      parsePrefs(
        JSON.stringify({ compact: true, collapsed: ["frozen", "gadgets", "produce"] }),
      ),
    ).toEqual({ compact: true, collapsed: ["produce", "frozen"] });
  });

  it("ignores fields of the wrong type", () => {
    expect(parsePrefs(JSON.stringify({ compact: "yes", collapsed: "produce" }))).toEqual(
      { compact: false, collapsed: [] },
    );
  });
});
