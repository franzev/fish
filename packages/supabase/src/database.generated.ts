// GENERATED FILE -- overwritten by:
//   supabase gen types typescript --local > packages/supabase/src/database.generated.ts
//
// Contains ONLY real, migrated tables (profiles, coach_clients). Never edit by hand once
// Task 4 has run `supabase gen types` against the real schema -- edit the migrations
// instead and regenerate. The legacy chat tables are NOT created by any migration yet and
// must never appear here; they live in database.types.ts as hand-written, clearly-marked
// not-yet-migrated contracts.
//
// This is a placeholder shape (matching the 0001/0003 migrations) so
// `pnpm --filter @fish/supabase typecheck` passes before Task 4's schema push and
// regeneration overwrite it with the real `supabase gen types` output.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coach_clients: {
        Row: {
          coach_id: string;
          client_id: string;
          assigned_at: string;
        };
        Insert: {
          coach_id: string;
          client_id: string;
          assigned_at?: string;
        };
        Update: {
          coach_id?: string;
          client_id?: string;
          assigned_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
