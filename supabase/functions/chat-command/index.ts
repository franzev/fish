type ChatCommand =
  | {
      action: "edit-message";
      messageId: string;
      body: string;
    }
  | {
      action: "delete-message";
      messageId: string;
    }
  | {
      action: "toggle-reaction";
      messageId: string;
      emoji: string;
    }
  | {
      action: "set-reaction";
      messageId: string;
      emoji: string;
      active: boolean;
    }
  | {
      action: "report-gif";
      messageId: string;
    }
  | {
      action: "mark-read-state";
      conversationId: string;
      lastDeliveredMessageId: string | null;
      lastReadMessageId: string | null;
    }
  | {
      action: "refresh-messages";
      messageIds: string[];
    }
  | {
      action: "refresh-conversation";
      conversationId: string;
    };

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};
const reactionSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3/u;

function calmError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: jsonHeaders });
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => null);
}

function getPayloadMessage(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    return (payload[0] as Record<string, unknown> | undefined) ?? null;
  }

  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>;
  }

  return null;
}

async function getCaller(
  supabaseUrl: string,
  apiKey: string,
  authHeader: string,
): Promise<string | null> {
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      Authorization: authHeader,
    },
  });

  if (!authResponse.ok) {
    console.error("chat-command caller auth check failed", {
      status: authResponse.status,
      body: await authResponse.clone().text().catch(() => ""),
    });
    return null;
  }

  const payload = await readJson(authResponse);
  if (typeof payload === "object" && payload !== null && "id" in payload) {
    return String((payload as { id?: unknown }).id ?? "");
  }

  return null;
}

async function rpc(
  supabaseUrl: string,
  apiKey: string,
  authHeader: string,
  name: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: authHeader,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function readReactionEmoji(value: unknown): string | null {
  const emoji = typeof value === "string" ? value.trim() : "";
  if (!emoji || emoji.length > 16 || !emojiPattern.test(emoji)) return null;
  const segments = Array.from(reactionSegmenter.segment(emoji));
  return segments.length === 1 && segments[0]?.segment === emoji ? emoji : null;
}

async function enrichMessages(
  supabaseUrl: string,
  apiKey: string,
  authHeader: string,
  messages: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const messageIds = messages.map((message) => String(message.id ?? "")).filter(Boolean);
  if (messageIds.length === 0) return messages.map((message) => ({ ...message, reactions: [] }));

  const reactionsByMessage = new Map<
    string,
    Array<{ emoji: string; count: number; by_me: boolean }>
  >();
  for (let start = 0; start < messageIds.length; start += 50) {
    const response = await rpc(
      supabaseUrl,
      apiKey,
      authHeader,
      "list_message_reaction_summaries",
      { p_message_ids: messageIds.slice(start, start + 50) },
    );
    const payload = await readJson(response);
    if (!response.ok || !Array.isArray(payload)) continue;

    for (const row of payload as Array<Record<string, unknown>>) {
      const messageId = typeof row.message_id === "string" ? row.message_id : "";
      const emoji = typeof row.emoji === "string" ? row.emoji : "";
      const count = typeof row.count === "number" ? row.count : Number(row.count);
      if (!messageId || !emoji || !Number.isSafeInteger(count) || count < 1) continue;
      const reactions = reactionsByMessage.get(messageId) ?? [];
      reactions.push({ emoji, count, by_me: row.by_me === true });
      reactionsByMessage.set(messageId, reactions);
    }
  }

  return messages.map((message) => ({
    ...message,
    reactions: reactionsByMessage.get(String(message.id ?? "")) ?? [],
  }));
}

async function enrichMessage(
  supabaseUrl: string,
  apiKey: string,
  authHeader: string,
  message: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await enrichMessages(supabaseUrl, apiKey, authHeader, [message]))[0] ?? {
    ...message,
    reactions: [],
  };
}

function mapCommandError(payload: unknown): { error: string; status: number } {
  const rawMessage =
    typeof payload === "object" && payload !== null && "message" in payload
      ? String((payload as { message?: unknown }).message ?? "")
      : "";
  const message = rawMessage.toLowerCase();

  if (message.includes("not found")) {
    return { error: "That message is not available.", status: 404 };
  }

  if (message.includes("required") || message.includes("too long")) {
    return {
      error: message.includes("too long")
        ? "This message is a little long. Try sending it in two parts."
        : "Add a message before saving.",
      status: 400,
    };
  }

  if (message.includes("reaction")) {
    return { error: "That reaction is not available.", status: 400 };
  }

  return {
    error: "That did not save yet. Keep this open and try again.",
    status: 500,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return calmError("Use a post request for chat updates.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const apiKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization");

  if (!supabaseUrl || !apiKey || !authHeader) {
    console.error("chat-command missing runtime auth configuration", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasApiKey: Boolean(apiKey),
      hasAuthHeader: Boolean(authHeader),
    });
    return calmError("That did not save yet. Keep this open and try again.", 401);
  }

  let command: Partial<ChatCommand>;
  try {
    command = (await request.json()) as Partial<ChatCommand>;
  } catch {
    return calmError("That did not save yet. Keep this open and try again.", 400);
  }

  const callerId = await getCaller(supabaseUrl, apiKey, authHeader);
  if (!callerId) {
    return calmError("That did not save yet. Keep this open and try again.", 401);
  }

  let response: Response;
  if (command.action === "edit-message") {
    const body = command.body?.trim() ?? "";
    if (!command.messageId || !body) {
      return calmError("Add a message before saving.", 400);
    }
    response = await rpc(supabaseUrl, apiKey, authHeader, "edit_chat_message", {
      p_message_id: command.messageId,
      p_body: body,
    });
  } else if (command.action === "delete-message") {
    if (!command.messageId) {
      return calmError("That message is not available.", 400);
    }

    response = await rpc(supabaseUrl, apiKey, authHeader, "delete_chat_message", {
      p_message_id: command.messageId,
    });
  } else if (command.action === "toggle-reaction") {
    const emoji = readReactionEmoji(command.emoji);
    if (!command.messageId || !emoji) {
      return calmError("That reaction is not available.", 400);
    }

    response = await rpc(supabaseUrl, apiKey, authHeader, "toggle_message_reaction", {
      p_message_id: command.messageId,
      p_emoji: emoji,
    });
  } else if (command.action === "set-reaction") {
    const emoji = readReactionEmoji(command.emoji);
    if (!command.messageId || !emoji || typeof command.active !== "boolean") {
      return calmError("That reaction is not available.", 400);
    }

    response = await rpc(supabaseUrl, apiKey, authHeader, "set_message_reaction", {
      p_message_id: command.messageId,
      p_emoji: emoji,
      p_active: command.active,
    });
  } else if (command.action === "report-gif") {
    if (!command.messageId) {
      return calmError("That GIF is not available.", 400);
    }
    response = await rpc(supabaseUrl, apiKey, authHeader, "report_message_gif", {
      p_message_id: command.messageId,
    });
  } else if (command.action === "mark-read-state") {
    if (!command.conversationId) {
      return calmError("That conversation is not available.", 400);
    }

    response = await rpc(supabaseUrl, apiKey, authHeader, "mark_chat_read_state", {
      p_conversation_id: command.conversationId,
      p_last_delivered_message_id: command.lastDeliveredMessageId ?? null,
      p_last_read_message_id: command.lastReadMessageId ?? null,
    });
  } else if (command.action === "refresh-messages") {
    const messageIds = Array.isArray(command.messageIds)
      ? [...new Set(command.messageIds.filter((id) => typeof id === "string" && id))]
      : [];
    if (messageIds.length === 0 || messageIds.length > 50) {
      return calmError("That message is not available.", 400);
    }

    const idsFilter = messageIds.map((id) => encodeURIComponent(id)).join(",");
    const messageResponse = await fetch(
      `${supabaseUrl}/rest/v1/messages?select=*&id=in.(${idsFilter})`,
      {
        headers: {
          apikey: apiKey,
          Authorization: authHeader,
        },
      },
    );
    const messagesPayload = await readJson(messageResponse);
    if (!messageResponse.ok || !Array.isArray(messagesPayload)) {
      const mapped = mapCommandError(messagesPayload);
      return calmError(mapped.error, mapped.status);
    }

    return Response.json(
      {
        messages: await enrichMessages(
          supabaseUrl,
          apiKey,
          authHeader,
          messagesPayload as Record<string, unknown>[],
        ),
      },
      { headers: jsonHeaders },
    );
  } else if (command.action === "refresh-conversation") {
    if (!command.conversationId) {
      return calmError("That conversation is not available.", 400);
    }

    const messageResponse = await fetch(
      `${supabaseUrl}/rest/v1/messages?select=*&conversation_id=eq.${command.conversationId}&order=created_at.asc,id.asc`,
      {
        headers: {
          apikey: apiKey,
          Authorization: authHeader,
        },
      },
    );
    const messagesPayload = await readJson(messageResponse);
    if (!messageResponse.ok || !Array.isArray(messagesPayload)) {
      const mapped = mapCommandError(messagesPayload);
      return calmError(mapped.error, mapped.status);
    }

    const readStateResponse = await fetch(
      `${supabaseUrl}/rest/v1/message_reads?select=*&conversation_id=eq.${command.conversationId}`,
      {
        headers: {
          apikey: apiKey,
          Authorization: authHeader,
        },
      },
    );
    const readStatesPayload = await readJson(readStateResponse);
    if (!readStateResponse.ok || !Array.isArray(readStatesPayload)) {
      const mapped = mapCommandError(readStatesPayload);
      return calmError(mapped.error, mapped.status);
    }

    return Response.json(
      {
        messages: await enrichMessages(
          supabaseUrl,
          apiKey,
          authHeader,
          messagesPayload as Record<string, unknown>[],
        ),
        readStates: readStatesPayload,
      },
      { headers: jsonHeaders },
    );
  } else {
    return calmError("That chat action is not available.", 400);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const mapped = mapCommandError(payload);
    return calmError(mapped.error, mapped.status);
  }

  if (command.action === "report-gif") {
    return Response.json({ reported: payload === true }, { headers: jsonHeaders });
  }

  if (command.action === "mark-read-state") {
    return Response.json({ readState: getPayloadMessage(payload) }, { headers: jsonHeaders });
  }

  const message = getPayloadMessage(payload);
  if (!message) {
    return calmError("That did not save yet. Keep this open and try again.", 500);
  }

  return Response.json(
    {
      message: await enrichMessage(
        supabaseUrl,
        apiKey,
        authHeader,
        message,
      ),
    },
    { headers: jsonHeaders },
  );
});
