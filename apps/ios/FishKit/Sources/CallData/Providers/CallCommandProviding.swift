import Foundation

/// Lifecycle commands of the `call-command` Edge Function — mirrors the web
/// `CallCommandService` contract. Implementations throw `CallCommandFailure`
/// for calm, user-presentable failures.
///
/// Lesson-call actions (`initiateLesson`, `checkMedia`) are intentionally
/// absent until iOS has a booking surface.
public protocol CallCommandProviding: Sendable {
    func initiate(
        recipientId: String,
        kind: CallKind,
        clientRequestId: String
    ) async throws -> CallCommandReply
    func accept(callId: String) async throws -> CallCommandReply
    func reject(callId: String) async throws -> CallCommandReply
    func cancel(callId: String) async throws -> CallCommandReply
    func end(callId: String) async throws -> CallCommandReply
    func join(callId: String) async throws -> CallCommandReply
}
