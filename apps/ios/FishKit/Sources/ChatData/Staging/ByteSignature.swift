import Foundation

public enum ByteSignature {
    public static func detectedMimeType(_ data: Data) -> String? {
        let bytes = [UInt8](data.prefix(16))
        if bytes.starts(with: [0xFF, 0xD8, 0xFF]) { return "image/jpeg" }
        if bytes.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
            return "image/png"
        }
        if data.count >= 12,
           String(decoding: data.prefix(4), as: UTF8.self) == "RIFF",
           String(decoding: data.dropFirst(8).prefix(4), as: UTF8.self) == "WEBP" {
            return "image/webp"
        }
        if String(decoding: data.prefix(5), as: UTF8.self) == "%PDF-" {
            return "application/pdf"
        }
        if data.count >= 12,
           String(decoding: data.dropFirst(4).prefix(4), as: UTF8.self) == "ftyp" {
            let brand = String(decoding: data.dropFirst(8).prefix(4), as: UTF8.self).lowercased()
            if ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].contains(brand) {
                return brand.hasPrefix("hei") ? "image/heic" : "image/heif"
            }
            if ["avif", "avis"].contains(brand) { return "image/avif" }
        }
        return nil
    }

    public static func matches(_ data: Data, mimeType: String) -> Bool {
        switch mimeType.lowercased() {
        case "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif",
             "application/pdf", "audio/mp4":
            let detected = detectedMimeType(data)
            if mimeType == "image/heif" { return detected == "image/heif" || detected == "image/heic" }
            if mimeType == "audio/mp4" { return isValidAudioMp4(data) }
            return detected == mimeType
        case "text/plain", "text/csv":
            return !data.isEmpty && !data.contains(0) && String(data: data, encoding: .utf8) != nil
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return matchesOfficeArchive(data, requiredDirectory: "word/")
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return matchesOfficeArchive(data, requiredDirectory: "xl/")
        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            return matchesOfficeArchive(data, requiredDirectory: "ppt/")
        default:
            return false
        }
    }

    private static func matchesOfficeArchive(
        _ data: Data,
        requiredDirectory: String
    ) -> Bool {
        guard data.starts(with: [0x50, 0x4B, 0x03, 0x04]),
              let archiveText = String(data: data, encoding: .isoLatin1),
              archiveText.contains("[Content_Types].xml"),
              archiveText.contains(requiredDirectory),
              !archiveText.localizedCaseInsensitiveContains("vbaProject.bin")
        else { return false }
        return true
    }

    private static func isValidAudioMp4(_ data: Data) -> Bool {
        var offset = 0
        var hasFileType = false
        var hasMovie = false
        var hasMediaData = false
        var boxCount = 0

        while offset < data.count {
            guard data.count - offset >= 8, boxCount < 256 else { return false }
            boxCount += 1
            let size = Int(readBigEndianUInt32(data, offset: offset))
            let type = String(decoding: data[(offset + 4)..<(offset + 8)], as: UTF8.self)
            var headerSize = 8
            var boxSize = size
            if size == 1 {
                guard data.count - offset >= 16,
                      readBigEndianUInt32(data, offset: offset + 8) == 0 else { return false }
                boxSize = Int(readBigEndianUInt32(data, offset: offset + 12))
                headerSize = 16
            } else if size == 0 {
                boxSize = data.count - offset
            }
            guard boxSize >= headerSize, boxSize <= data.count - offset else { return false }
            if type == "ftyp" {
                guard boxSize >= headerSize + 8 else { return false }
                hasFileType = true
            } else if type == "moov" && boxSize > headerSize {
                hasMovie = true
            } else if type == "mdat" && boxSize > headerSize {
                hasMediaData = true
            }
            offset += boxSize
        }
        return hasFileType && hasMovie && hasMediaData
    }

    private static func readBigEndianUInt32(_ data: Data, offset: Int) -> UInt32 {
        data[offset..<(offset + 4)].reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    }
}
