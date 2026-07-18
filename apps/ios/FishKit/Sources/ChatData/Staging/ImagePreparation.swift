import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

public protocol AttachmentPreparing: Sendable {
    func prepare(
        _ candidate: AttachmentCandidate,
        staging: AttachmentStaging
    ) async throws -> StagedAttachmentFile
}

public struct ImagePreparation: AttachmentPreparing, Sendable {
    public enum Failure: Error, Equatable, Sendable {
        case unsupportedType
        case invalidBytes
        case tooLarge
        case encodingFailed
    }

    public init() {}

    public func prepare(
        _ candidate: AttachmentCandidate,
        staging: AttachmentStaging
    ) async throws -> StagedAttachmentFile {
        guard AttachmentRules.allowedSourceMimeTypes.contains(candidate.sourceMimeType) else {
            throw Failure.unsupportedType
        }
        if AttachmentRules.imageMimeTypes.contains(candidate.sourceMimeType) {
            return try await prepareImage(candidate, staging: staging)
        }
        guard ByteSignature.matches(candidate.data, mimeType: candidate.sourceMimeType) else {
            throw Failure.invalidBytes
        }
        let fileExtension = candidate.originalName.split(separator: ".").last.map(String.init) ?? "bin"
        let url = try await staging.write(candidate.data, fileExtension: fileExtension)
        return StagedAttachmentFile(
            url: url,
            originalName: candidate.originalName,
            sourceMimeType: candidate.sourceMimeType,
            uploadMimeType: candidate.sourceMimeType,
            sourceByteSize: candidate.data.count,
            uploadByteSize: candidate.data.count,
            sha256: Self.sha256(candidate.data)
        )
    }

    private func prepareImage(
        _ candidate: AttachmentCandidate,
        staging: AttachmentStaging
    ) async throws -> StagedAttachmentFile {
        let encoded = try await Task.detached(priority: .userInitiated) {
            try Self.downsampleAndEncode(candidate.data)
        }.value
        guard encoded.data.count <= AttachmentRules.imagePreparedMaxBytes else {
            throw Failure.tooLarge
        }
        let url = try await staging.write(encoded.data, fileExtension: "jpg")
        return StagedAttachmentFile(
            url: url,
            originalName: candidate.originalName.isEmpty ? "Photo" : candidate.originalName,
            sourceMimeType: candidate.sourceMimeType,
            uploadMimeType: "image/jpeg",
            sourceByteSize: candidate.data.count,
            uploadByteSize: encoded.data.count,
            width: encoded.width,
            height: encoded.height,
            sha256: Self.sha256(encoded.data)
        )
    }

    private static func downsampleAndEncode(
        _ data: Data
    ) throws -> (data: Data, width: Int, height: Int) {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            throw Failure.invalidBytes
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: false,
            kCGImageSourceThumbnailMaxPixelSize: AttachmentRules.imageMaxDimension,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw Failure.invalidBytes
        }
        let first = try encodeJPEG(image, quality: AttachmentRules.jpegQuality)
        let output = first.count <= AttachmentRules.imagePreparedMaxBytes
            ? first
            : try encodeJPEG(image, quality: 0.6)
        guard output.count <= AttachmentRules.imagePreparedMaxBytes else {
            throw Failure.tooLarge
        }
        return (output, image.width, image.height)
    }

    private static func encodeJPEG(_ image: CGImage, quality: Double) throws -> Data {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            output,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else { throw Failure.encodingFailed }
        let properties: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: quality,
            kCGImagePropertyOrientation: 1,
            kCGImagePropertyExifDictionary: [:],
            kCGImagePropertyGPSDictionary: [:],
            kCGImagePropertyTIFFDictionary: [:],
        ]
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw Failure.encodingFailed }
        return output as Data
    }

    public static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
