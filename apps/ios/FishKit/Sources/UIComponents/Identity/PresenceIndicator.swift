import DesignSystem
import SwiftUI

/// The shared display vocabulary for presence. Subjects never show
/// `invisible` — the server sanitizes them to offline; only the owner's own
/// status can display it.
public enum PresenceDisplayStatus: Sendable, Equatable, CaseIterable {
    case online
    case idle
    case away
    case busy
    case invisible
    case offline
}

/// Status glyph — always shape plus color, never color alone, mirroring the
/// web indicator icon-for-icon. Decorative by default because adjacent text
/// usually carries the status label.
public struct PresenceIndicator: View {
    private let status: PresenceDisplayStatus
    private let label: String
    private let isDecorative: Bool

    public init(
        status: PresenceDisplayStatus,
        label: String,
        isDecorative: Bool = true
    ) {
        self.status = status
        self.label = label
        self.isDecorative = isDecorative
    }

    public var body: some View {
        status.icon.image
            .frame(
                width: Metrics.presenceIndicatorSmall,
                height: Metrics.presenceIndicatorSmall
            )
            .foregroundStyle(status.color)
            .accessibilityHidden(isDecorative)
            .accessibilityLabel(isDecorative ? "" : label)
    }
}

extension PresenceDisplayStatus {
    var icon: Icon {
        switch self {
        case .online: .circleFilled
        case .idle: .moonFilled
        case .away: .clock
        case .busy: .circleMinus
        case .invisible: .eyeOff
        case .offline: .circle
        }
    }

    var color: Color {
        switch self {
        case .online: Palette.presenceOnline
        case .idle: Palette.presenceIdle
        case .away: Palette.presenceAway
        case .busy: Palette.presenceBusy
        case .invisible: Palette.presenceOffline
        case .offline: Palette.presenceOffline
        }
    }
}
