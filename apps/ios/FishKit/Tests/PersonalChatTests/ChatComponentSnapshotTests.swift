import ChatData
import DesignSystem
import Foundation
import SwiftUI
import Testing
@testable import PersonalChat

/// Component-level snapshot cases. Each `named:` string matches the
/// `@Preview(name = …)` of its Compose counterpart so the pair can be compared
/// side by side. Screen-level cases live in the other snapshot suites.
struct ChatComponentSnapshotTests {
    @MainActor @Test func reactionStates() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(spacing: Spacing.twoXs) {
                ReactionPill(
                    reaction: MessageReactionUiModel(emoji: "👍", count: 1, byMe: false),
                    disabled: false,
                    action: {}
                )
                ReactionPill(
                    reaction: MessageReactionUiModel(emoji: "🎉", count: 4, byMe: true),
                    disabled: false,
                    action: {}
                )
                AddReactionPill(disabled: false, action: {})
                AddReactionPill(disabled: true, action: {})
            }
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "reaction-states")
    }

    @MainActor @Test func olderMessagesStates() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            OlderMessagesSlot(state: .idle, onRetry: {})
            OlderMessagesSlot(state: .loading, onRetry: {})
            OlderMessagesSlot(state: .failed, onRetry: {})
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "older-messages-states")
    }

    @MainActor @Test func stickerStates() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            StickerMedia(stickerId: "aquatic-great-job-sea-star")
            StickerMedia(stickerId: "not-in-the-catalog")
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "sticker-states")
    }

    @MainActor @Test func conversationQuietStates() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            ConversationQuietRow(
                mute: .on,
                optionsShown: false,
                now: Self.quietNow,
                onToggleOptions: {},
                onSelect: { _ in }
            )
            ConversationQuietRow(
                mute: ConversationMute(
                    isMuted: true,
                    mutedUntil: Self.quietNow.addingTimeInterval(3600)
                ),
                optionsShown: false,
                now: Self.quietNow,
                onToggleOptions: {},
                onSelect: { _ in }
            )
            ConversationQuietRow(
                mute: ConversationMute(isMuted: true, mutedUntil: nil),
                optionsShown: false,
                now: Self.quietNow,
                onToggleOptions: {},
                onSelect: { _ in }
            )
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "conversation-quiet-states")
    }

    @MainActor @Test func conversationQuietOptions() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            ConversationQuietRow(
                mute: .on,
                optionsShown: true,
                now: Self.quietNow,
                onToggleOptions: {},
                onSelect: { _ in }
            )
            ConversationQuietRow(
                mute: ConversationMute(isMuted: true, mutedUntil: nil),
                optionsShown: true,
                now: Self.quietNow,
                onToggleOptions: {},
                onSelect: { _ in }
            )
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "conversation-quiet-options")
    }

    private static let quietNow = Date(timeIntervalSince1970: 1_753_437_600)
}
