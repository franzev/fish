import Foundation
import Testing
@testable import ChatData

@Suite struct ChatGifCodingTests {
    @Test func encodesTheExactWirePayloadFieldNames() throws {
        let gif = ChatGif.fixture()
        let data = try JSONEncoder().encode(gif)
        let object = try #require(
            try JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        #expect(Set(object.keys) == [
            "provider", "providerId", "title", "description", "sourceUrl",
            "posterUrl", "previewUrl", "mediaUrl", "width", "height",
        ])
        #expect(object["provider"] as? String == "klipy")
    }

    @Test func roundTripsThroughJson() throws {
        let gif = ChatGif.fixture()
        let decoded = try JSONDecoder().decode(
            ChatGif.self,
            from: JSONEncoder().encode(gif)
        )
        #expect(decoded == gif)
    }

    @Test func identityIsProviderScoped() {
        #expect(ChatGif.fixture().id == "klipy:gif-1")
    }
}

extension ChatGif {
    static func fixture(providerId: String = "gif-1") -> ChatGif {
        ChatGif(
            provider: .klipy,
            providerId: providerId,
            title: "Excited otter",
            description: "An otter clapping excitedly",
            sourceUrl: URL(string: "https://klipy.com/gifs/\(providerId)")!,
            posterUrl: URL(string: "https://static.klipy.com/\(providerId)/poster.webp")!,
            previewUrl: URL(string: "https://static.klipy.com/\(providerId)/tiny.mp4")!,
            mediaUrl: URL(string: "https://static.klipy.com/\(providerId)/full.mp4")!,
            width: 400,
            height: 300
        )
    }
}
