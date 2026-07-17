import Foundation
import PresenceData
import Testing
import TestSupport
import UIComponents
@testable import Presence

/// Presentation pins ported from the web `getPresencePresentation` tests and
/// Android's `PresenceFormatterTest`. The formatter is pinned to en_US/UTC
/// so last-seen copy is deterministic.
struct PresenceFormatterTests {
    private let formatter = PresenceFormatter(
        locale: Locale(identifier: "en_US"),
        calendar: Calendar(identifier: .gregorian),
        timeZone: TimeZone(identifier: "UTC")!
    )
    private let now = ISO8601DateFormatter().date(from: "2026-07-16T15:00:00Z")!

    private func iso(_ value: String) -> String { value }

    @Test func freshStatusesKeepTheirPresentation() {
        let cases: [(PresenceStatus, PresenceDisplayStatus, String)] = [
            (.online, .online, "Online"),
            (.idle, .idle, "Idle"),
            (.away, .away, "Away"),
            (.busy, .busy, "Do not disturb"),
        ]
        for (status, display, label) in cases {
            let presentation = formatter.format(
                PresenceFixtures.snapshot(
                    status: status,
                    lastHeartbeatAt: iso("2026-07-16T14:59:30Z")
                ),
                now: now
            )
            #expect(presentation.status == display)
            #expect(presentation.label == label)
            #expect(presentation.detail == nil)
        }
    }

    @Test func staleMissingAndMalformedHeartbeatsResolveOffline() {
        let stale = formatter.format(
            PresenceFixtures.snapshot(
                status: .online,
                lastHeartbeatAt: iso("2026-07-16T14:58:29Z")
            ),
            now: now
        )
        #expect(stale.status == .offline)

        let missing = formatter.format(
            PresenceFixtures.snapshot(status: .online, lastHeartbeatAt: nil),
            now: now
        )
        #expect(missing.status == .offline)

        let malformed = formatter.format(
            PresenceFixtures.snapshot(status: .busy, lastHeartbeatAt: "not a date"),
            now: now
        )
        #expect(malformed.status == .offline)

        let absent = formatter.format(nil, now: now)
        #expect(absent.status == .offline)
        #expect(absent.label == "Offline")
        #expect(absent.detail == nil)
    }

    @Test func coalescedAndFutureHeartbeatsStayFresh() {
        // The backend rewrites the snapshot heartbeat at most every 60s, so
        // an 89-second-old heartbeat is still a healthy peer.
        let coalesced = formatter.format(
            PresenceFixtures.snapshot(
                status: .online,
                lastHeartbeatAt: iso("2026-07-16T14:58:31Z")
            ),
            now: now
        )
        #expect(coalesced.status == .online)

        let skewed = formatter.format(
            PresenceFixtures.snapshot(
                status: .online,
                lastHeartbeatAt: iso("2026-07-16T15:00:40Z")
            ),
            now: now
        )
        #expect(skewed.status == .online)
    }

    @Test func sanitizedSnapshotsNeverInventLastSeenCopy() {
        let invisible = formatter.format(
            PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: nil
            ),
            now: now
        )
        #expect(invisible.status == .offline)
        #expect(invisible.detail == nil)
    }

    @Test func lastSeenCopyCoversEveryTier() {
        func detail(_ lastSeenAt: String) -> String? {
            formatter.format(
                PresenceFixtures.snapshot(
                    status: .offline,
                    lastHeartbeatAt: nil,
                    lastSeenAt: lastSeenAt
                ),
                now: now
            ).detail
        }

        #expect(detail("2026-07-16T14:59:59Z") == "Last seen 1 minute ago")
        #expect(detail("2026-07-16T14:35:00Z") == "Last seen 25 minutes ago")
        #expect(detail("2026-07-16T12:30:00Z") == "Last seen 2 hours ago")
        // Crossed local midnight less than 24 h ago -> yesterday, not hours.
        // The shortened time style separates the day period with a narrow
        // no-break space — modern Intl on the web does the same.
        #expect(detail("2026-07-15T23:30:00Z") == "Last seen yesterday at 11:30\u{202F}PM")
        #expect(detail("2026-07-15T09:00:00Z") == "Last seen yesterday at 9:00\u{202F}AM")
        #expect(detail("2026-07-05T12:00:00Z") == "Last seen on Jul 5, 2026")
        #expect(detail("2025-12-31T12:00:00Z") == "Last seen on Dec 31, 2025")
    }

    @Test func ownPreferenceOverridesUntilExpiry() {
        let snapshot = PresenceFixtures.snapshot(
            userId: PresenceFixtures.selfId,
            status: .online,
            lastHeartbeatAt: iso("2026-07-16T14:59:45Z")
        )

        let busy = formatter.formatOwn(
            snapshot: snapshot,
            preference: PresencePreferenceSetting(preference: .busy),
            now: now
        )
        #expect(busy.status == .busy)
        #expect(busy.label == "Do not disturb")

        let invisible = formatter.formatOwn(
            snapshot: snapshot,
            preference: PresencePreferenceSetting(preference: .invisible),
            now: now
        )
        #expect(invisible.status == .invisible)
        #expect(invisible.label == "Invisible")

        let expired = formatter.formatOwn(
            snapshot: snapshot,
            preference: PresencePreferenceSetting(
                preference: .away,
                expiresAt: iso("2026-07-16T14:59:59Z")
            ),
            now: now
        )
        #expect(expired.status == .online)

        let automatic = formatter.formatOwn(
            snapshot: snapshot,
            preference: PresencePreferenceSetting(),
            now: now
        )
        #expect(automatic.status == .online)
    }
}
