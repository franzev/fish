import DesignSystem
import SwiftUI

/// Grouped + searchable emoji grid over the shared catalog. Browsing shows one
/// category at a time with a bottom icon strip (mirroring the web layout);
/// typing flattens results across every category. The host decides what a
/// selection means; the panel itself stays stateless beyond its query.
struct EmojiPanel: View {
    let onSelect: (String) -> Void

    @State private var query: String
    @State private var activeGroupSlug: String

    init(initialQuery: String = "", onSelect: @escaping (String) -> Void) {
        self.onSelect = onSelect
        self._query = State(initialValue: initialQuery)
        self._activeGroupSlug = State(initialValue: EmojiCatalog.groups.first?.slug ?? "")
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var activeGroup: EmojiGroup? {
        EmojiCatalog.groups.first { $0.slug == activeGroupSlug }
    }

    var body: some View {
        VStack(spacing: 0) {
            MediaPickerSearchField(label: "Search emoji", text: $query)
            if trimmedQuery.isEmpty {
                browse
            } else {
                results
            }
        }
    }

    private var browse: some View {
        VStack(spacing: 0) {
            ScrollView {
                if let activeGroup {
                    emojiGrid(activeGroup.emojis)
                        .padding(.horizontal, Spacing.xs)
                        .padding(.bottom, Spacing.xs)
                }
            }
            .id(activeGroupSlug)
            categoryStrip
        }
    }

    private var results: some View {
        ScrollView {
            let matches = EmojiCatalog.search(trimmedQuery)
            if matches.isEmpty {
                Text("No emoji match that yet.")
                    .textStyle(.ui)
                    .foregroundStyle(Palette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Spacing.xs)
            } else {
                VStack(alignment: .leading, spacing: Spacing.twoXs) {
                    Text("Results")
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                    emojiGrid(matches)
                }
                .padding(.horizontal, Spacing.xs)
                .padding(.bottom, Spacing.xs)
            }
        }
    }

    private func emojiGrid(_ emojis: [EmojiEntry]) -> some View {
        LazyVGrid(
            columns: [GridItem(
                .adaptive(minimum: Metrics.targetTouch),
                spacing: Spacing.twoXs
            )],
            spacing: Spacing.twoXs
        ) {
            ForEach(emojis) { entry in
                Button {
                    onSelect(entry.emoji)
                } label: {
                    Text(entry.emoji)
                        .font(Typography.emojiGlyph)
                        .accessibilityHidden(true)
                        .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(entry.name)
            }
        }
    }

    private var categoryStrip: some View {
        VStack(alignment: .leading, spacing: 0) {
            Palette.divider.frame(height: 1)
            Text(activeGroup?.name ?? "")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .padding(.horizontal, Spacing.sm)
                .padding(.top, Spacing.twoXs)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(EmojiCatalog.groups) { group in
                        categoryButton(group)
                    }
                }
                .padding(.horizontal, Spacing.twoXs)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Emoji category")
        }
        .background(Palette.surface)
    }

    private func categoryButton(_ group: EmojiGroup) -> some View {
        let isSelected = group.slug == activeGroupSlug
        return Button {
            activeGroupSlug = group.slug
        } label: {
            Self.categoryIcon(for: group.slug).image
                .glyphFrame()
                .foregroundStyle(isSelected ? Palette.foreground : Palette.muted)
                .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
                .background(
                    isSelected ? Palette.surface2 : .clear,
                    in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(group.name)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    /// Monochrome Tabler icon per category — colored emoji as tab icons
    /// competed with the grid on web, and the same reasoning holds here.
    static func categoryIcon(for slug: String) -> Icon {
        switch slug {
        case "smileys_emotion": .moodSmile
        case "people_body": .handStop
        case "animals_nature": .paw
        case "food_drink": .toolsKitchen
        case "travel_places": .car
        case "activities": .ballBasketball
        case "objects": .bulb
        case "symbols": .hash
        case "flags": .flag
        default: .moodSmile
        }
    }
}
