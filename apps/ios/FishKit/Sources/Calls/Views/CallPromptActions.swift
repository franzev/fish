import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// The ringing decisions. Incoming: a two-column answer/decline pair where
/// Answer is the single emphasized action (success fill); outgoing: one quiet
/// cancel. All prompt controls use the focused 56-point height, stay
/// single-flight, and preserve geometry while loading — web parity.
struct CallPromptActions: View {
    enum PendingAction {
        case answer
        case decline
        case cancel
    }

    let call: CallSessionState
    let busy: Bool
    let onAnswer: () -> Void
    let onDecline: () -> Void
    let onCancel: () -> Void

    @State private var pending: PendingAction?

    private var incoming: Bool {
        call.status == .ringing && call.direction == .incoming
    }

    var body: some View {
        Group {
            if incoming {
                HStack(spacing: Spacing.sm) {
                    ActionButton(
                        CallCopy.decline,
                        variant: .secondary,
                        tone: .critical,
                        prominence: .focused,
                        icon: .phoneOff,
                        isLoading: busy && pending == .decline,
                        fullWidth: true
                    ) {
                        run(.decline, onDecline)
                    }
                    ActionButton(
                        CallCopy.answer,
                        tone: .success,
                        prominence: .focused,
                        icon: call.kind == .video ? .video : .phone,
                        isLoading: busy && pending == .answer,
                        fullWidth: true
                    ) {
                        run(.answer, onAnswer)
                    }
                }
            } else {
                HStack {
                    ActionButton(
                        CallCopy.cancel,
                        variant: .secondary,
                        tone: .critical,
                        prominence: .focused,
                        icon: .phoneOff,
                        isLoading: busy && pending == .cancel
                    ) {
                        run(.cancel, onCancel)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .disabled(busy)
        .onChange(of: busy) { _, isBusy in
            if !isBusy { pending = nil }
        }
    }

    private func run(_ action: PendingAction, _ perform: () -> Void) {
        guard !busy, pending == nil else { return }
        pending = action
        perform()
    }
}
