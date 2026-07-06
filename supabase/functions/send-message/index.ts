type SendMessageCommand = {
  conversationId: string;
  body: string;
  clientRequestId: string;
  replyToMessageId?: string | null;
};

const chatLimits = {
  messageBodyMaxLength: 4000,
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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return calmError("Send messages with a post request.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const apiKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization");

  if (!supabaseUrl || !apiKey || !authHeader) {
    console.error("send-message missing runtime auth configuration", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasApiKey: Boolean(apiKey),
      hasAuthHeader: Boolean(authHeader),
    });
    return calmError("That did not send yet. Keep this open and try again.", 401);
  }

  let command: Partial<SendMessageCommand>;
  try {
    command = (await request.json()) as Partial<SendMessageCommand>;
  } catch {
    return calmError("Add a message before sending.", 400);
  }

  const body = command.body?.trim() ?? "";
  const clientRequestId = command.clientRequestId?.trim() ?? "";
  const replyToMessageId = command.replyToMessageId?.trim() || null;

  if (!command.conversationId || !body || !clientRequestId) {
    return calmError("Add a message before sending.", 400);
  }

  if (body.length > chatLimits.messageBodyMaxLength) {
    return calmError(
      "This message is a little long. Try sending it in two parts.",
      400,
    );
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      Authorization: authHeader,
    },
  });
  if (!authResponse.ok) {
    console.error("send-message caller auth check failed", {
      status: authResponse.status,
      body: await authResponse.clone().text().catch(() => ""),
    });
    return calmError("That did not send yet. Keep this open and try again.", 401);
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/send_chat_message`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: authHeader,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_conversation_id: command.conversationId,
      p_body: body,
      p_client_request_id: clientRequestId,
      p_reply_to_message_id: replyToMessageId,
    }),
  });

  const payload = await readJson(rpcResponse);
  if (!rpcResponse.ok) {
    const rawMessage =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "")
        : "";
    const message = rawMessage.toLowerCase();
    if (message.includes("conversation not found")) {
      return calmError("That conversation is not available.", 403);
    }
    if (message.includes("conflicts")) {
      return calmError("That send is already in progress. Try once more.", 409);
    }
    if (message.includes("reply target")) {
      return calmError("That message is no longer available.", 400);
    }
    if (message.includes("required") || message.includes("too long")) {
      return calmError(
        message.includes("too long")
          ? "This message is a little long. Try sending it in two parts."
          : "Add a message before sending.",
        400,
      );
    }

    return calmError("That did not send yet. Keep this open and try again.", 500);
  }

  return Response.json({ message: payload }, { headers: jsonHeaders });
});
