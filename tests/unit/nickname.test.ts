import { describe, it, expect } from "vitest";
import { checkNickname } from "../../src/shared/nickname";

const blocklist = ["fuck", "shit", "nazi"];

describe("checkNickname", () => {
  it("accepts a normal nickname", () => {
    expect(checkNickname("RiskyBusiness", blocklist)).toEqual({ valid: true });
  });

  it("rejects an empty nickname", () => {
    expect(checkNickname("   ", blocklist).valid).toBe(false);
  });

  it("rejects a nickname over 20 characters", () => {
    expect(checkNickname("a".repeat(21), blocklist)).toEqual({
      valid: false,
      reason: "too_long",
    });
  });

  it("accepts exactly 20 characters", () => {
    expect(checkNickname("a".repeat(20), blocklist).valid).toBe(true);
  });

  it("blocks a blocklisted word regardless of case or punctuation", () => {
    expect(checkNickname("Sh1t-head", blocklist).valid).toBe(true); // leet-speak substitution isn't caught, documented limitation
    expect(checkNickname("shit-head", blocklist)).toEqual({ valid: false, reason: "blocked" });
    expect(checkNickname("SHIT", blocklist).valid).toBe(false);
  });

  it("blocks a word embedded inside a longer string", () => {
    expect(checkNickname("nazisympathizer", blocklist).valid).toBe(false);
  });
});
