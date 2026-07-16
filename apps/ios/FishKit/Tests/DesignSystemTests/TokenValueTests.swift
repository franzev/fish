import Testing
@testable import DesignSystem

struct TokenValueTests {
    @Test func generatedValuesMatchTheManifest() {
        #expect(Spacing.md == 16)
        #expect(Spacing.threeXs == 2)
        #expect(Spacing.twoXl == 48)
        #expect(Radius.control == 12)
        #expect(Radius.chatInner == 4)
        #expect(Metrics.targetTouch == 44)
        #expect(Metrics.controlPrimary == 56)
        #expect(Metrics.paginationSlot == 144)
        #expect(MotionDuration.message == 0.2)
        #expect(MotionDuration.skeleton == 1.4)
        #expect(Opacity.focus == 0.72)
        #expect(ChatRules.maxMessageLength == 4000)
        #expect(ChatRules.counterThreshold == 3900)
    }
}
