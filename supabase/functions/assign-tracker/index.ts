import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { z } from "npm:zod@4.4.3";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

const requestSchema = z.strictObject({
  clientId: z.string().uuid(),
});

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Assign trackers with a post request." },
      { status: 405, headers: jsonHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return Response.json(
      { error: "Tracker assignment is not ready yet." },
      { status: 500, headers: jsonHeaders },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Choose an assigned client before continuing." },
      { status: 400, headers: jsonHeaders },
    );
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  const coachId = userData.user?.id;
  if (userError || !coachId) {
    return Response.json(
      { error: "Sign in again before assigning a tracker." },
      { status: 401, headers: jsonHeaders },
    );
  }

  const { data: profile, error: profileError } = await caller
    .from("profiles")
    .select("role")
    .eq("id", coachId)
    .maybeSingle();
  if (profileError || profile?.role !== "coach") {
    return Response.json(
      { error: "Only coaches can assign trackers." },
      { status: 403, headers: jsonHeaders },
    );
  }

  const { data: assignment, error: assignmentError } = await caller
    .from("coach_clients")
    .select("client_id")
    .eq("coach_id", coachId)
    .eq("client_id", parsed.data.clientId)
    .maybeSingle();
  if (assignmentError || !assignment) {
    return Response.json(
      { error: "That client is not assigned to you." },
      { status: 403, headers: jsonHeaders },
    );
  }

  const { data: version, error: versionError } = await admin
    .from("tracker_config_versions")
    .select("id")
    .eq("status", "published")
    .eq("is_active", true)
    .maybeSingle();
  if (versionError || !version) {
    return Response.json(
      { error: "No tracker is ready to assign yet." },
      { status: 409, headers: jsonHeaders },
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("tracker_assignments")
    .select("id, coach_id, version_id, status")
    .eq("client_id", parsed.data.clientId)
    .eq("status", "active")
    .maybeSingle();
  if (existingError) {
    return Response.json(
      { error: "That did not save yet. Try again in a moment." },
      { status: 500, headers: jsonHeaders },
    );
  }

  if (existing) {
    if (existing.coach_id === coachId && existing.version_id === version.id) {
      return Response.json(
        { assignmentId: existing.id, status: "active" },
        { status: 200, headers: jsonHeaders },
      );
    }

    return Response.json(
      { error: "This client already has an active tracker." },
      { status: 409, headers: jsonHeaders },
    );
  }

  const { data: created, error: createError } = await admin
    .from("tracker_assignments")
    .insert({
      client_id: parsed.data.clientId,
      coach_id: coachId,
      version_id: version.id,
    })
    .select("id")
    .single();
  if (createError || !created) {
    return Response.json(
      { error: "That did not save yet. Try again in a moment." },
      { status: 500, headers: jsonHeaders },
    );
  }

  return Response.json(
    { assignmentId: created.id, status: "active" },
    { status: 201, headers: jsonHeaders },
  );
});
