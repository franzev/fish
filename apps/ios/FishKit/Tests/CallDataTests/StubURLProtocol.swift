import Foundation

/// Minimal URLProtocol stub: each test registers one canned response and can
/// read back the request (including its body) that reached the transport.
final class StubURLProtocol: URLProtocol {
    struct Recorded: Sendable {
        let request: @Sendable () -> URLRequest?
        let bodyJSON: @Sendable () -> [String: String]?
    }

    private struct Stub {
        let status: Int
        let body: Data
    }

    private static let lock = NSLock()
    private nonisolated(unsafe) static var stub: Stub?
    private nonisolated(unsafe) static var lastRequest: URLRequest?
    private nonisolated(unsafe) static var lastBody: Data?

    static func record(status: Int, body: String) -> Recorded {
        lock.withLock {
            stub = Stub(status: status, body: Data(body.utf8))
            lastRequest = nil
            lastBody = nil
        }
        return Recorded(
            request: { lock.withLock { lastRequest } },
            bodyJSON: {
                lock.withLock {
                    lastBody.flatMap {
                        try? JSONDecoder().decode([String: String].self, from: $0)
                    }
                }
            }
        )
    }

    override static func canInit(with _: URLRequest) -> Bool { true }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let body = requestBody(of: request)
        let stub = Self.lock.withLock {
            Self.lastRequest = request
            Self.lastBody = body
            return Self.stub
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
