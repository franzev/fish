import Foundation

public actor AttachmentStaging {
    public enum Failure: Error, Equatable, Sendable {
        case unavailable
        case tooLarge
    }

    public let root: URL
    private let fileManager: FileManager

    public init(
        root: URL? = nil,
        fileManager: FileManager = .default
    ) throws {
        self.fileManager = fileManager
        if let root {
            self.root = root
        } else {
            guard let applicationSupport = fileManager.urls(
                for: .applicationSupportDirectory,
                in: .userDomainMask
            ).first else { throw Failure.unavailable }
            self.root = applicationSupport.appending(path: "ChatOutbox", directoryHint: .isDirectory)
        }
        try fileManager.createDirectory(
            at: self.root,
            withIntermediateDirectories: true,
            attributes: nil
        )
        try Self.excludeFromBackup(self.root)
    }

    public func write(_ data: Data, fileExtension: String) throws -> URL {
        guard !data.isEmpty else { throw Failure.unavailable }
        let safeExtension = fileExtension
            .lowercased()
            .filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
        let url = root
            .appending(path: UUID().uuidString.lowercased())
            .appendingPathExtension(safeExtension.isEmpty ? "bin" : safeExtension)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        try Self.excludeFromBackup(url)
        return url
    }

    public func importSecurityScopedFile(
        _ source: URL,
        maximumBytes: Int
    ) throws -> URL {
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }
        let values = try source.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true else { throw Failure.unavailable }
        if let size = values.fileSize, size > maximumBytes { throw Failure.tooLarge }
        let data = try Data(contentsOf: source, options: .mappedIfSafe)
        guard data.count <= maximumBytes else { throw Failure.tooLarge }
        return try write(data, fileExtension: source.pathExtension)
    }

    public func remove(_ url: URL) {
        guard isInsideRoot(url) else { return }
        try? fileManager.removeItem(at: url)
    }

    @discardableResult
    public func sweep(
        keeping liveUrls: Set<URL> = [],
        olderThan cutoff: Date = .distantFuture
    ) -> Int {
        let livePaths = Set(liveUrls.compactMap { $0.standardizedFileURL.path.removingPercentEncoding })
        guard let files = try? fileManager.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return 0 }
        var removed = 0
        for file in files {
            let values = try? file.resourceValues(forKeys: [.contentModificationDateKey, .isRegularFileKey])
            guard values?.isRegularFile == true,
                  !livePaths.contains(file.standardizedFileURL.path),
                  (values?.contentModificationDate ?? .distantPast) <= cutoff
            else { continue }
            if (try? fileManager.removeItem(at: file)) != nil { removed += 1 }
        }
        return removed
    }

    private func isInsideRoot(_ url: URL) -> Bool {
        let rootPath = root.standardizedFileURL.path + "/"
        return url.standardizedFileURL.path.hasPrefix(rootPath)
    }

    private static func excludeFromBackup(_ url: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableUrl = url
        try mutableUrl.setResourceValues(values)
    }
}
