import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// The call card content — every lifecycle state in one calm column, the
/// stateless Swift port of the web `CallPopoverView` body. Hosts render it
/// inside the floating overlay card or as the bottom section of the
/// full-screen video stage.
struct CallPanel: View {
    let state: CallPanelState
    let actions: CallPanelActions
    let chatAvailable: Bool
    let chatOpen: Bool
    /// Hides the header visually on the video stage (it stays available to
    /// assistive tech on the stage container) — web `sr-only` parity.
    let headerHidden: Bool

    private var call: CallSessionState { state.call }

    private var isPrompt: Bool { call.status == .ringing }

    private var showsActivityPanel: Bool {
        call.kind == .audio
            && [.active, .reconnecting].contains(call.status)
    }

    var body: some View {
        VStack(
            alignment: .leading,
            spacing: isPrompt ? Spacing.lg : Spacing.md
        ) {
            if !headerHidden {
                CallStatusHeader(call: call)
            }

            if showsActivityPanel {
                CallActivityPanel(state: state)
            }

            if let notice = state.notice {
                Notice(tone: .notice, title: notice)
            }

            if isPrompt {
                CallPromptActions(
                    call: call,
                    busy: state.busy,
                    onAnswer: actions.answer,
                    onDecline: actions.decline,
                    onCancel: actions.cancel
                )
            }

            if state.isInProgress {
                CallControls(
                    state: state,
                    actions: actions,
                    chatAvailable: chatAvailable,
                    chatOpen: chatOpen
                )
            }
        }
        .padding(isPrompt ? Spacing.page : Spacing.md)
    }
}
