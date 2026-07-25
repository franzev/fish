import ChatData
import Foundation
import PersonalChat
import Testing

/// The wording the quiet row shows. Store behaviour is covered beside the
/// command doubles in ConversationStoreTests; the control's appearance is
/// covered in ChatComponentSnapshotTests.
struct ConversationQuietCopyTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private let now = Date(timeIntervalSince1970: 1_753_437_600) // 2026-07-25 10:00 UTC

    private func value(_ mute: ConversationMute) -> String {
        ConversationQuietCopy.value(
            for: mute,
            now: now,
            calendar: calendar,
            locale: Locale(identifier: "en_US")
        )
    }

    @Test func readsAsOnWhenNothingIsSilenced() {
        #expect(value(.on) == "On")
    }

    @Test func namesTheOpenEndedCaseWithoutATime() {
        let mute = ConversationMute(isMuted: true, mutedUntil: nil)
        #expect(value(mute) == "Quiet until you turn it back on")
    }

    @Test func showsOnlyTheTimeWhileTheQuietPeriodEndsToday() {
        let mute = ConversationMute(isMuted: true, mutedUntil: now.addingTimeInterval(3600))
        let label = value(mute)
        #expect(label.hasPrefix("Quiet until "))
        #expect(!label.contains("2026"))
        #expect(!label.contains("Jul"))
    }

    // A bare clock time stops being clear once the quiet period runs past
    // midnight, which the 24-hour option always does.
    @Test func addsTheDayWhenTheQuietPeriodRunsPastToday() {
        let mute = ConversationMute(isMuted: true, mutedUntil: now.addingTimeInterval(86400))
        #expect(value(mute).contains("Jul 26"))
    }

    // The server stops suppressing pushes the moment the period lapses, so the
    // row must stop claiming to be quiet without waiting for a reload.
    @Test func stopsReadingAsQuietOnceThePeriodLapses() {
        let lapsed = ConversationMute(isMuted: true, mutedUntil: now.addingTimeInterval(-1))
        #expect(!lapsed.isQuiet(at: now))
        #expect(value(lapsed) == "On")
    }

    @Test func treatsTheExactExpiryInstantAsLapsed() {
        let boundary = ConversationMute(isMuted: true, mutedUntil: now)
        #expect(!boundary.isQuiet(at: now))
    }

    @Test func theOpenEndedQuietPeriodNeverLapses() {
        let openEnded = ConversationMute(isMuted: true, mutedUntil: nil)
        #expect(openEnded.isQuiet(at: now.addingTimeInterval(86_400 * 365)))
    }

    @Test func everyQuietPeriodCarriesTheDurationTheServerAllows() {
        #expect(ConversationQuietPeriod.oneHour.durationSeconds == 3600)
        #expect(ConversationQuietPeriod.eightHours.durationSeconds == 28800)
        #expect(ConversationQuietPeriod.oneDay.durationSeconds == 86400)
        #expect(ConversationQuietPeriod.untilTurnedBackOn.durationSeconds == nil)
    }

    @Test func everyQuietPeriodIsLabelled() {
        for period in ConversationQuietPeriod.allCases {
            #expect(!period.label.isEmpty)
        }
    }
}
