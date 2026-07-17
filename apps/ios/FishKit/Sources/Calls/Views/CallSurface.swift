import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// The complete, stateless call surface: nothing while idle, the floating
/// card for audio calls / ringing prompts / terminal states, and the
/// full-screen stage while a video call is in progress — the same
/// presentation split as the web `CallPopover` + `/calls/[id]` screen.
public struct CallSurface: View {
    private let state: CallPanelState
    private let actions: CallPanelActions
    private let localVideo: AnyView?
    private let remoteVideo: AnyView?
    private let chatContent: AnyView?
    private let chatOpen: Bool

    public init(
        state: CallPanelState,
        actions: CallPanelActions = CallPanelActions(),
        localVideo: AnyView? = nil,
        remoteVideo: AnyView? = nil,
        chatContent: AnyView? = nil,
        chatOpen: Bool = false
    ) {
        self.state = state
        self.actions = actions
        self.localVideo = localVideo
        self.remoteVideo = remoteVideo
        self.chatContent = chatContent
        self.chatOpen = chatOpen
    }

    public var body: some View {
        if state.call.status == .idle {
            EmptyView()
        } else if state.isVideoStageActive {
            fullScreenStage
        } else {
            floatingCard
        }
    }

    private var floatingCard: some View {
        CallPanel(
            state: state,
            actions: actions,
            chatAvailable: false,
            chatOpen: false,
            headerHidden: false
        )
        .frame(maxWidth: Metrics.callPanel, alignment: .leading)
        .background(
            Palette.surface,
            in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(Palette.divider, lineWidth: 1)
        )
        .padding(Spacing.page)
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: .bottomLeading
        )
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var fullScreenStage: some View {
        let copy = CallCopy.stateCopy(for: state.call)
        return VStack(spacing: 0) {
            if chatOpen, let chatContent {
                CallChatPane(call: state.call, content: chatContent)
            } else {
                CallVideoStage(
                    state: state,
                    remoteVideo: remoteVideo,
                    localVideo: localVideo
                )
                .accessibilityLabel("\(copy.heading). \(copy.status)")
            }

            CallPanel(
                state: state,
                actions: actions,
                chatAvailable: chatContent != nil,
                chatOpen: chatOpen,
                headerHidden: true
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.bg)
    }
}
