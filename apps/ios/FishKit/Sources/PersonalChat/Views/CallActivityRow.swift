import DesignSystem
import SwiftUI
import UIComponents

public struct CallActivityRow: View {
    private let activity: CallActivityUiModel
    private let onCallBack: (String) -> Void

    public init(
        activity: CallActivityUiModel,
        onCallBack: @escaping (String) -> Void = { _ in }
    ) {
        self.activity = activity
        self.onCallBack = onCallBack
    }

    public var body: some View {
        VStack(spacing: Spacing.threeXs) {
            HStack(spacing: Spacing.xs) {
                (activity.kind == "video" ? Icon.video : Icon.phone).image
                    .glyphFrame()
                    .foregroundStyle(Palette.muted)
                Text(activity.label)
                    .textStyle(.ui)
                    .foregroundStyle(Palette.muted)
                Text(activity.timeLabel)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
            }
            if activity.canCallBack {
                ActionButton("Call back", variant: .secondary, icon: Icon.phone) {
                    onCallBack(activity.kind)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(activity.label)
    }
}
