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

async function enrichMessage(
  supabaseUrl: string,
  apiKey: string,
  authHeader: string,
  callerId: string,
  message: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const messageId = String(message.id ?? "");
  if (!messageId) {
    return { ...message, reactions: [] };
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/message_reactions?select=emoji,user_id&message_id=eq.${messageId}&removed_at=is.null`,
    {
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
      },
    },
  );

  if (!response.ok) {
    return { ...message, reactions: [] };
  }

  const rows = (await readJson(response)) as
    | Array<{ emoji?: string; user_id?: string }>
    | null;
  const reactions = new Map<string, { emoji: string; count: number; by_me: boolean }>();

  for (const row of rows ?? []) {
    if (!row.emoji) continue;
    const current = reactions.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      by_me: false,
    };
    reactions.set(row.emoji, {
      emoji: row.emoji,
      count: current.count + 1,
      by_me: current.by_me || row.user_id === callerId,
    });
  }

  return { ...message, reactions: Array.from(reactions.values()) };
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
    const emoji = command.emoji?.trim() ?? "";
    if (!command.messageId || !emoji) {
      return calmError("That reaction is not available.", 400);
    }

    response = await rpc(supabaseUrl, apiKey, authHeader, "toggle_message_reaction", {
      p_message_id: command.messageId,
      p_emoji: emoji,
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
        messages: await Promise.all(
          messagesPayload.map((message) =>
            enrichMessage(
              supabaseUrl,
              apiKey,
              authHeader,
              callerId,
              message as Record<string, unknown>,
            )
          ),
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
        messages: await Promise.all(
          messagesPayload.map((message) =>
            enrichMessage(
              supabaseUrl,
              apiKey,
              authHeader,
              callerId,
              message as Record<string, unknown>,
            )
          ),
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
        callerId,
        message,
      ),
    },
    { headers: jsonHeaders },
  );
});
