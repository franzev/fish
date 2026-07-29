// FriendsData is the provider-neutral friends control plane: the domain
// models of the deployed friends contract (migrations 0021/0024 and the
// `friend-command` Edge Function), the adapters that speak it — username
// search and incoming-request reads over PostgREST RPCs, send/respond over
// the Edge Function, and the private `friends:user:{id}` broadcast channel —
// and the protocols feature code depends on. Live adapters are constructed
// only at the app boundary; feature code sees the protocols. Only `Adapters/`
// speaks Supabase. This module never imports SwiftUI, DesignSystem,
// UIComponents, or any feature module.
//
// Nothing here records who was searched for or who was asked: usernames,
// profile ids, and request ids stay out of diagnostics entirely, and the
// `unavailable` candidate status stays cause-less by design — a client can
// never infer why someone is out of reach.
//
// Known test gap: what remains uncovered is the live socket itself — the
// mapping from one Supabase channel onto `FriendChannelSignal` (join,
// payload, and any status that is not `subscribed`) in `FriendsLive`, which
// needs a real server. FishKit has no seam for faking a realtime channel;
// neither `SupabaseChatRealtime` nor `SupabasePresenceRemote` has one, and
// building one for this module alone would cost more than it proves.
// Everything that decides what a consumer hears is pure and tested: the
// reconnect loop (`FriendEventStream`), the reason decoding, the topic and
// event names (`FriendsRealtimeWire`), and the event each payload produces.
