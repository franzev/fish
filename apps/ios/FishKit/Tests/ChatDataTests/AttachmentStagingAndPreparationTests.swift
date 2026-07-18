import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import ChatData

struct AttachmentStagingAndPreparationTests {
    @Test func stagingIsPersistentProtectedBackupExcludedAndSweepable() async throws {
        let root = temporaryDirectory("staging")
        defer { try? FileManager.default.removeItem(at: root) }
        let first = try AttachmentStaging(root: root)
        let kept = try await first.write(Data("keep".utf8), fileExtension: "TXT/../../")
        let stale = try await first.write(Data("stale".utf8), fileExtension: "pdf")

        #expect(kept.deletingLastPathComponent() == root)
        #expect(kept.pathExtension == "txt")
        #expect(try kept.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)

        let reopened = try AttachmentStaging(root: root)
        #expect(FileManager.default.fileExists(atPath: kept.path))
        #expect(await reopened.sweep(keeping: [kept], olderThan: .distantFuture) == 1)
        #expect(FileManager.default.fileExists(atPath: kept.path))
        #expect(!FileManager.default.fileExists(atPath: stale.path))

        await reopened.remove(root.deletingLastPathComponent().appending(path: "outside.txt"))
        #expect(FileManager.default.fileExists(atPath: kept.path))
        await reopened.remove(kept)
        #expect(!FileManager.default.fileExists(atPath: kept.path))
    }

    @Test func documentPreparationVerifiesBytesAndHashesExactStagedData() async throws {
        let root = temporaryDirectory("document")
        defer { try? FileManager.default.removeItem(at: root) }
        let staging = try AttachmentStaging(root: root)
        let data = Data("calm,clear\nhello,world".utf8)
        let prepared = try await ImagePreparation().prepare(
            AttachmentCandidate(data: data, originalName: "notes.csv", sourceMimeType: "text/csv"),
            staging: staging
        )
        #expect(prepared.uploadMimeType == "text/csv")
        #expect(prepared.sourceByteSize == data.count)
        #expect(prepared.uploadByteSize == data.count)
        #expect(prepared.sha256 == ImagePreparation.sha256(data))
        #expect(try Data(contentsOf: prepared.url) == data)

        await #expect(throws: ImagePreparation.Failure.invalidBytes) {
            _ = try await ImagePreparation().prepare(
                AttachmentCandidate(
                    data: Data("not a PDF".utf8),
                    originalName: "notes.pdf",
                    sourceMimeType: "application/pdf"
                ),
                staging: staging
            )
        }
    }

    @Test func imagePreparationBakesAllOrientationsAndStripsMetadata() async throws {
        let root = temporaryDirectory("orientation")
        defer { try? FileManager.default.removeItem(at: root) }
        let staging = try AttachmentStaging(root: root)

        for orientation in 1...8 {
            let source = try imageData(width: 80, height: 40, orientation: orientation)
            let prepared = try await ImagePreparation().prepare(
                AttachmentCandidate(
                    data: source,
                    originalName: "Photo",
                    sourceMimeType: "image/jpeg"
                ),
                staging: staging
            )
            #expect(prepared.uploadMimeType == "image/jpeg")
            #expect(prepared.uploadByteSize <= AttachmentRules.imagePreparedMaxBytes)
            #expect(ByteSignature.matches(try Data(contentsOf: prepared.url), mimeType: "image/jpeg"))
            if orientation >= 5 {
                #expect(prepared.width == 40 && prepared.height == 80, "orientation \(orientation)")
            } else {
                #expect(prepared.width == 80 && prepared.height == 40, "orientation \(orientation)")
            }
            let output = try Data(contentsOf: prepared.url)
            let outputSource = try #require(CGImageSourceCreateWithData(output as CFData, nil))
            let properties = try #require(
                CGImageSourceCopyPropertiesAtIndex(outputSource, 0, nil) as? [CFString: Any]
            )
            #expect(properties[kCGImagePropertyGPSDictionary] == nil)
            let exif = properties[kCGImagePropertyExifDictionary] as? [CFString: Any]
            let tiff = properties[kCGImagePropertyTIFFDictionary] as? [CFString: Any]
            #expect(exif?[kCGImagePropertyExifUserComment] == nil)
            #expect(tiff?[kCGImagePropertyTIFFMake] == nil)
            #expect((properties[kCGImagePropertyOrientation] as? Int ?? 1) == 1)
        }
    }

    @Test func largeImageDownsamplesAtDecodeToTheDimensionCap() async throws {
        let root = temporaryDirectory("large-image")
        defer { try? FileManager.default.removeItem(at: root) }
        let prepared = try await ImagePreparation().prepare(
            AttachmentCandidate(
                data: try imageData(width: 3_200, height: 1_200, orientation: 1),
                originalName: "wide.jpg",
                sourceMimeType: "image/jpeg"
            ),
            staging: try AttachmentStaging(root: root)
        )
        #expect(prepared.width == 2_560)
        #expect(prepared.height == 960)
        #expect(prepared.uploadByteSize <= AttachmentRules.imagePreparedMaxBytes)
    }

    private func temporaryDirectory(_ name: String) -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "fish-attachment-tests-\(name)-\(UUID().uuidString)", directoryHint: .isDirectory)
    }

    private func imageData(width: Int, height: Int, orientation: Int) throws -> Data {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let context = try #require(CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        context.setFillColor(CGColor(red: 0.1, green: 0.55, blue: 0.8, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.setFillColor(CGColor(red: 0.9, green: 0.7, blue: 0.2, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width / 3, height: height / 2))
        let image = try #require(context.makeImage())
        let output = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(
            output,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ))
        let properties: [CFString: Any] = [
            kCGImagePropertyOrientation: orientation,
            kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 14.59],
            kCGImagePropertyExifDictionary: [kCGImagePropertyExifUserComment: "private note"],
            kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFMake: "Private camera"],
            kCGImageDestinationLossyCompressionQuality: 0.9,
        ]
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        #expect(CGImageDestinationFinalize(destination))
        return output as Data
    }
}
