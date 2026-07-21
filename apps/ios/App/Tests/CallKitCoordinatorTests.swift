import CallKit
import XCTest
@testable import Fish

final class CallKitCoordinatorTests: XCTestCase {
    func testMapsTerminalCallStatesToSystemEndReasons() {
        XCTAssertEqual(
            CallKitCoordinator.endReason(for: .rejected),
            CXCallEndedReason.remoteEnded
        )
        XCTAssertEqual(
            CallKitCoordinator.endReason(for: .missed),
            CXCallEndedReason.unanswered
        )
        XCTAssertEqual(
            CallKitCoordinator.endReason(for: .failed),
            CXCallEndedReason.failed
        )
        XCTAssertNil(CallKitCoordinator.endReason(for: .active))
    }
}
