import CallData
import Calls
import DesignSystem
import SwiftUI
import TestSupport
import UIComponents

/// Every call-surface state, rendered from fixtures for review and
/// accessibility audits — the iOS counterpart of the web call stories.
struct CallStatesPage: View {
    private struct StateCase: Identifiable {
        let id: String
        let state: CallPanelState
        let chatOpen: Bool

        init(_ id: String, _ state: CallPanelState, chatOpen: Bool = false) {
            self.id = id
            self.state = state
            self.chatOpen = chatOpen
        }
    }

    private static func session(
        _ status: CallLifecycleStatus,
        direction: CallDirection = .incoming,
        kind: CallKind = .audio,
        muted: Bool = false,
        cameraEnabled: Bool = false
    ) -> CallSessionState {
        CallSessionState(
            callId: "call-1",
            counterpartId: "user-2",
            counterpartName: "Coach Mina",
            kind: kind,
            status: status,
            direction: direction,
            muted: muted,
            cameraEnabled: cameraEnabled,
            expiresAt: "2026-07-17T10:00:45.000Z",
            connectedAt: "2026-07-17T10:00:06.000Z"
        )
    }

    private let cases: [StateCase] = [
        StateCase("Incoming audio ring", CallPanelState(call: session(.ringing))),
        StateCase("Incoming video ring", CallPanelState(call: session(.ringing, kind: .video))),
        StateCase("Outgoing ring", CallPanelState(call: session(.ringing, direction: .outgoing))),
        StateCase("Requesting permission", CallPanelState(call: CallSessionState(
            counterpartId: "user-2",
            counterpartName: "Coach Mina",
            kind: .video,
            status: .requestingPermission,
            direction: .outgoing
        ))),
        StateCase("Connecting", CallPanelState(call: session(.connecting), busy: true)),
        StateCase("Active audio", CallPanelState(
            call: session(.active),
            speaking: CallMediaSpeaking(
                localMicrophoneActive: true,
                localMicrophoneLevel: 0.55,
                remoteSpeaking: true,
                remoteMicrophoneLevel: 0.72
            )
        )),
        StateCase("Active audio, both muted", CallPanelState(
            call: session(.active, muted: true),
            remoteMuted: true
        )),
        StateCase("Reconnecting", CallPanelState(call: session(.reconnecting))),
        StateCase("Video call, camera off", CallPanelState(
            call: session(.active, kind: .video),
            speakerEnabled: true
        )),
        StateCase("Video call, remote muted", CallPanelState(
            call: session(.active, kind: .video, cameraEnabled: true),
            remoteMuted: true,
            speakerEnabled: true
        )),
        StateCase("Video call, chat open", CallPanelState(
            call: session(.active, kind: .video, cameraEnabled: true),
            speakerEnabled: true
        ), chatOpen: true),
        StateCase("Missed", CallPanelState(call: session(.missed))),
        StateCase("Declined", CallPanelState(call: session(.rejected))),
        StateCase("Failed with notice", CallPanelState(
            call: session(.failed),
            notice: "The call didn’t connect. Messages still work."
        )),
    ]

    var body: some View {
        List(cases) { item in
            NavigationLink(item.id) {
                CallSurface(
                    state: item.state,
                    chatContent: item.chatOpen ? AnyView(chatPlaceholder) : nil,
                    chatOpen: item.chatOpen
                )
                .background(Palette.bg)
                .navigationTitle(item.id)
                .navigationBarTitleDisplayMode(.inline)
            }
        }
        .navigationTitle("Call states")
    }

    private var chatPlaceholder: some View {
        VStack {
            Spacer()
            Text("The conversation renders here.")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

/// Interactive scripted call flow: fixture providers play the counterpart
/// and the webhook, so the full ring → answer → talk → end loop runs offline
/// exactly as the production orchestration would.
struct CallDemoPage: View {
    @State private var environment = CallDemoEnvironment()

    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    Text("Start a call, or let Coach Mina call you. Scripted providers stand in for the backend and the other device.")
                        .textStyle(.body)
                        .foregroundStyle(Palette.body)

                    HStack(spacing: Spacing.md) {
                        Text("Call Coach Mina")
                            .textStyle(.label)
                            .foregroundStyle(Palette.foreground)
                        Spacer()
                        CallEntryButtons(
                            recipientName: "Coach Mina",
                            busy: environment.model.busy,
                            onStartCall: { kind in environment.startOutgoing(kind) }
                        )
                    }
                    .padding(Spacing.md)
                    .background(
                        Palette.surface,
                        in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    )

                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Scripted counterpart")
                            .textStyle(.label)
                            .foregroundStyle(Palette.foreground)
                        ActionButton("Receive an audio call", variant: .secondary) {
                            environment.receiveIncoming(.audio)
                        }
                        ActionButton("Receive a video call", variant: .secondary) {
                            environment.receiveIncoming(.video)
                        }
                        ActionButton("Coach Mina speaks", variant: .ghost) {
                            environment.remoteSpeaks()
                        }
                        ActionButton("Coach Mina mutes", variant: .ghost) {
                            environment.remoteTogglesMute()
                        }
                        ActionButton("Coach Mina ends the call", variant: .ghost) {
                            environment.remoteEnds()
                        }
                    }
                    .padding(Spacing.md)
                    .background(
                        Palette.surface,
                        in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    )
                }
                .padding(Spacing.page)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Palette.bg)

            CallOverlay(
                model: environment.model,
                chatContent: {
                    AnyView(
                        VStack {
                            Spacer()
                            Text("The conversation renders here.")
                                .textStyle(.body)
                                .foregroundStyle(Palette.body)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                    )
                }
            )
        }
        .navigationTitle("Call demo")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { environment.model.shutdown() }
    }
}

/// Wires the session model to scripted providers and plays the counterpart:
/// accepting flips the durable row the way the webhook would, incoming rings
/// arrive over the fixture broadcast, and media events animate speaking.
@MainActor @Observable
final class CallDemoEnvironment {
    let model: CallSessionModel
    private let realtime: FixtureCallRealtime
    private let media: FixtureCallMedia
    private var remoteMuted = false

    /// The demo signs in as the seeded client; Coach Mina is the counterpart.
    private nonisolated static let userId = CallFixtures.clientId

    init() {
        let realtime = FixtureCallRealtime()
        let media = FixtureCallMedia()

        // The scripted "backend": every accepted or joined call becomes an
        // active durable row moments later — the livekit-webhook's job in
        // production.
        let commands = ScriptedCallCommands(
            onInitiate: { _, kind, _ in
                let ringing = CallFixtures.call(
                    kind: kind,
                    status: .ringing,
                    initiatedBy: Self.userId
                )
                realtime.setCall(
                    CallFixtures.snapshot(ringing),
                    broadcast: false
                )
                Task {
                    try? await Task.sleep(for: .seconds(1.6))
                    realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
                        kind: kind,
                        status: .connecting,
                        initiatedBy: Self.userId
                    )))
                }
                return CallCommandReply(call: ringing)
            },
            onAccept: { callId in
                let connecting = CallFixtures.call(
                    id: callId,
                    kind: realtime.lastKind,
                    status: .connecting,
                    initiatedBy: CallFixtures.coachId
                )
                Task {
                    try? await Task.sleep(for: .seconds(0.8))
                    realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
                        id: callId,
                        kind: realtime.lastKind,
                        status: .active,
                        initiatedBy: CallFixtures.coachId,
                        connectedAt: "2026-07-17T10:00:06.000Z"
                    )))
                }
                return CallCommandReply(
                    call: connecting,
                    connection: CallFixtures.connection
                )
            },
            onReject: { callId in
                let rejected = CallFixtures.call(
                    id: callId,
                    kind: realtime.lastKind,
                    status: .rejected,
                    initiatedBy: CallFixtures.coachId
                )
                realtime.setCall(CallFixtures.snapshot(rejected), broadcast: false)
                return CallCommandReply(call: rejected)
            },
            onCancel: { callId in
                let cancelled = CallFixtures.call(
                    id: callId,
                    kind: realtime.lastKind,
                    status: .cancelled,
                    initiatedBy: Self.userId
                )
                realtime.setCall(CallFixtures.snapshot(cancelled), broadcast: false)
                return CallCommandReply(call: cancelled)
            },
            onEnd: { callId in
                let ended = CallFixtures.call(
                    id: callId,
                    kind: realtime.lastKind,
                    status: .ended,
                    initiatedBy: Self.userId
                )
                realtime.setCall(CallFixtures.snapshot(ended), broadcast: false)
                return CallCommandReply(call: ended)
            },
            onJoin: { callId in
                Task {
                    try? await Task.sleep(for: .seconds(0.8))
                    realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
                        id: callId,
                        kind: realtime.lastKind,
                        status: .active,
                        initiatedBy: Self.userId,
                        connectedAt: "2026-07-17T10:00:06.000Z"
                    )))
                }
                return CallCommandReply(
                    call: CallFixtures.call(
                        id: callId,
                        kind: realtime.lastKind,
                        status: .connecting,
                        initiatedBy: Self.userId
                    ),
                    connection: CallFixtures.connection
                )
            }
        )

        self.realtime = realtime
        self.media = media
        self.model = CallSessionModel(
            userId: Self.userId,
            commands: commands,
            realtime: realtime,
            media: media,
            permissions: AlwaysGrantedPermissions()
        )
    }

    func startOutgoing(_ kind: CallKind) {
        realtime.lastKind = kind
        Task {
            await model.startCall(
                recipientId: CallFixtures.coachId,
                recipientName: CallFixtures.coachName,
                kind: kind
            )
        }
    }

    func receiveIncoming(_ kind: CallKind) {
        realtime.lastKind = kind
        realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            kind: kind,
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
    }

    func remoteSpeaks() {
        media.send(.speakingChanged(
            callId: CallFixtures.callId,
            CallMediaSpeaking(
                localMicrophoneActive: false,
                localMicrophoneLevel: 0,
                remoteSpeaking: true,
                remoteMicrophoneLevel: 0.7
            )
        ))
    }

    func remoteTogglesMute() {
        remoteMuted.toggle()
        media.send(.remoteMuteChanged(
            callId: CallFixtures.callId,
            muted: remoteMuted
        ))
    }

    func remoteEnds() {
        realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            kind: realtime.lastKind,
            status: .ended,
            initiatedBy: CallFixtures.coachId
        )))
    }
}

/// The demo never touches real devices.
private struct AlwaysGrantedPermissions: MediaPermissionRequesting {
    func requestAccess(for _: CallKind) async -> MediaPermissionOutcome {
        .granted
    }
}
