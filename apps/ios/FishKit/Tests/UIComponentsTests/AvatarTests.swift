import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct AvatarTests {
    @Test func initialsUseAtMostTwoWords() {
        #expect(Avatar.initials(from: "Maya Chen") == "MC")
        #expect(Avatar.initials(from: "Coach") == "C")
        #expect(Avatar.initials(from: "ana maría lópez") == "AM")
        #expect(Avatar.initials(from: "  ") == "")
        #expect(Avatar.initials(from: "") == "")
    }

    @MainActor @Test func snapshots() {
        let states = HStack(alignment: .center, spacing: Spacing.md) {
            Avatar(name: "Maya Chen", size: .sm)
            Avatar(name: "Maya Chen", size: .md)
            Avatar(name: "", size: .md)
            Avatar(name: "Sam Rivera", size: .profile)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "avatar-states")
        assertAccessibilitySnapshots(of: states, named: "avatar-states")
    }
}
