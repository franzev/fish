import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// Voice + video call entry for a conversation header — the iOS mirror of the
/// web `CallButton` icon pair. Quiet controls; the call surface itself owns
/// the single primary action.
public struct CallEntryButtons: View {
    private let recipientName: String
    private let busy: Bool
    private let onStartCall: (CallKind) -> Void

    public init(
        recipientName: String,
        busy: Bool,
        onStartCall: @escaping (CallKind) -> Void
    ) {
        self.recipientName = recipientName
        self.busy = busy
        self.onStartCall = onStartCall
    }

    public var body: some View {
        HStack(spacing: Spacing.twoXs) {
            IconButton(
                .phone,
                accessibilityLabel: CallCopy.voiceCallEntry(recipientName: recipientName)
            ) {
                onStartCall(.audio)
            }
            IconButton(
                .video,
                accessibilityLabel: CallCopy.videoCallEntry(recipientName: recipientName)
            ) {
                onStartCall(.video)
            }
        }
        .disabled(busy)
    }
}
