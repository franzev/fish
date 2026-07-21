import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { processLinkPreviewJobs } from "../_shared/link-preview.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "post_required" }, { status: 405 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return Response.json({ error: "not_configured" }, { status: 503 });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  await processLinkPreviewJobs(admin);
  return Response.json({ ok: true });
});
