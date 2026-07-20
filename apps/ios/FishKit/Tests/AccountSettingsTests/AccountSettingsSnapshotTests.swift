import AccountSettings
import DesignSystem
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

@MainActor
struct AccountSettingsSnapshotTests {
    @Test
    func accountSettingsRoot() {
        let view = AccountSettingsView(
            displayName: "Alex Rivera",
            presence: AccountSettingsPresence(visibility: .automatic),
            notificationStatus: .authorized,
            appearance: .system,
            motion: .system,
            canManageBlockedPeople: true,
            onSignOut: {}
        )
        assertThemedSnapshots(of: view, named: "account-settings-root")
        assertAccessibilitySnapshots(of: view, named: "account-settings-root")
    }
}

@MainActor
private func pinned(_ view: some View) -> AnyView {
    Fonts.register()
    return AnyView(
        view
            .environment(\.locale, Locale(identifier: "en_US"))
            .environment(\.timeZone, TimeZone(identifier: "UTC")!)
            .background(Palette.bg)
    )
}

@MainActor
private func assertThemedSnapshots(
    of view: some View,
    named name: String,
    file: StaticString = #filePath,
    testName: String = #function,
    line: UInt = #line
) {
    let host = UIHostingController(rootView: pinned(view))
    assertSnapshot(
        of: host,
        as: .image(on: .iPhone13),
        named: "\(name)-light",
        file: file,
        testName: testName,
        line: line
    )
    assertSnapshot(
        of: host,
        as: .image(on: .iPhone13, traits: .init(userInterfaceStyle: .dark)),
        named: "\(name)-dark",
        file: file,
        testName: testName,
        line: line
    )
}

@MainActor
private func assertAccessibilitySnapshots(
    of view: some View,
    named name: String,
    file: StaticString = #filePath,
    testName: String = #function,
    line: UInt = #line
) {
    let largeType = UIHostingController(rootView: pinned(view))
    assertSnapshot(
        of: largeType,
        as: .image(
            on: .iPhone13,
            traits: .init(preferredContentSizeCategory: .accessibilityExtraLarge)
        ),
        named: "\(name)-xl",
        file: file,
        testName: testName,
        line: line
    )
    let rightToLeft = UIHostingController(
        rootView: pinned(view.environment(\.layoutDirection, .rightToLeft))
    )
    assertSnapshot(
        of: rightToLeft,
        as: .image(on: .iPhone13),
        named: "\(name)-rtl",
        file: file,
        testName: testName,
        line: line
    )
}
