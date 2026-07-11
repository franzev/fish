import { SupabaseChatRepository } from "./chat-repository";
import {
  SupabaseClientProfileRepository,
  SupabaseCoachClientRepository,
  SupabaseProfileRepository,
} from "./profile-repositories";
import type {
  AppSupabaseClient,
  ChatRepository,
  ClientProfileRepository,
  CoachClientRepository,
  ProfileRepository,
  SupabaseDatabaseService,
} from "./types";

export class SupabaseDatabaseServiceImpl implements SupabaseDatabaseService {
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly chat: ChatRepository;

  constructor(readonly client: AppSupabaseClient) {
    this.profiles = new SupabaseProfileRepository(client);
    this.coachClients = new SupabaseCoachClientRepository(client);
    this.clientProfiles = new SupabaseClientProfileRepository(client);
    this.chat = new SupabaseChatRepository(client);
  }
}
