import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { z } from "npm:zod@4.4.3";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json" };

const commandSchema = z.object({
  action: z.literal("book"),
  slotId: z.uuid(),
});

type LessonSlotRow = {
  id: string;
  coach_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  booked_by_client_id: string | null;
  booked_at: string | null;
};

function calmError(code: string, error: string, status: number) {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

function clientSlot(slot: LessonSlotRow) {
  return {
    id: slot.id,
    coachId: slot.coach_id,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    durationMinutes: slot.duration_minutes,
    bookedByClientId: slot.booked_by_client_id,
    bookedAt: slot.booked_at,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request to book a lesson.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in before booking a lesson.", 401);
  }

  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return calmError("invalid_request", "Choose an available lesson time.", 400);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) {
    return calmError("not_authenticated", "Sign in before booking a lesson.", 401);
  }

  const { data, error } = await caller.rpc("book_lesson_slot", {
    p_slot_id: parsed.data.slotId,
  });
  if (error) {
    console.error("lesson booking failed", { code: error.code });
    const conflict = error.message.includes("unavailable") ||
      error.message.includes("conflicts");
    return calmError(
      conflict ? "slot_unavailable" : "booking_unavailable",
      conflict
        ? "That time was just booked. Choose another available time."
        : "Booking is taking a break. Your lesson was not booked yet.",
      conflict ? 409 : 503,
    );
  }

  const slot = Array.isArray(data) ? data[0] : data;
  if (!slot) {
    return calmError("booking_unavailable", "Booking is taking a break. Your lesson was not booked yet.", 503);
  }

  return Response.json({ slot: clientSlot(slot as LessonSlotRow) }, { headers: jsonHeaders });
});
