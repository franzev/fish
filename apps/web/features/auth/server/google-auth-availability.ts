import "server-only";

interface GoogleAuthEnv {
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID?: string;
  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET?: string;
}

export function isGoogleAuthAvailable(
  env: GoogleAuthEnv = {
    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID,
    SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET:
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET,
  }
): boolean {
  return Boolean(
    env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID?.trim() &&
      env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET?.trim()
  );
}
