import { SupabaseChatRepository } from "./chat-repository";
import { SupabaseChatSearchRepository } from "./chat-search-repository";
import { SupabaseFriendRepository } from "./friend-repository";
import {
  SupabaseClientProfileRepository,
  SupabaseCoachClientRepository,
  SupabaseProfileRepository,
} from "./profile-repositories";
import type {
  ChatRepository,
  ChatSearchRepository,
  ClientProfileRepository,
  CoachClientRepository,
  DatabaseServices,
  FriendRepository,
  ProfileRepository,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

export class SupabaseDatabaseServiceImpl implements DatabaseServices {
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly chat: ChatRepository;
  readonly chatSearch: ChatSearchRepository;
  readonly friends: FriendRepository;

  constructor(readonly client: AppSupabaseClient) {
    this.profiles = new SupabaseProfileRepository(client);
    this.coachClients = new SupabaseCoachClientRepository(client);
    this.clientProfiles = new SupabaseClientProfileRepository(client);
    this.chat = new SupabaseChatRepository(client);
    this.chatSearch = new SupabaseChatSearchRepository(client);
    this.friends = new SupabaseFriendRepository(client);
  }
}
