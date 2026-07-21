import Foundation
import PushKit

struct FishVoipPushDestination: Sendable {
    let callId: String
    let kind: String
    let callerId: String
    let callerName: String
    let expiresAt: String
}

extension Notification.Name {
    static let fishVoipPushToken = Notification.Name("fish.voip-push-token")
    static let fishVoipPushTokenInvalidated = Notification.Name("fish.voip-push-token-invalidated")
    static let fishIncomingVoipCall = Notification.Name("fish.incoming-voip-call")
}

/// Registers PushKit as soon as the app process exists. Payloads are kept
/// deliberately small and are treated as wake-up hints until auth and RLS
/// recovery confirm the call row.
@MainActor
final class VoipPushCoordinator: NSObject, @MainActor PKPushRegistryDelegate {
    private static var pendingDestination: FishVoipPushDestination?
    private let registry: PKPushRegistry

    override init() {
        registry = PKPushRegistry(queue: .main)
        super.init()
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
    }

    static func consumePendingDestination() -> FishVoipPushDestination? {
        defer { pendingDestination = nil }
        return pendingDestination
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        guard !token.isEmpty else { return }
        NotificationCenter.default.post(name: .fishVoipPushToken, object: token)
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didInvalidatePushTokenFor type: PKPushType
    ) {
        guard type == .voIP else { return }
        NotificationCenter.default.post(name: .fishVoipPushTokenInvalidated, object: nil)
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        defer { completion() }
        guard type == .voIP,
              let destination = Self.destination(from: payload.dictionaryPayload)
        else { return }
        Self.pendingDestination = destination
        NotificationCenter.default.post(name: .fishIncomingVoipCall, object: destination)
    }

    static func destination(from payload: [AnyHashable: Any]) -> FishVoipPushDestination? {
        guard let callId = payload["callId"] as? String,
              UUID(uuidString: callId) != nil,
              let kind = payload["kind"] as? String,
              kind == "audio" || kind == "video",
              let callerId = payload["callerId"] as? String,
              !callerId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let callerName = payload["callerName"] as? String,
              !callerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let expiresAt = payload["expiresAt"] as? String,
              !expiresAt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return nil }
        return FishVoipPushDestination(
            callId: callId,
            kind: kind,
            callerId: callerId,
            callerName: callerName,
            expiresAt: expiresAt
        )
    }
}
