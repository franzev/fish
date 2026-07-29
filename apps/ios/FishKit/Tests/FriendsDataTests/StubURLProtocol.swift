import Foundation

/// Minimal URLProtocol stub: each test registers one canned response and can
/// read back the request (including its body) that reached the transport.
///
/// Storage is keyed by the concrete subclass, so the two transport suites —
/// serialized inside themselves, but still free to run alongside each other —
/// never share one canned response. Each suite registers its own subclass.
class StubURLProtocol: URLProtocol {
    struct Recorded: Sendable {
        let request: @Sendable () -> URLRequest?
        let body: @Sendable () -> Data?

        /// The outbound bytes exactly as they were sent.
        var bodyText: String? {
            body().map { String(decoding: $0, as: UTF8.self) }
        }

        /// Convenience for all-string bodies (the command payloads).
        var bodyJSON: [String: String]? {
            body().flatMap { try? JSONDecoder().decode([String: String].self, from: $0) }
        }
    }

    private struct Stub {
        let status: Int
        let body: Data
        var request: URLRequest?
        var requestBody: Data?
    }

    private static let lock = NSLock()
    private nonisolated(unsafe) static var stubs: [ObjectIdentifier: Stub] = [:]

    static func record(status: Int, body: String) -> Recorded {
        let key = ObjectIdentifier(self)
        lock.withLock { stubs[key] = Stub(status: status, body: Data(body.utf8)) }
        return Recorded(
            request: { lock.withLock { stubs[key]?.request } },
            body: { lock.withLock { stubs[key]?.requestBody } }
        )
    }

    override static func canInit(with _: URLRequest) -> Bool { true }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let key = ObjectIdentifier(type(of: self))
        let body = requestBody(of: request)
        let stub = Self.lock.withLock {
            Self.stubs[key]?.request = request
            Self.stubs[key]?.requestBody = body
            return Self.stubs[key]
        }

        guard let stub, let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let response = HTTPURLResponse(
            url: url,
            statusCode: stub.status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: stub.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private func requestBody(of request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

/// One canned response per transport suite.
final class DirectoryStubURLProtocol: StubURLProtocol {}
final class CommandStubURLProtocol: StubURLProtocol {}
