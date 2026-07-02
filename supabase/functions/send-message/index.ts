import { chatLimits, type SendMessageCommand } from "../../../packages/core/src";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Send messages with a post request." },
      { status: 405, headers: jsonHeaders },
    );
  }

  const command = (await request.json()) as Partial<SendMessageCommand>;
  const body = command.body?.trim();

  if (!command.conversationId || !body) {
    return Response.json(
      { error: "Add a message before sending." },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (body.length > chatLimits.messageBodyMaxLength) {
    return Response.json(
      { error: "This message is a little long. Try sending it in two parts." },
      { status: 400, headers: jsonHeaders },
    );
  }

  return Response.json(
    {
      accepted: true,
      conversationId: command.conversationId,
      clientRequestId: command.clientRequestId ?? null,
    },
    { headers: jsonHeaders },
  );
});
