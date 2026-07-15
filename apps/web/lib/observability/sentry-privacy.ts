import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const jwtPattern = /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const longIdentifierPattern = /\b[A-Za-z0-9_-]{32,}\b/g;

export function sanitizeText(value: string): string {
  return value
    .replace(emailPattern, "[email]")
    .replace(jwtPattern, "[token]")
    .replace(uuidPattern, "[id]")
    .replace(longIdentifierPattern, "[identifier]");
}

function sanitizePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => sanitizeText(segment))
    .join("/");
}

export function sanitizeUrl(value: string): string {
  try {
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(value);
    const url = new URL(value, "https://fish.invalid");
    const path = sanitizePath(url.pathname);
    return absolute ? `${url.origin}${path}` : path;
  } catch {
    return sanitizeText(value.split(/[?#]/, 1)[0] ?? "");
  }
}

function safeBreadcrumbData(
  data: Breadcrumb["data"]
): Breadcrumb["data"] {
  if (!data) return undefined;

  const safe: Record<string, unknown> = {};
  for (const key of ["method", "status_code"] as const) {
    if (typeof data[key] === "string" || typeof data[key] === "number") {
      safe[key] = data[key];
    }
  }
  for (const key of ["url", "from", "to"] as const) {
    if (typeof data[key] === "string") safe[key] = sanitizeUrl(data[key]);
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function sanitizeBreadcrumb(
  breadcrumb: Breadcrumb
): Breadcrumb | null {
  if (
    breadcrumb.category === "console" ||
    breadcrumb.category === "ui.click"
  ) {
    return null;
  }

  return {
    ...breadcrumb,
    data: safeBreadcrumbData(breadcrumb.data),
    message:
      typeof breadcrumb.message === "string"
        ? sanitizeText(breadcrumb.message)
        : breadcrumb.message,
  };
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.extra;

  if (event.request) {
    const request = event.request as ErrorEvent["request"] &
      Record<string, unknown>;
    if (typeof request.url === "string") {
      request.url = sanitizeUrl(request.url);
    }
    delete request.cookies;
    delete request.data;
    delete request.env;
    delete request.headers;
    delete request.query_string;
  }

  if (typeof event.message === "string") {
    event.message = sanitizeText(event.message);
  }
  if (typeof event.transaction === "string") {
    event.transaction = sanitizeUrl(event.transaction);
  }
  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string") {
      value.value = sanitizeText(value.value);
    }
  }

  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === "string") event.tags[key] = sanitizeText(value);
    }
  }

  event.breadcrumbs = event.breadcrumbs
    ?.map(sanitizeBreadcrumb)
    .filter((value): value is Breadcrumb => value !== null);
  return event;
}
