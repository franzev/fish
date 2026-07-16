import Testing
@testable import DesignSystem

struct MotionTests {
    @Test func reducedMotionCollapsesEveryAnimation() {
        #expect(Motion.animation(MotionDuration.fade, reduceMotion: true) == nil)
        #expect(Motion.skeletonPulse(reduceMotion: true) == nil)
        #expect(Motion.typingLoop(reduceMotion: true, delay: 0) == nil)
    }

    @Test func standardMotionUsesTokenDurations() {
        #expect(Motion.animation(MotionDuration.message, reduceMotion: false) != nil)
        #expect(Motion.skeletonPulse(reduceMotion: false) != nil)
        #expect(Motion.typingLoop(
            reduceMotion: false,
            delay: MotionDuration.typingDelayShort
        ) != nil)
    }
}
