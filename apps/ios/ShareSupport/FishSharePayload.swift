import Foundation

public struct FishShareItem: Codable, Equatable, Sendable {
    public let relativePath: String
    public let originalName: String
    public let sourceMimeType: String

    public init(relativePath: String, originalName: String, sourceMimeType: String) {
        self.relativePath = relativePath
        self.originalName = originalName
        self.sourceMimeType = sourceMimeType
    }
}

public struct FishSharePayload: Codable, Equatable, Sendable {
    public let id: String
    public let text: String?
    public let items: [FishShareItem]
    public let omittedCount: Int

    public init(
        id: String = UUID().uuidString,
        text: String? = nil,
        items: [FishShareItem] = [],
        omittedCount: Int = 0
    ) {
        self.id = id
        self.text = text
        self.items = items
        self.omittedCount = max(0, omittedCount)
    }

    public var isEmpty: Bool {
        text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false && items.isEmpty
    }
}

/// Small file handoff between the iOS Share Extension and the signed-in app.
/// The extension never receives or stores the Supabase session.
public enum FishShareStore {
    public static let appGroupIdentifier = "group.app.fish.mobile"

    private static let manifestName = "pending-share.json"
    private static let itemsDirectory = "pending-share-items"

    public static func write(
        _ payload: FishSharePayload,
        container: URL? = nil
    ) throws {
        guard !payload.isEmpty else { throw FishShareStoreError.emptyPayload }
        let root = try rootURL(container)
        let directory = root.appendingPathComponent(itemsDirectory, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(payload)
        try data.write(to: root.appendingPathComponent(manifestName), options: .atomic)
    }

    public static func read(container: URL? = nil) -> FishSharePayload? {
        guard let root = try? rootURL(container),
              let data = try? Data(contentsOf: root.appendingPathComponent(manifestName))
        else { return nil }
        return try? JSONDecoder().decode(FishSharePayload.self, from: data)
    }

    public static func data(
        for item: FishShareItem,
        container: URL? = nil
    ) -> Data? {
        guard isSafeRelativePath(item.relativePath),
              let root = try? rootURL(container)
        else { return nil }
        let url = root.appendingPathComponent(item.relativePath)
        guard url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path + "/") else {
            return nil
        }
        return try? Data(contentsOf: url)
    }

    public static func clear(
        _ payload: FishSharePayload,
        container: URL? = nil
    ) {
        guard let root = try? rootURL(container) else { return }
        let directory = root
            .appendingPathComponent(itemsDirectory, isDirectory: true)
            .appendingPathComponent(payload.id, isDirectory: true)
        try? FileManager.default.removeItem(at: directory)
        if read(container: root)?.id == payload.id {
            try? FileManager.default.removeItem(at: root.appendingPathComponent(manifestName))
        }
    }

    public static func itemURL(
        for payloadId: String,
        fileName: String,
        container: URL? = nil
    ) throws -> URL {
        guard isSafePathComponent(payloadId), isSafePathComponent(fileName) else {
            throw FishShareStoreError.invalidPath
        }
        let root = try rootURL(container)
        let directory = root
            .appendingPathComponent(itemsDirectory, isDirectory: true)
            .appendingPathComponent(payloadId, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(fileName)
    }

    private static func rootURL(_ override: URL?) throws -> URL {
        if let override { return override }
        guard let url = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else { throw FishShareStoreError.containerUnavailable }
        return url
    }

    private static func isSafeRelativePath(_ path: String) -> Bool {
        let parts = path.split(separator: "/", omittingEmptySubsequences: true)
        return parts.count == 3 && parts[0] == itemsDirectory &&
            isSafePathComponent(String(parts[1])) && isSafePathComponent(String(parts[2]))
    }

    private static func isSafePathComponent(_ value: String) -> Bool {
        !value.isEmpty && value != "." && value != ".." &&
            !value.contains("/") && !value.contains("\\")
    }
}

public enum FishShareStoreError: Error, Equatable {
    case emptyPayload
    case containerUnavailable
    case invalidPath
}
