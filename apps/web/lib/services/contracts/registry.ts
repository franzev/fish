import type { AuthService } from "./auth";
import type { AvatarCommandService } from "./avatars";
import type { BookingCommandService, LessonRepository } from "./booking";
import type { ChatCommandService, ChatRepository, ChatSearchRepository } from "./chat";
import type { FriendRepository } from "./friends";
import type { NotificationRepository, NavigationAttentionRepository } from "./notifications";
import type { CoachClientRepository, ClientProfileRepository, ProfileRepository } from "./profiles";
import type { PresenceRepository } from "./presence";

export interface DatabaseServices {
  profiles: ProfileRepository;
  coachClients: CoachClientRepository;
  clientProfiles: ClientProfileRepository;
  lessons: LessonRepository;
  chat: ChatRepository;
  chatSearch: ChatSearchRepository;
  friends: FriendRepository;
  notifications: NotificationRepository;
  attention: NavigationAttentionRepository;
  presence: PresenceRepository;
}

export interface AppServices {
  auth: AuthService;
  database: DatabaseServices;
  avatars: AvatarCommandService;
}

export interface ServerServices extends AppServices {
  chatCommands: ChatCommandService;
  bookingCommands: BookingCommandService;
}
