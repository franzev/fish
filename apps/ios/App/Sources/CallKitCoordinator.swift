import AVFoundation
import CallKit
import CallData
import CallMediaLiveKit
import Calls
import Foundation

/// App-owned bridge between the portable call model and iOS system call UI.
/// CallKit owns presentation and audio activation; the existing model remains
/// the only source of backend state and command execution.
@MainActor
final class CallKitCoordinator: NSObject, @MainActor CXProviderDelegate {
    private struct PendingOutgoing {
        let uuid: UUID
        let recipientId: String
        let recipientName: String
        let kind: CallKind
        weak var model: CallSessionModel?
    }

    private let provider: CXProvider
    private let controller: CXCallController
    private weak var model: CallSessionModel?
    private weak var media: LiveKitCallMedia?
    private var pendingOutgoing: PendingOutgoing?
    private var uuidByCallId: [String: UUID] = [:]
    private var callIdByUUID: [UUID: String] = [:]

    init(
        provider: CXProvider? = nil,
        controller: CXCallController = CXCallController()
    ) {
        let configuration = CXProviderConfiguration()
        configuration.supportsVideo = true
        configuration.maximumCallsPerCallGroup = 1
        configuration.maximumCallGroups = 1
        configuration.includesCallsInRecents = false
        self.provider = provider ?? CXProvider(configuration: configuration)
        self.controller = controller
        super.init()
        self.provider.setDelegate(self, queue: nil)
    }

    func bind(model: CallSessionModel, media: LiveKitCallMedia) {
        self.model = model
        self.media = media
    }

    func startOutgoing(
        model: CallSessionModel,
        media: LiveKitCallMedia,
        recipientId: String,
        recipientName: String,
        kind: CallKind
    ) {
        guard pendingOutgoing == nil, !model.busy, !model.state.hasLiveCall else { return }
        bind(model: model, media: media)
        media.prepareForCallKit()
        let uuid = UUID()
        pendingOutgoing = PendingOutgoing(
            uuid: uuid,
            recipientId: recipientId,
            recipientName: recipientName,
            kind: kind,
            model: model
        )
        let handle = CXHandle(type: .generic, value: recipientId)
        let action = CXStartCallAction(call: uuid, handle: handle)
        action.isVideo = kind == .video
        controller.request(CXTransaction(action: action)) { [weak self] error in
            guard error != nil else { return }
            Task { @MainActor [weak self] in
                self?.pendingOutgoing = nil
                self?.media?.callKitDidDeactivateAudioSession(.sharedInstance())
            }
        }
    }

    func sync(state: CallSessionState) {
        guard model != nil else { return }
        guard let callId = state.callId else { return }

        if state.status == .ringing, state.direction == .incoming {
            reportIncomingIfNeeded(state, callId: callId)
        } else if state.direction == .outgoing {
            associateOutgoingIfNeeded(callId: callId)
            if let uuid = uuidByCallId[callId], state.status == .ringing {
                provider.reportOutgoingCall(with: uuid, startedConnectingAt: Date())
            }
        }

        if let uuid = uuidByCallId[callId] {
            if [.active, .reconnecting].contains(state.status) {
                if state.direction != .incoming {
                    provider.reportOutgoingCall(with: uuid, connectedAt: Date())
                }
            }
            if let reason = Self.endReason(for: state.status) {
                provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
                uuidByCallId[callId] = nil
                callIdByUUID[uuid] = nil
                media?.callKitDidDeactivateAudioSession(.sharedInstance())
            }
        }
    }

    func endAll() {
        for uuid in callIdByUUID.keys {
            provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
        uuidByCallId.removeAll()
        callIdByUUID.removeAll()
        pendingOutgoing = nil
        media?.callKitDidDeactivateAudioSession(.sharedInstance())
    }

    func reportIncoming(
        callId: String,
        kind: CallKind,
        callerId: String,
        callerName: String
    ) {
        guard uuidByCallId[callId] == nil, let uuid = UUID(uuidString: callId) else { return }
        media?.prepareForCallKit()
        uuidByCallId[callId] = uuid
        callIdByUUID[uuid] = callId
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: callerId)
        update.localizedCallerName = callerName
        update.hasVideo = kind == .video
        provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            guard error != nil else { return }
            Task { @MainActor [weak self] in
                self?.uuidByCallId[callId] = nil
                self?.callIdByUUID[uuid] = nil
                if let model = self?.model { await model.decline() }
            }
        }
    }

    func end(callId: String, reason: CXCallEndedReason = .remoteEnded) {
        guard let uuid = uuidByCallId.removeValue(forKey: callId) else { return }
        callIdByUUID[uuid] = nil
        provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
        media?.callKitDidDeactivateAudioSession(.sharedInstance())
    }

    nonisolated static func endReason(for status: CallLifecycleStatus) -> CXCallEndedReason? {
        switch status {
        case .rejected: return CXCallEndedReason.remoteEnded
        case .cancelled, .missed: return CXCallEndedReason.unanswered
        case .ended: return CXCallEndedReason.remoteEnded
        case .failed: return CXCallEndedReason.failed
        default: return nil
        }
    }

    // MARK: CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        pendingOutgoing = nil
        uuidByCallId.removeAll()
        callIdByUUID.removeAll()
        media?.callKitDidDeactivateAudioSession(.sharedInstance())
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        guard let pending = pendingOutgoing, pending.uuid == action.callUUID,
              let model = pending.model
        else {
            action.fail()
            return
        }
        pendingOutgoing = nil
        let systemUUID = pending.uuid
        Task { @MainActor [weak self, weak model] in
            guard let self, let model else {
                action.fail()
                return
            }
            await model.startCall(
                recipientId: pending.recipientId,
                recipientName: pending.recipientName,
                kind: pending.kind
            )
            action.fulfill()
            if model.state.current.callId == nil,
               [.failed, .idle].contains(model.state.current.status) {
                self.provider.reportCall(
                    with: systemUUID,
                    endedAt: Date(),
                    reason: .failed
                )
            }
            self.sync(state: model.state.current)
        }
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        Task { @MainActor [weak self] in
            guard let self, let model = await self.waitForLiveModel() else {
                action.fail()
                return
            }
            await model.answer()
            action.fulfill()
            self.sync(state: model.state.current)
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        Task { @MainActor [weak self] in
            guard let self, let model = await self.waitForLiveModel() else {
                action.fulfill()
                return
            }
            switch model.state.current.status {
            case .ringing:
                if model.state.current.direction == .incoming {
                    await model.decline()
                } else {
                    await model.cancel()
                }
            case .requestingPermission, .connecting, .active, .reconnecting:
                await model.end()
            default:
                break
            }
            action.fulfill()
            self.sync(state: model.state.current)
        }
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        media?.callKitDidActivateAudioSession(audioSession)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        media?.callKitDidDeactivateAudioSession(audioSession)
    }

    private func reportIncomingIfNeeded(
        _ state: CallSessionState,
        callId: String
    ) {
        reportIncoming(
            callId: callId,
            kind: state.kind,
            callerId: state.counterpartId ?? callId,
            callerName: state.counterpartName ?? "Your call partner"
        )
    }

    private func waitForLiveModel() async -> CallSessionModel? {
        for _ in 0..<50 {
            if let model, model.state.hasLiveCall { return model }
            if model?.state.current.status == .failed { return nil }
            try? await Task.sleep(for: .milliseconds(100))
        }
        return model?.state.hasLiveCall == true ? model : nil
    }

    private func associateOutgoingIfNeeded(callId: String) {
        guard uuidByCallId[callId] == nil,
              let pending = pendingOutgoing
        else { return }
        pendingOutgoing = nil
        uuidByCallId[callId] = pending.uuid
        callIdByUUID[pending.uuid] = callId
    }
}
