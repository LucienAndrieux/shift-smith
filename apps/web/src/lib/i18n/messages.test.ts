import { describe, expect, it } from "vitest";
import { DICTIONARIES } from "./dictionaries";
import { translateMessage } from "./messages";

describe("translateMessage", () => {
  it("translates a schema message", () => {
    expect(translateMessage(DICTIONARIES.fr, "Enter a date")).toBe(
      "Saisissez une date",
    );
  });

  it("translates a numbered period error", () => {
    expect(
      translateMessage(DICTIONARIES.pt, "Period 2: end must be after start"),
    ).toBe("Período 2: o fim tem de ser depois do início");
  });

  it("keeps unknown messages and English as they are", () => {
    expect(translateMessage(DICTIONARIES.fr, "Something else")).toBe(
      "Something else",
    );
    expect(translateMessage(DICTIONARIES.en, "Enter a date")).toBe(
      "Enter a date",
    );
  });
});
