import DesignSystem
import SwiftUI
import UIComponents

public struct ChatConnectionNotice: View {
    private let state: ChatConnectionState

    public init(state: ChatConnectionState) {
        self.state = state
    }

    nonisolated static func content(
        for state: ChatConnectionState
    ) -> (title: String, message: String?)? {
        switch state {
        case .connected:
            nil
        case .connecting:
            ("Connecting…", nil)
        case .reconnecting:
            ("Reconnecting", "Your draft is safe.")
        case .offline:
            (
                "You're offline",
                "You can keep writing. Sending will be ready when you reconnect."
            )
        }
    }

    public var body: some View {
        if let content = Self.content(for: state) {
            Notice(
                tone: .notice,
                title: content.title,
                message: content.message
            )
            .padding(.horizontal, Spacing.page)
        }
    }
}
