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
  SupabaseRealtimeService,
  SupabaseStorageService,
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

export class SupabaseStorageServiceImpl implements SupabaseStorageService {
  constructor(readonly client: AppSupabaseClient) {}

  from(bucket: string): ReturnType<AppSupabaseClient["storage"]["from"]> {
    return this.client.storage.from(bucket);
  }
}

export class SupabaseRealtimeServiceImpl implements SupabaseRealtimeService {
  constructor(readonly client: AppSupabaseClient) {}

  channel(
    topic: string,
    options?: Parameters<AppSupabaseClient["channel"]>[1]
  ): ReturnType<AppSupabaseClient["channel"]> {
    return this.client.channel(topic, options);
  }
}
