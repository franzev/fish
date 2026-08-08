import DesignSystem
import SwiftUI
import UIComponents

/// Confirm-first Block/Report entry for `ConversationDetailsSheet`'s
/// `safetyContent` slot. Mirrors the web and Android copy for this feature.
public struct ConversationSafetyView: View {
    private let model: ConversationSafetyModel

    public init(model: ConversationSafetyModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            switch model.state {
            case .idle(let notice):
                if let notice {
                    Notice(title: notice, tone: .notice)
                }
                actionEntry
            case .confirming(let action, let isWorking, let notice):
                if let notice {
                    Notice(title: notice, tone: .notice)
                }
                confirmation(for: action, isWorking: isWorking)
            }
        }
    }

    @ViewBuilder private var actionEntry: some View {
        ActionButton("Block \(model.targetDisplayName)", variant: .ghost, fullWidth: true) {
            model.startConfirming(.block)
        }
        ActionButton("Report \(model.targetDisplayName)", variant: .ghost, fullWidth: true) {
            model.startConfirming(.report)
        }
    }

    @ViewBuilder private func confirmation(
        for action: ConversationSafetyAction,
        isWorking: Bool
    ) -> some View {
        Text(confirmMessage(for: action))
            .textStyle(.body)
            .foregroundStyle(Palette.body)
            .fixedSize(horizontal: false, vertical: true)
        ActionButton(
            confirmLabel(for: action),
            variant: .secondary,
            isLoading: isWorking,
            fullWidth: true
        ) {
            model.confirm()
        }
        ActionButton("Go back", variant: .ghost, fullWidth: true) {
            model.cancelConfirming()
        }
        .disabled(isWorking)
    }

    private func confirmMessage(for action: ConversationSafetyAction) -> String {
        switch action {
        case .block:
            "Block \(model.targetDisplayName)? They won’t be able to find you or send requests, and they won’t be told."
        case .report:
            "Report \(model.targetDisplayName) to the team? They won’t be told."
        }
    }

    private func confirmLabel(for action: ConversationSafetyAction) -> String {
        switch action {
        case .block: "Block"
        case .report: "Report"
        }
    }
}
