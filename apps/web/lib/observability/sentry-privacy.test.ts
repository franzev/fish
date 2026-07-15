import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  sanitizeBreadcrumb,
  sanitizeSentryEvent,
  sanitizeText,
  sanitizeUrl,
} from "./sentry-privacy";

describe("Sentry privacy filtering", () => {
  it("removes query strings and redacts identifiers in URLs", () => {
    expect(
      sanitizeUrl(
        "https://fish.example/messages/123e4567-e89b-42d3-a456-426614174000?token_hash=secret#reply"
      )
    ).toBe("https://fish.example/messages/[id]");
  });

  it("redacts emails, tokens, UUIDs, and long identifiers from text", () => {
    const value = sanitizeText(
      "person@example.com 123e4567-e89b-42d3-a456-426614174000 abcdefghijkl.abcdefghijkl.abcdefghijkl abcdefghijklmnopqrstuvwxyz123456"
    );
    expect(value).toBe("[email] [id] [token] [identifier]");
  });

  it("drops console and click breadcrumbs", () => {
    expect(sanitizeBreadcrumb({ category: "console", message: "secret" })).toBeNull();
    expect(sanitizeBreadcrumb({ category: "ui.click", message: "message text" })).toBeNull();
  });

  it("removes request identity and payload data while preserving safe diagnostics", () => {
    const event: ErrorEvent = {
      type: undefined,
      breadcrumbs: [
        {
          category: "fetch",
          data: {
            method: "POST",
            status_code: 503,
            url: "https://fish.example/messages/id?body=secret",
            request_body_size: 100,
          },
        },
      ],
      exception: { values: [{ value: "Failed for person@example.com" }] },
      extra: { body: "secret" },
      request: {
        data: "secret",
        headers: { authorization: "Bearer secret" },
        query_string: "token=secret",
        url: "https://fish.example/reset-password?token=secret",
      },
      transaction:
        "/messages/123e4567-e89b-42d3-a456-426614174000?draft=secret",
      user: { email: "person@example.com" },
    };

    expect(sanitizeSentryEvent(event)).toMatchObject({
      breadcrumbs: [
        {
          category: "fetch",
          data: {
            method: "POST",
            status_code: 503,
            url: "https://fish.example/messages/id",
          },
        },
      ],
      exception: { values: [{ value: "Failed for [email]" }] },
      request: { url: "https://fish.example/reset-password" },
      transaction: "/messages/[id]",
    });
    expect(event.user).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
  });
});
