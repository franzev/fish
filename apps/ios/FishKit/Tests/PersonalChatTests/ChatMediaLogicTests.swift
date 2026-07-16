import ChatData
import Foundation
import Testing
@testable import PersonalChat

struct StickerCatalogTests {
    @Test func bundlesTheFullSharedPack() {
        #expect(StickerCatalog.all.count == 32)
        #expect(StickerCatalog.all.allSatisfy { $0.id.hasPrefix("aquatic-") })
    }

    @Test func usesOneUniqueAnimalPerSticker() {
        let animals = StickerCatalog.all.map(\.animal)
        #expect(Set(animals).count == animals.count)
    }

    @Test func looksUpKnownIdsAndRejectsUnknownOnes() {
        let otter = StickerCatalog.sticker(for: "aquatic-hello-otter")
        #expect(otter?.phrase == "Hello!")
        #expect(otter?.assetBaseName == "hello-otter")
        #expect(StickerCatalog.sticker(for: "aquatic-future-axolotl") == nil)
    }

    @Test func searchesPhraseAnimalKeywordsAndStylesCaseInsensitively() {
        #expect(StickerCatalog.search("  ").count == 32)
        #expect(StickerCatalog.search("OTTER").contains { $0.id == "aquatic-hello-otter" })
        #expect(StickerCatalog.search("thanks").contains { $0.id == "aquatic-thank-you-octopus" })
        #expect(StickerCatalog.search("cute").count == 32)
        #expect(StickerCatalog.search("volcano").isEmpty)
    }
}

struct EmojiCatalogTests {
    @Test func bundlesTheNineSharedGroups() {
        #expect(EmojiCatalog.groups.count == 9)
        #expect(EmojiCatalog.groups.first?.name == "Smileys & Emotion")
        #expect(EmojiCatalog.groups.reduce(0) { $0 + $1.emojis.count } == 1914)
    }

    @Test func searchFlattensAcrossGroupsAndMatchesNameOrSlug() {
        let grinning = EmojiCatalog.search("grinning face")
        #expect(grinning.contains { $0.emoji == "😀" })
        let bySlug = EmojiCatalog.search("grinning_face")
        #expect(bySlug.contains { $0.emoji == "😀" })
        let mixedGroups = EmojiCatalog.search("heart")
        #expect(Set(mixedGroups.map(\.slug)).count == mixedGroups.count)
        #expect(mixedGroups.count > 20)
    }

    @Test func blankQueriesReturnNothingBecauseBrowsingUsesGroups() {
        #expect(EmojiCatalog.search("").isEmpty)
        #expect(EmojiCatalog.search("   ").isEmpty)
        #expect(EmojiCatalog.search("zzzznothing").isEmpty)
    }
}

struct MediaSelectionRulesTests {
    private let gif = ComposerSelection.gif(.fixture(), searchQuery: "otter")
    private let sticker = ComposerSelection.sticker(StickerCatalog.all[0])

    @Test func mediaAloneIsSendable() {
        #expect(MediaSelectionRules.isSendable(draft: "", selection: gif))
        #expect(MediaSelectionRules.isSendable(draft: "  ", selection: sticker))
    }

    @Test func textRulesStillApplyWithoutMedia() {
        #expect(!MediaSelectionRules.isSendable(draft: "   ", selection: .none))
        #expect(MediaSelectionRules.isSendable(draft: "Hello", selection: .none))
    }

    @Test func overLimitDraftBlocksSendEvenWithMedia() {
        let long = String(repeating: "a", count: 4001)
        #expect(!MediaSelectionRules.isSendable(draft: long, selection: gif))
        #expect(MediaSelectionRules.isSendable(
            draft: String(repeating: "a", count: 4000),
            selection: gif
        ))
    }

    @Test func selectionExposesExactlyOneStagedMedium() {
        #expect(gif.stagedGif != nil && gif.stagedSticker == nil)
        #expect(sticker.stagedSticker != nil && sticker.stagedGif == nil)
        #expect(ComposerSelection.none.stagedGif == nil)
        #expect(ComposerSelection.none.stagedSticker == nil)
    }
}

struct EmojiOnlyMessageTests {
    @Test func matchesSingleEmojiIncludingComplexClusters() {
        #expect(EmojiOnlyMessage.isEmojiOnly("😀"))
        #expect(EmojiOnlyMessage.isEmojiOnly(" ❤️ "))
        #expect(EmojiOnlyMessage.isEmojiOnly("👍🏽"))
        #expect(EmojiOnlyMessage.isEmojiOnly("👨‍👩‍👧‍👦"))
        #expect(EmojiOnlyMessage.isEmojiOnly("🇯🇵"))
        #expect(EmojiOnlyMessage.isEmojiOnly("3️⃣"))
    }

    @Test func rejectsPlainTextDigitsAndMixedContent() {
        #expect(!EmojiOnlyMessage.isEmojiOnly("5"))
        #expect(!EmojiOnlyMessage.isEmojiOnly("*"))
        #expect(!EmojiOnlyMessage.isEmojiOnly("a"))
        #expect(!EmojiOnlyMessage.isEmojiOnly("hello 😀"))
        #expect(!EmojiOnlyMessage.isEmojiOnly("😀😀"))
        #expect(!EmojiOnlyMessage.isEmojiOnly(""))
        #expect(!EmojiOnlyMessage.isEmojiOnly("   "))
    }
}

struct MediaAccessibilityTests {
    @Test func labelsMatchTheWebStrings() {
        let otter = StickerCatalog.sticker(for: "aquatic-hello-otter")!
        #expect(MediaAccessibility.stickerTileLabel(otter) == "Add Hello! sticker")
        #expect(MediaAccessibility.gifTileLabel(.fixture()) == "Choose An otter clapping excitedly")
        #expect(MediaAccessibility.gifPlaybackLabel(paused: true, description: "x") == "Play GIF: x")
        #expect(MediaAccessibility.gifPlaybackLabel(paused: false, description: "x") == "Pause GIF: x")
    }

    @Test func mediaDescriptionsKeepUnknownMediaReadable() {
        #expect(
            MediaAccessibility.mediaDescription(.sticker(id: "aquatic-hello-otter"))
                == "A cheerful sea otter waving hello sticker"
        )
        #expect(
            MediaAccessibility.mediaDescription(.sticker(id: "aquatic-unknown"))
                == "Sticker unavailable"
        )
        #expect(
            MediaAccessibility.mediaDescription(.gif(.fixture()))
                == "GIF: An otter clapping excitedly"
        )
        #expect(MediaAccessibility.mediaDescription(.gifUnavailable) == "GIF unavailable")
    }

    @Test func transcriptRowLabelWeavesMediaBeforeBody() {
        let message = MessageUiModel(
            id: "m1",
            direction: .incoming,
            senderId: "coach",
            senderName: "Sam Rivera",
            body: "Great work today",
            media: .sticker(id: "aquatic-great-job-sea-star"),
            sentAt: Date(timeIntervalSince1970: 1_752_600_000),
            delivery: nil
        )
        let row = MessageRowUiModel(
            message: message,
            groupPosition: .solo,
            showsMeta: true,
            showsDeliveryStatus: false
        )
        let label = MessageAccessibility.label(
            for: row,
            locale: Locale(identifier: "en_US"),
            timeZone: TimeZone(identifier: "UTC")!
        )
        #expect(label.contains("sticker. Great work today"))
        #expect(label.hasPrefix("Sam Rivera, "))
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
