import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// Bottom-pinned bar shown in place of `CallOverlay` while an in-progress
/// call is minimized: the counterpart's name and status, a way back into the
/// call, and a way to end it — a direct port of Android's `CompactCallBar`.
/// Unlike the full-screen `CallOverlay`, minimizing intentionally leaves the
/// rest of the screen visible and reachable underneath, so the chat stays
/// usable during a call (the host, `FishRoot`, decides when to show this in
/// place of `CallOverlay` and owns the minimize/restore state).
public struct CompactCallBar: View {
    private let call: CallSessionState
    private let busy: Bool
    private let onReturn: () -> Void
    private let onEnd: () -> Void

    public init(
        call: CallSessionState,
        busy: Bool = false,
        onReturn: @escaping () -> Void,
        onEnd: @escaping () -> Void
    ) {
        self.call = call
        self.busy = busy
        self.onReturn = onReturn
        self.onEnd = onEnd
    }

    public var body: some View {
        HStack(spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 0) {
                Text(CallCopy.callPartner(call))
                    .textStyle(.label)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
                Text(CallCopy.stateCopy(for: call).status)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.body)
                    .lineLimit(1)
            }
            .accessibilityElement(children: .combine)

            Spacer(minLength: 0)

            ActionButton(CallCopy.returnToCall, variant: .secondary, action: onReturn)

            IconButton(
                .phoneOff,
                tone: .critical,
                accessibilityLabel: CallCopy.endCall,
                isBusy: busy,
                action: onEnd
            )
        }
        .padding(Spacing.sm)
        .background(
            Palette.surface,
            in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(Palette.divider, lineWidth: 1)
        )
        .padding(Spacing.page)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

#Preview("Compact call bar") {
    CompactCallBar(
        call: CallSessionState(
            callId: "call-1",
            counterpartId: "user-2",
            counterpartName: "Coach Mina",
            kind: .video,
            status: .active,
            direction: .outgoing,
            connectedAt: "2026-07-17T10:00:06.000Z"
        ),
        onReturn: {},
        onEnd: {}
    )
}
