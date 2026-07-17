import DesignSystem
import SwiftUI

/// Status glyph, label, and optional last-seen detail — one merged
/// accessibility element.
public struct PresenceSummary: View {
    private let status: PresenceDisplayStatus
    private let label: String
    private let detail: String?

    public init(status: PresenceDisplayStatus, label: String, detail: String? = nil) {
        self.status = status
        self.label = label
        self.detail = detail
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.nudge) {
            PresenceIndicator(status: status, label: label)
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] }
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(label)
                    .textStyle(.ui)
                    .foregroundStyle(Palette.body)
                if let detail {
                    Text(detail)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            detail.map { "\(label), \($0)" } ?? label
        )
    }
}
