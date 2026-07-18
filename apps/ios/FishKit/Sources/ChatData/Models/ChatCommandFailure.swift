import Foundation

public struct ChatCommandFailure: Error, Equatable, Sendable {
    public let code: String
    public let notice: String
    public let statusCode: Int?

    public init(code: String, notice: String, statusCode: Int? = nil) {
        self.code = code
        self.notice = notice
        self.statusCode = statusCode
    }

    public static let unavailable = Self(
        code: "chat_unavailable",
        notice: "That did not save yet. Keep this open and try again."
    )

    public static let sendUnavailable = Self(
        code: "send_unavailable",
        notice: "That did not send yet. Keep this open and try again."
    )

    public static let notAuthenticated = Self(
        code: "not_authenticated",
        notice: "Sign in to continue.",
        statusCode: 401
    )

    public static let invalidRequest = Self(
        code: "invalid_request",
        notice: "That message is not available."
    )

    public static let markReadUnavailable = Self(
        code: "read_unavailable",
        notice: "Messages weren’t marked as read. Try again."
    )
}
