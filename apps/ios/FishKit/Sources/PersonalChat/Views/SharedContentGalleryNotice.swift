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
            Notice(title: "Checking for updates…", tone: .notice)
        case .offlineCached:
            Notice(
                title: "You're offline",
                message: "This content is saved on this device and may be out of date.",
                tone: .notice
            )
        case .stale:
            Notice(
                title: "Content may be out of date",
                message: "We couldn't check for updates.",
                tone: .notice,
                actionLabel: presentation.manualRetry == .enabled ? "Try again" : nil,
                onAction: presentation.manualRetry == .enabled ? onRetry : nil
            )
        }
    }
}
