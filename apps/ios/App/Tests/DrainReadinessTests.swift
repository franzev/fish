import XCTest
@testable import Fish

final class DrainReadinessTests: XCTestCase {
    func testReturnsImmediatelyWhenReady() async {
        var slept = 0
        let ready = await DrainReadiness.waitUntilReady(
            isReady: { true },
            attempts: 60,
            sleep: { slept += 1 }
        )
        XCTAssertTrue(ready)
        XCTAssertEqual(slept, 0)
    }

    func testPollsUntilReady() async {
        var polls = 0
        let ready = await DrainReadiness.waitUntilReady(
            isReady: { polls += 1; return polls >= 3 },
            attempts: 60,
            sleep: {}
        )
        XCTAssertTrue(ready)
        XCTAssertEqual(polls, 3)
    }

    func testGivesUpAfterTheDeadline() async {
        var slept = 0
        let ready = await DrainReadiness.waitUntilReady(
            isReady: { false },
            attempts: 5,
            sleep: { slept += 1 }
        )
        XCTAssertFalse(ready)
        XCTAssertEqual(slept, 5)
    }
}
