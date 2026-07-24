import Darwin
import Foundation

public enum SharedContentMediaURLKind: Sendable, Equatable {
    case storage
    case gif
}

public struct SharedContentDNSResolver: Sendable {
    private let lookup: @Sendable (String) async -> [String]

    public init(lookup: @escaping @Sendable (String) async -> [String]) {
        self.lookup = lookup
    }

    public func addresses(for host: String) async -> [String] {
        await lookup(host)
    }

    public static let system = SharedContentDNSResolver { host in
        await Task.detached(priority: .utility) {
            systemAddresses(for: host)
        }.value
    }
}

public struct SharedContentValidatedMediaURL: Sendable, Equatable {
    public let url: URL
    public let canonicalHost: String
    public let addresses: Set<String>
}

/// Production allowlist for every native shared-content media request.
///
/// DNS names are canonical IDNA ASCII authorities. A request is eligible only
/// when every resolved answer is public unicast, and the transport verifies
/// that the connected peer belongs to that exact answer set.
public struct SharedContentMediaURLPolicy: Sendable {
    private let storageHosts: Set<String>
    private let localDevelopmentHost: String?
    private let localDevelopmentScheme: String?
    private let localDevelopmentPort: Int?
    private let allowsLocalDevelopment: Bool

    public init(
        supabaseURL: URL?,
        allowsLocalDevelopment: Bool = false
    ) {
        let configuredHost = supabaseURL?.host.flatMap(Self.canonicalHost)
        var hosts = Set(configuredHost.map { [$0] } ?? [])
        if let configuredHost,
           configuredHost.hasSuffix(".supabase.co") {
            let project = configuredHost.dropLast(".supabase.co".count)
            if !project.isEmpty {
                hosts.insert("\(project).storage.supabase.co")
            }
        }
        storageHosts = hosts
        self.allowsLocalDevelopment = allowsLocalDevelopment
        let isLocalDevelopment = allowsLocalDevelopment &&
            Self.isLocalDevelopmentHost(configuredHost)
        localDevelopmentHost = isLocalDevelopment ? configuredHost : nil
        localDevelopmentScheme = isLocalDevelopment
            ? supabaseURL?.scheme?.lowercased()
            : nil
        localDevelopmentPort = isLocalDevelopment
            ? Self.normalizedPort(
                scheme: supabaseURL?.scheme,
                port: supabaseURL?.port
            )
            : nil
    }

    public init(
        storageHost: String?,
        allowsLocalDevelopment: Bool = false
    ) {
        self.init(
            supabaseURL: storageHost.flatMap { URL(string: "https://\($0)") },
            allowsLocalDevelopment: allowsLocalDevelopment
        )
    }

    public static func isLocalDevelopmentBackend(_ url: URL?) -> Bool {
        guard let url,
              url.scheme?.lowercased() == "http",
              let host = url.host.flatMap(canonicalHost)
        else { return false }
        return isLocalDevelopmentHost(host)
    }

    public func canonicalURL(
        _ url: URL,
        kind: SharedContentMediaURLKind
    ) -> URL? {
        guard var components = URLComponents(
            url: url,
            resolvingAgainstBaseURL: false
        ),
        components.user == nil,
        components.password == nil,
        components.fragment == nil,
        let rawHost = url.host,
        let host = Self.canonicalHost(rawHost),
        !host.isEmpty
        else { return nil }

        let scheme = components.scheme?.lowercased()
        if kind == .storage,
           allowsLocalDevelopment,
           host == localDevelopmentHost,
           scheme == localDevelopmentScheme,
           Self.normalizedPort(
               scheme: scheme,
               port: components.port
           ) == localDevelopmentPort {
            components.scheme = scheme
            components.host = host
            return components.url
        }

        guard scheme == "https",
              components.port == nil || components.port == 443,
              !Self.isSpecialUseHost(host)
        else { return nil }

        let hostAllowed = switch kind {
        case .storage:
            storageHosts.contains(host)
        case .gif:
            Self.isApprovedGIFHost(host)
        }
        guard hostAllowed else { return nil }
        components.scheme = scheme
        components.host = host
        return components.url
    }

    public func allows(_ url: URL, kind: SharedContentMediaURLKind) -> Bool {
        canonicalURL(url, kind: kind) != nil
    }

    public func validate(
        _ url: URL,
        kind: SharedContentMediaURLKind,
        resolver: SharedContentDNSResolver = .system
    ) async -> SharedContentValidatedMediaURL? {
        guard let canonical = canonicalURL(url, kind: kind),
              let host = canonical.host.flatMap(Self.canonicalHost)
        else { return nil }
        let addresses = await resolver.addresses(for: host)
        guard !addresses.isEmpty,
              addresses.allSatisfy({ allowsAddress($0, host: host) })
        else { return nil }
        return SharedContentValidatedMediaURL(
            url: canonical,
            canonicalHost: host,
            addresses: Set(addresses.map(Self.canonicalAddress))
        )
    }

    public func allowsRedirect(
        from source: URL,
        to destination: URL,
        kind: SharedContentMediaURLKind
    ) -> Bool {
        guard let sourceHost = source.host.flatMap(Self.canonicalHost),
              let destinationURL = canonicalURL(destination, kind: kind),
              let destinationHost = destinationURL.host.flatMap(Self.canonicalHost),
              sourceHost == destinationHost,
              source.scheme?.lowercased() == destinationURL.scheme?.lowercased()
        else { return false }
        return true
    }

    public func allowsConnectedPeer(
        _ peer: String,
        validation: SharedContentValidatedMediaURL
    ) -> Bool {
        let canonicalPeer = Self.canonicalAddress(peer)
        return validation.addresses.contains(canonicalPeer) &&
            allowsAddress(canonicalPeer, host: validation.canonicalHost)
    }

    private func allowsAddress(_ address: String, host: String) -> Bool {
        if allowsLocalDevelopment && host == localDevelopmentHost {
            return Self.isLoopbackAddress(address)
        }
        return Self.isPublicUnicastAddress(address)
    }

    private static func canonicalHost(_ rawHost: String) -> String? {
        let withoutTerminalDot = rawHost.hasSuffix(".")
            ? String(rawHost.dropLast())
            : rawHost
        guard !withoutTerminalDot.isEmpty,
              !withoutTerminalDot.hasSuffix("."),
              let encoded = URL(string: "https://\(withoutTerminalDot)")?.host?
                .lowercased(),
              encoded.count <= 253,
              encoded.split(separator: ".").allSatisfy({ (1...63).contains($0.count) })
        else { return nil }
        return encoded
    }

    private static func isApprovedGIFHost(_ host: String) -> Bool {
        matchesNumberedHost(host, prefix: "static", suffix: ".klipy.com") ||
            matchesNumberedHost(host, prefix: "media", suffix: ".giphy.com")
    }

    private static func matchesNumberedHost(
        _ host: String,
        prefix: String,
        suffix: String
    ) -> Bool {
        guard host.hasPrefix(prefix), host.hasSuffix(suffix) else { return false }
        let digits = host.dropFirst(prefix.count).dropLast(suffix.count)
        return digits.allSatisfy(\.isNumber)
    }

    private static let specialUseSuffixes = [
        ".localhost", ".local", ".localdomain", ".internal", ".lan", ".home",
        ".home.arpa", ".invalid", ".test", ".example", ".onion",
    ]

    private static func isSpecialUseHost(_ host: String) -> Bool {
        isIPAddress(host) ||
            isLocalDevelopmentHost(host) ||
            specialUseSuffixes.contains(where: host.hasSuffix) ||
            !host.contains(".")
    }

    private static func isLocalDevelopmentHost(_ host: String?) -> Bool {
        guard let host else { return false }
        return host == "localhost" ||
            host.hasSuffix(".localhost") ||
            host == "127.0.0.1" ||
            host == "::1" ||
            host == "[::1]"
    }

    private static func isIPAddress(_ host: String) -> Bool {
        var ipv4 = in_addr()
        var ipv6 = in6_addr()
        return host.withCString {
            inet_pton(AF_INET, $0, &ipv4) == 1 ||
                inet_pton(AF_INET6, $0, &ipv6) == 1
        }
    }

    private static func canonicalAddress(_ address: String) -> String {
        var storage = sockaddr_storage()
        var length = socklen_t(MemoryLayout<sockaddr_storage>.size)
        let result = address.withCString { source -> String? in
            var hints = addrinfo(
                ai_flags: AI_NUMERICHOST,
                ai_family: AF_UNSPEC,
                ai_socktype: SOCK_STREAM,
                ai_protocol: IPPROTO_TCP,
                ai_addrlen: 0,
                ai_canonname: nil,
                ai_addr: nil,
                ai_next: nil
            )
            var info: UnsafeMutablePointer<addrinfo>?
            guard getaddrinfo(source, nil, &hints, &info) == 0,
                  let info,
                  info.pointee.ai_addrlen <= length
            else { return nil }
            defer { freeaddrinfo(info) }
            memcpy(&storage, info.pointee.ai_addr, Int(info.pointee.ai_addrlen))
            length = info.pointee.ai_addrlen
            var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(
                withUnsafePointer(to: &storage) {
                    UnsafeRawPointer($0).assumingMemoryBound(to: sockaddr.self)
                },
                length,
                &buffer,
                socklen_t(buffer.count),
                nil,
                0,
                NI_NUMERICHOST
            ) == 0 else { return nil }
            let end = buffer.firstIndex(of: 0) ?? buffer.endIndex
            return String(decoding: buffer[..<end].map(UInt8.init(bitPattern:)), as: UTF8.self)
        }
        return result ?? address.lowercased()
    }

    private static func isLoopbackAddress(_ address: String) -> Bool {
        guard let bytes = addressBytes(address) else { return false }
        return bytes.family == AF_INET
            ? bytes.bytes.first == 127
            : bytes.bytes.dropLast().allSatisfy({ $0 == 0 }) && bytes.bytes.last == 1
    }

    private static func isPublicUnicastAddress(_ address: String) -> Bool {
        guard let parsed = addressBytes(address) else { return false }
        let bytes = parsed.bytes
        if parsed.family == AF_INET {
            let first = Int(bytes[0])
            let second = Int(bytes[1])
            let third = Int(bytes[2])
            return !(
                first == 0 || first == 10 || first == 127 || first >= 224 ||
                    (first == 100 && (64...127).contains(second)) ||
                    (first == 169 && second == 254) ||
                    (first == 172 && (16...31).contains(second)) ||
                    (first == 192 && second == 0) ||
                    (first == 192 && second == 168) ||
                    (first == 192 && second == 88 && third == 99) ||
                    (first == 198 && (18...19).contains(second)) ||
                    (first == 198 && second == 51 && third == 100) ||
                    (first == 203 && second == 0 && third == 113)
            )
        }
        let ipv4Mapped = bytes.prefix(10).allSatisfy({ $0 == 0 }) &&
            bytes[10] == 0xff && bytes[11] == 0xff
        if ipv4Mapped {
            return isPublicUnicastAddress(
                bytes.suffix(4).map(String.init).joined(separator: ".")
            )
        }
        return !(
            bytes.allSatisfy({ $0 == 0 }) ||
                (bytes.dropLast().allSatisfy({ $0 == 0 }) && bytes.last == 1) ||
                bytes[0] == 0xff ||
                bytes[0] & 0xfe == 0xfc ||
                (bytes[0] == 0xfe && bytes[1] & 0xc0 == 0x80) ||
                (bytes[0] == 0xfe && bytes[1] & 0xc0 == 0xc0) ||
                (bytes[0] == 0x20 && bytes[1] == 0x01 &&
                    bytes[2] == 0x0d && bytes[3] == 0xb8)
        )
    }

    private static func addressBytes(
        _ address: String
    ) -> (family: Int32, bytes: [UInt8])? {
        var ipv4 = in_addr()
        if address.withCString({ inet_pton(AF_INET, $0, &ipv4) }) == 1 {
            return (AF_INET, withUnsafeBytes(of: ipv4) { Array($0) })
        }
        var ipv6 = in6_addr()
        if address.withCString({ inet_pton(AF_INET6, $0, &ipv6) }) == 1 {
            return (AF_INET6, withUnsafeBytes(of: ipv6) { Array($0) })
        }
        return nil
    }

    private static func normalizedPort(scheme: String?, port: Int?) -> Int? {
        if let port { return port }
        switch scheme?.lowercased() {
        case "http": return 80
        case "https": return 443
        default: return nil
        }
    }
}

public struct SharedContentMediaTransport: Sendable {
    private let policy: SharedContentMediaURLPolicy
    private let resolver: SharedContentDNSResolver
    private let requiresPeerValidation: Bool

    public init(
        policy: SharedContentMediaURLPolicy,
        resolver: SharedContentDNSResolver = .system,
        requiresPeerValidation: Bool = true
    ) {
        self.policy = policy
        self.resolver = resolver
        self.requiresPeerValidation = requiresPeerValidation
    }

    public func data(
        for url: URL,
        kind: SharedContentMediaURLKind,
        session: URLSession
    ) async throws -> (Data, URLResponse) {
        guard let validation = await policy.validate(
            url,
            kind: kind,
            resolver: resolver
        ) else {
            throw URLError(.unsupportedURL)
        }
        let delegate = SharedContentMediaRedirectDelegate(
            policy: policy,
            kind: kind,
            resolver: resolver,
            initialValidation: validation,
            requiresPeerValidation: requiresPeerValidation
        )
        let result = try await session.data(
            for: URLRequest(url: validation.url),
            delegate: delegate
        )
        guard delegate.acceptedConnection else {
            throw URLError(.cannotConnectToHost)
        }
        return result
    }
}

final class SharedContentMediaRedirectDelegate:
    NSObject,
    URLSessionTaskDelegate,
    @unchecked Sendable
{
    private let policy: SharedContentMediaURLPolicy
    private let kind: SharedContentMediaURLKind
    private let resolver: SharedContentDNSResolver
    private let requiresPeerValidation: Bool
    private let lock = NSLock()
    private var validations: [String: SharedContentValidatedMediaURL]
    private var peerWasValidated = false
    private var rejected = false

    init(
        policy: SharedContentMediaURLPolicy,
        kind: SharedContentMediaURLKind,
        resolver: SharedContentDNSResolver,
        initialValidation: SharedContentValidatedMediaURL,
        requiresPeerValidation: Bool
    ) {
        self.policy = policy
        self.kind = kind
        self.resolver = resolver
        self.requiresPeerValidation = requiresPeerValidation
        validations = [initialValidation.url.absoluteString: initialValidation]
    }

    var acceptedConnection: Bool {
        lock.withLock {
            !rejected && (!requiresPeerValidation || peerWasValidated)
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        _ = (session, task)
        guard let source = response.url,
              let destination = request.url,
              policy.allowsRedirect(from: source, to: destination, kind: kind)
        else {
            completionHandler(nil)
            return
        }
        let completion = SharedContentRedirectCompletion(completionHandler)
        Task {
            guard let validation = await policy.validate(
                destination,
                kind: kind,
                resolver: resolver
            ) else {
                completion.call(nil)
                return
            }
            lock.withLock {
                validations[validation.url.absoluteString] = validation
            }
            var next = request
            next.url = validation.url
            completion.call(next)
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didFinishCollecting metrics: URLSessionTaskMetrics
    ) {
        _ = session
        guard requiresPeerValidation else { return }
        let accepted = metrics.transactionMetrics.allSatisfy { transaction in
            guard let url = transaction.request.url,
                  let remoteAddress = transaction.remoteAddress,
                  let validation = lock.withLock({
                      validations[url.absoluteString]
                  })
            else { return false }
            return policy.allowsConnectedPeer(
                remoteAddress,
                validation: validation
            )
        }
        lock.withLock {
            peerWasValidated = accepted && !metrics.transactionMetrics.isEmpty
            rejected = !peerWasValidated
        }
        if !accepted {
            task.cancel()
        }
    }
}

private func systemAddresses(for host: String) -> [String] {
    var hints = addrinfo(
        ai_flags: AI_ADDRCONFIG,
        ai_family: AF_UNSPEC,
        ai_socktype: SOCK_STREAM,
        ai_protocol: IPPROTO_TCP,
        ai_addrlen: 0,
        ai_canonname: nil,
        ai_addr: nil,
        ai_next: nil
    )
    var result: UnsafeMutablePointer<addrinfo>?
    guard getaddrinfo(host, nil, &hints, &result) == 0,
          let first = result
    else { return [] }
    defer { freeaddrinfo(first) }
    var addresses: [String] = []
    var current: UnsafeMutablePointer<addrinfo>? = first
    while let info = current {
        var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        if getnameinfo(
            info.pointee.ai_addr,
            info.pointee.ai_addrlen,
            &buffer,
            socklen_t(buffer.count),
            nil,
            0,
            NI_NUMERICHOST
        ) == 0 {
            let end = buffer.firstIndex(of: 0) ?? buffer.endIndex
            addresses.append(
                String(decoding: buffer[..<end].map(UInt8.init(bitPattern:)), as: UTF8.self)
            )
        }
        current = info.pointee.ai_next
    }
    return Array(Set(addresses))
}

private final class SharedContentRedirectCompletion: @unchecked Sendable {
    private let handler: (URLRequest?) -> Void

    init(_ handler: @escaping (URLRequest?) -> Void) {
        self.handler = handler
    }

    func call(_ request: URLRequest?) {
        handler(request)
    }
}
