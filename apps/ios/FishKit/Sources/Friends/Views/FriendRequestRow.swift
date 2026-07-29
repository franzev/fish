import DesignSystem
import FriendsData
import SwiftUI

/// One waiting request in the list. The whole row is the action — there is
/// only one thing to do with it, and that is to look at it.
struct FriendRequestRow: View {
    let request: IncomingFriendRequest
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: Spacing.sm) {
                FriendIdentity(
                    displayName: request.sender.displayName,
                    username: request.sender.username
                )
                Icon.chevronRight.image
                    .glyphFrame()
                    .foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: Metrics.targetTouch)
            .background(
                Palette.surface2,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            "\(request.sender.displayName), \(FriendIdentity.handle(request.sender.username))"
        )
    }
}
