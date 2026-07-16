import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct InputFieldTests {
    @Test func supportSlotAlwaysReservesGeometry() {
        #expect(InputField.supportText(for: .none) == nil)
        #expect(InputField.supportText(for: .hint("Use your work email")) == "Use your work email")
        #expect(InputField.supportText(
            for: .error("That email doesn't look complete")
        ) == "That email doesn't look complete")
    }

    @MainActor @Test func snapshots() {
        let states = ScrollView {
            VStack(spacing: Spacing.lg) {
                InputField(label: "Full name", text: .constant(""))
                InputField(
                    label: "Email",
                    text: .constant("maya@example.com"),
                    support: .hint("We only use this to sign you in")
                )
                InputField(
                    label: "Email",
                    text: .constant("maya@"),
                    support: .error(
                        "That email doesn't look complete. Check the part after the @."
                    )
                )
                InputField(label: "Coach", text: .constant("Sam Rivera"))
                    .disabled(true)
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "text-field-states")
        assertAccessibilitySnapshots(of: states, named: "text-field-states")
    }
}
