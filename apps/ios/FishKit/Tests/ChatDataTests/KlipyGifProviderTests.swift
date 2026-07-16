import Foundation
import Testing
@testable import ChatData

/// Intercepts every request the provider makes and returns a canned response.
private final class StubProtocol: URLProtocol {
    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var responseBody = Data("{}".utf8)
    nonisolated(unsafe) static var responseStatus = 200

    static func reset(body: String = "{}", status: Int = 200) {
        requests = []
        responseBody = Data(body.utf8)
        responseStatus = status
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: Self.responseStatus,
            httpVersion: nil,
            headerFields: nil
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseBody)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private func makeProvider(
    apiKey: String? = "test-key",
    pageSize: Int = 12
) -> KlipyGifProvider {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [StubProtocol.self]
    let defaults = UserDefaults(suiteName: "klipy-tests")!
    defaults.removePersistentDomain(forName: "klipy-tests")
    defaults.set("customer-1", forKey: KlipyGifProvider.customerIdDefaultsKey)
    return KlipyGifProvider(
        apiKey: apiKey,
        pageSize: pageSize,
        locale: Locale(identifier: "en_US"),
        defaults: defaults,
        session: URLSession(configuration: configuration)
    )
}

private func queryItems(of request: URLRequest) -> [String: String] {
    let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
    return Dictionary(
        uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") }
    )
}

private let validResult = """
{
  "id": "otter-1",
  "title": "Excited otter",
  "content_description": "An otter clapping excitedly",
  "itemurl": "https://klipy.com/view/otter-1",
  "media_formats": {
    "preview": { "url": "https://static.klipy.com/otter-1/poster.webp", "dims": [200, 150] },
    "tinymp4": { "url": "https://static2.klipy.com/otter-1/tiny.mp4", "dims": [220, 165] },
    "mp4": { "url": "https://static.klipy.com/otter-1/full.mp4", "dims": [400, 300] }
  }
}
"""

// Serialized: StubProtocol state is shared process-wide.
@Suite(.serialized) struct KlipyGifProviderTests {
    @Test func searchSendsTheExactWebParameterSet() async throws {
        StubProtocol.reset(body: #"{"results": [], "next": ""}"#)
        let provider = makeProvider()
        _ = try await provider.search(query: "thank you!", cursor: "cursor-7")

        let request = try #require(StubProtocol.requests.first)
        #expect(request.url?.host() == "api.klipy.com")
        #expect(request.url?.path() == "/v2/search")
        let items = queryItems(of: request)
        #expect(items["key"] == "test-key")
        #expect(items["client_key"] == "fish_chat")
        #expect(items["customer_id"] == "customer-1")
        #expect(items["locale"] == "en-US")
        #expect(items["contentfilter"] == "high")
        #expect(items["media_filter"] == "preview,tinymp4,mp4")
        #expect(items["limit"] == "12")
        #expect(items["q"] == "thank you!")
        #expect(items["pos"] == "cursor-7")
    }

    @Test func trendingUsesFeaturedWithoutAQuery() async throws {
        StubProtocol.reset(body: #"{"results": [], "next": null}"#)
        _ = try await makeProvider().trending(cursor: nil)
        let request = try #require(StubProtocol.requests.first)
        #expect(request.url?.path() == "/v2/featured")
        let items = queryItems(of: request)
        #expect(items["q"] == nil)
        #expect(items["pos"] == nil)
    }

    @Test func longQueriesSliceToFiftyCharactersAndPageSizeCapsAtTwentyFour() async throws {
        StubProtocol.reset(body: #"{"results": [], "next": ""}"#)
        let provider = makeProvider(pageSize: 99)
        _ = try await provider.search(query: String(repeating: "a", count: 80), cursor: nil)
        let items = queryItems(of: StubProtocol.requests[0])
        #expect(items["q"]?.count == 50)
        #expect(items["limit"] == "24")
    }

    @Test func mapsRenditionsHostsDimensionsAndAttribution() async throws {
        StubProtocol.reset(body: #"{"results": [\#(validResult)], "next": "p2"}"#)
        let page = try await makeProvider().trending(cursor: nil)

        #expect(page.next == "p2")
        let gif = try #require(page.gifs.first)
        #expect(gif.provider == .klipy)
        #expect(gif.providerId == "otter-1")
        #expect(gif.title == "Excited otter")
        #expect(gif.description == "An otter clapping excitedly")
        #expect(gif.posterUrl.absoluteString == "https://static.klipy.com/otter-1/poster.webp")
        #expect(gif.previewUrl.absoluteString == "https://static2.klipy.com/otter-1/tiny.mp4")
        #expect(gif.mediaUrl.absoluteString == "https://static.klipy.com/otter-1/full.mp4")
        #expect(gif.sourceUrl.absoluteString == "https://klipy.com/view/otter-1")
        #expect(gif.width == 400 && gif.height == 300)
    }

    @Test func dropsResultsWithOffAllowlistHostsOrMissingRenditions() async throws {
        let badHost = validResult.replacingOccurrences(
            of: "https://static.klipy.com/otter-1/full.mp4",
            with: "https://evil.example.com/full.mp4"
        )
        let missingRendition = validResult
            .replacingOccurrences(of: "\"tinymp4\"", with: "\"unused\"")
            .replacingOccurrences(of: "\"id\": \"otter-1\"", with: "\"id\": \"otter-2\"")
        StubProtocol.reset(
            body: #"{"results": [\#(badHost), \#(missingRendition), \#(validResult)], "next": ""}"#
        )
        let page = try await makeProvider().trending(cursor: nil)
        #expect(page.gifs.map(\.providerId) == ["otter-1"])
        #expect(page.next == nil)
    }

    @Test func fallsBackForBlankDescriptionOversizeDimensionsAndForeignSourceUrl() async throws {
        let sparse = """
        {
          "id": "sparse-1",
          "title": "  ",
          "content_description": "",
          "itemurl": "https://tenor.com/x",
          "media_formats": {
            "preview": { "url": "https://static.klipy.com/s/p.webp" },
            "tinymp4": { "url": "https://static.klipy.com/s/t.mp4" },
            "mp4": { "url": "https://static.klipy.com/s/f.mp4", "dims": [9000, 0] }
          }
        }
        """
        StubProtocol.reset(body: #"{"results": [\#(sparse)], "next": null}"#)
        let gif = try #require(try await makeProvider().trending(cursor: nil).gifs.first)
        #expect(gif.title == "GIF")
        #expect(gif.description == "GIF")
        #expect(gif.sourceUrl.absoluteString == "https://klipy.com/gifs/sparse-1")
        #expect(gif.width == 4096 && gif.height == 1)
    }

    @Test func missingKeyIsUnavailableAndNeverTouchesTheNetwork() async {
        StubProtocol.reset()
        let provider = makeProvider(apiKey: "  ")
        #expect(!provider.isAvailable)
        await #expect(throws: URLError.self) {
            _ = try await provider.trending(cursor: nil)
        }
        await provider.registerShare(gif: .fixture(), query: "otter")
        #expect(StubProtocol.requests.isEmpty)
    }

    @Test func serverErrorsThrow() async {
        StubProtocol.reset(status: 500)
        await #expect(throws: URLError.self) {
            _ = try await makeProvider().trending(cursor: nil)
        }
    }

    @Test func registerShareSendsIdAndQueryAndSwallowsFailures() async {
        StubProtocol.reset(status: 500)
        await makeProvider().registerShare(gif: .fixture(), query: "thank you")
        let items = queryItems(of: StubProtocol.requests[0])
        #expect(StubProtocol.requests[0].url?.path() == "/v2/registershare")
        #expect(items["id"] == "gif-1")
        #expect(items["q"] == "thank you")
    }

    @Test func customerIdIsCreatedOncePerInstall() {
        let defaults = UserDefaults(suiteName: "klipy-id-tests")!
        defaults.removePersistentDomain(forName: "klipy-id-tests")
        _ = KlipyGifProvider(apiKey: "k", defaults: defaults)
        let first = defaults.string(forKey: KlipyGifProvider.customerIdDefaultsKey)
        _ = KlipyGifProvider(apiKey: "k", defaults: defaults)
        let second = defaults.string(forKey: KlipyGifProvider.customerIdDefaultsKey)
        #expect(first != nil)
        #expect(first == second)
    }
}
