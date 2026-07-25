import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// Video-call settings: the one disclosed choice ("Use less data") plus the
/// platform note that audio routing follows the device. The web microphone
/// picker has no iOS equivalent — the system owns the active route.
struct CallSettingsSheet: View {
    let preference: VideoQualityPreference
    let onSetPreference: (VideoQualityPreference) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(CallCopy.callSettings)
                .textStyle(.heading)
                .foregroundStyle(Palette.foreground)

            Toggle(isOn: Binding(
                get: { preference == .dataSaver },
                set: { onSetPreference($0 ? .dataSaver : .auto) }
            )) {
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(CallCopy.dataSaverTitle)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                    Text(CallCopy.dataSaverDescription)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                }
            }
            .tint(Palette.primary)
            .frame(minHeight: Metrics.targetTouch)

            Text(CallCopy.audioRouteNote)
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)

            Spacer(minLength: 0)
        }
        .padding(Spacing.page)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.surface)
        .presentationDetents([.height(Metrics.callSettings)])
        .presentationDragIndicator(.visible)
    }
}
