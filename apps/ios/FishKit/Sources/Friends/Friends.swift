// Friends is the feature layer over FriendsData: the two states a person can
// be in while adding someone (a username to look up, or the one person who
// came back), the incoming-request list and its one-request review, and the
// observable models that drive them. Views stay stateless; the models own
// every decision and hand outcomes back through closures so presentation
// belongs to the app. This module never imports Supabase — the data boundary
// stays in FriendsData.
//
// Nothing here logs. A username, a profile id, and a request id are the
// person's business, and the `unavailable` candidate stays cause-less on
// screen exactly as it arrives: blocked, declined, a coach, and never-existed
// all read the same sentence.
