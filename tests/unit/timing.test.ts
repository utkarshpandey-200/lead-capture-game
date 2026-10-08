import { describe, it, expect } from "vitest";
import { resolveElapsedMs } from "../../src/shared/timing";

const limitMs = 20000;
const toleranceMs = 3000;

describe("resolveElapsedMs", () => {
  it("trusts a client value that matches the server's observation", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: 5000, serverElapsedMs: 5000, limitMs, toleranceMs })
    ).toBe(5000);
  });

  it("trusts a client value slightly below the server's (network latency)", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: 4500, serverElapsedMs: 5200, limitMs, toleranceMs })
    ).toBe(4500);
  });

  it("falls back to server time when client claims longer than the server saw", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: 6000, serverElapsedMs: 5000, limitMs, toleranceMs })
    ).toBe(5000);
  });

  it("falls back to server time when client is more than tolerance below server", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: 1000, serverElapsedMs: 5000, limitMs, toleranceMs })
    ).toBe(5000);
  });

  it("accepts a client value exactly at the tolerance boundary", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: 2000, serverElapsedMs: 5000, limitMs, toleranceMs })
    ).toBe(2000);
  });

  it("rejects a negative client value", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: -100, serverElapsedMs: 5000, limitMs, toleranceMs })
    ).toBe(5000);
  });

  it("rejects a client value above the limit", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: 25000, serverElapsedMs: 19000, limitMs, toleranceMs })
    ).toBe(19000);
  });

  it("clamps server time to the limit on a very slow network round trip", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: null, serverElapsedMs: 30000, limitMs, toleranceMs })
    ).toBe(20000);
  });

  it("uses server time when client value is missing", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: undefined, serverElapsedMs: 7000, limitMs, toleranceMs })
    ).toBe(7000);
  });

  it("clamps a negative server time to zero", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: null, serverElapsedMs: -50, limitMs, toleranceMs })
    ).toBe(0);
  });

  it("rejects a non-finite client value", () => {
    expect(
      resolveElapsedMs({ clientElapsedMs: Number.NaN, serverElapsedMs: 4000, limitMs, toleranceMs })
    ).toBe(4000);
  });
});
