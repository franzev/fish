import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentGalleryNotice: View {
    let presentation: SharedContentPresentationContract
    let onRetry: () -> Void

    @ViewBuilder var body: some View {
        switch presentation.notice {
        case .none:
            EmptyView()
        case .checkingForUpdates:
            Notice(tone: .notice, title: "Checking for updates…")
        case .offlineCached:
            Notice(
                tone: .notice,
                title: "You're offline",
                message: "This content is saved on this device and may be out of date."
            )
        case .stale:
            Notice(
                tone: .notice,
                title: "Content may be out of date",
                message: "We couldn't check for updates.",
                actionLabel: presentation.manualRetry == .enabled ? "Try again" : nil,
                onAction: presentation.manualRetry == .enabled ? onRetry : nil
            )
        }
    }
}
