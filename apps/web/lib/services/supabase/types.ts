import type { Database } from "@fish/supabase";
import type {
  RealtimeChannel,
  RealtimeChannelOptions,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import type { ServiceResult } from "../errors";
import type { CoachClientRow, ProfileRow } from "@fish/supabase";

export type AppSupabaseClient = SupabaseClient<Database>;

export interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export interface MutableCookieStore {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: CookieOptions): void;
}

export interface SupabaseAuthService {
  readonly client: AppSupabaseClient;
  getCurrentUser(): Promise<ServiceResult<User | null>>;
  refreshSessionClaims(): Promise<ServiceResult<void>>;
  signOut(): Promise<ServiceResult<void>>;
}

export interface ProfileRepository {
  findById(id: string): Promise<ServiceResult<ProfileRow | null>>;
  findRoleById(id: string): Promise<ServiceResult<Pick<ProfileRow, "role"> | null>>;
  findDisplayNameById(
    id: string
  ): Promise<ServiceResult<Pick<ProfileRow, "display_name"> | null>>;
}

export interface CoachClientListItem {
  id: string;
  displayName: string;
  email: string;
}

export interface CoachClientRepository {
  findAssignmentForClient(
    clientId: string
  ): Promise<ServiceResult<Pick<CoachClientRow, "coach_id"> | null>>;
  listAssignedClients(): Promise<ServiceResult<CoachClientListItem[]>>;
}

export interface SupabaseDatabaseService {
  readonly client: AppSupabaseClient;
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
}

export interface SupabaseStorageService {
  readonly client: AppSupabaseClient;
  from(bucket: string): ReturnType<AppSupabaseClient["storage"]["from"]>;
}

export interface SupabaseRealtimeService {
  readonly client: AppSupabaseClient;
  channel(
    topic: string,
    options?: RealtimeChannelOptions
  ): RealtimeChannel;
}

export interface SupabaseServices {
  readonly client: AppSupabaseClient;
  readonly auth: SupabaseAuthService;
  readonly database: SupabaseDatabaseService;
  readonly storage: SupabaseStorageService;
  readonly realtime: SupabaseRealtimeService;
}
