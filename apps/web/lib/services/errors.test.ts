import { describe, expect, it } from "vitest";
import {
  ServiceError,
  isServiceFailure,
  isServiceSuccess,
  normalizeServiceError,
  serviceFailure,
  serviceSuccess,
} from "./errors";

describe("service errors", () => {
  it("creates explicit success and failure result objects for service boundaries", () => {
    const success = serviceSuccess({ id: "profile-1" });
    const failure = serviceFailure(
      new ServiceError({
        code: "database",
        message: "Could not load profile.",
        operation: "profiles.findById",
      })
    );

    expect(isServiceSuccess(success)).toBe(true);
    expect(isServiceFailure(success)).toBe(false);
    expect(isServiceFailure(failure)).toBe(true);
    expect(isServiceSuccess(failure)).toBe(false);
  });

  it("normalizes unknown thrown values with operation context and cause", () => {
    const cause = new Error("socket closed");
    const error = normalizeServiceError(cause, {
      code: "network",
      message: "Request failed.",
      operation: "profiles.findById",
    });

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("network");
    expect(error.operation).toBe("profiles.findById");
    expect(error.cause).toBe(cause);
  });

  it("keeps existing ServiceError objects intact", () => {
    const original = new ServiceError({
      code: "auth",
      message: "Session missing.",
      operation: "auth.getCurrentUser",
    });

    expect(normalizeServiceError(original)).toBe(original);
  });
});
