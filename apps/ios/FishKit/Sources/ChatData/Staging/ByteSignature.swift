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
             "application/pdf":
            let detected = detectedMimeType(data)
            if mimeType == "image/heif" { return detected == "image/heif" || detected == "image/heic" }
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
}
