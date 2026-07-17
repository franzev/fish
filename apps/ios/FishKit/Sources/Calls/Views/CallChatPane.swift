import CallData
import DesignSystem
import SwiftUI

/// Messages beside the call: header plus the host-injected conversation
/// surface. On iPhone the pane replaces the video stage while open — the
/// web's small-viewport behavior.
struct CallChatPane: View {
    let call: CallSessionState
    let content: AnyView

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(CallCopy.messagesHeading)
                    .textStyle(.label)
                    .foregroundStyle(Palette.foreground)
                Text(call.counterpartName ?? "Your call partner")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.md)
            .frame(height: Metrics.chatHeader)

            Rectangle()
                .fill(Palette.divider)
                .frame(height: 1)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Palette.surface)
    }
}
