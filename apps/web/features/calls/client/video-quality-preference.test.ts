import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readVideoQualityPreference,
  writeVideoQualityPreference,
} from "./video-quality-preference";

describe("video quality preference", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const values = new Map<string, string>();
  const storage = {
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn(() => null),
    get length() {
      return values.size;
    },
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  } satisfies Storage;

  beforeEach(() => {
    values.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  afterAll(() => {
    if (originalStorage) {
      Object.defineProperty(window, "localStorage", originalStorage);
    }
  });

  it("defaults to automatic quality", () => {
    expect(readVideoQualityPreference()).toBe("auto");
  });

  it("remembers data saver on this device", () => {
    writeVideoQualityPreference("data-saver");

    expect(readVideoQualityPreference()).toBe("data-saver");
  });

  it("falls back to automatic quality for stale stored values", () => {
    window.localStorage.setItem("fish.video-quality-preference", "high");

    expect(readVideoQualityPreference()).toBe("auto");
  });

  it("keeps calls usable when browser storage is unavailable", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => writeVideoQualityPreference("data-saver")).not.toThrow();
    expect(readVideoQualityPreference()).toBe("auto");
  });
});
