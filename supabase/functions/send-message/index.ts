type SendMessageCommand = {
  conversationId: string;
  body: string;
  clientRequestId: string;
  replyToMessageId?: string | null;
  attachmentIds?: string[];
  gif?: ChatGif;
};

type ChatGif = {
  provider: "klipy" | "giphy";
  providerId: string;
  title: string;
  description: string;
  sourceUrl: string;
  posterUrl: string;
  previewUrl: string;
  mediaUrl: string;
  width: number;
  height: number;
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

function hostname(value: unknown): string {
  try {
    return new URL(String(value)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isValidGif(value: unknown): value is ChatGif {
  if (!value || typeof value !== "object") return false;
  const gif = value as Partial<ChatGif>;
  if (
    (gif.provider !== "klipy" && gif.provider !== "giphy")
    || typeof gif.providerId !== "string" || gif.providerId.length < 1 || gif.providerId.length > 200
    || typeof gif.title !== "string" || gif.title.length < 1 || gif.title.length > 300
    || typeof gif.description !== "string" || gif.description.length < 1 || gif.description.length > 500
    || !Number.isInteger(gif.width) || Number(gif.width) < 1 || Number(gif.width) > 4096
    || !Number.isInteger(gif.height) || Number(gif.height) < 1 || Number(gif.height) > 4096
  ) return false;

  const sourceHost = hostname(gif.sourceUrl);
  const mediaHosts = [gif.posterUrl, gif.previewUrl, gif.mediaUrl].map(hostname);
  return gif.provider === "klipy"
    ? (sourceHost === "klipy.com" || sourceHost.endsWith(".klipy.com"))
      && mediaHosts.every((host) => /^static\d*\.klipy\.com$/.test(host))
    : (sourceHost === "giphy.com" || sourceHost.endsWith(".giphy.com"))
      && mediaHosts.every((host) => /^media\d*\.giphy\.com$/.test(host));
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
  const gif = command.gif;

  const attachmentIds = Array.isArray(command.attachmentIds)
    ? [...new Set(command.attachmentIds.filter((id) => typeof id === "string" && id))]
    : [];

  if (!command.conversationId || (!body && attachmentIds.length === 0 && !gif) || !clientRequestId) {
    return calmError("Add a message before sending.", 400);
  }

  if (gif && !isValidGif(gif)) {
    return calmError("That GIF is not available. Choose another one.", 400);
  }
  if (gif && attachmentIds.length > 0) {
    return calmError("Send the GIF or the files first, then send the other.", 400);
  }

  if (body.length > chatLimits.messageBodyMaxLength) {
    return calmError(
      "This message is a little long. Try sending it in two parts.",
      400,
    );
  }
  if (attachmentIds.length > 5) {
    return calmError("Add up to five images to one message.", 400);
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
      p_attachment_ids: attachmentIds,
      p_gif: gif ?? null,
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
