import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentMetadataRow: View {
    let item: SharedContentGalleryItem
    let onSelectItem: ((String) -> Void)?

    var body: some View {
        if item.selectionEnabled, let onSelectItem {
            Button {
                onSelectItem(item.id)
            } label: {
                rowContent
            }
            .buttonStyle(.plain)
        } else {
            rowContent
        }
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            rowIcon.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
                .frame(
                    width: Metrics.targetTouch,
                    height: Metrics.targetTouch
                )
            VStack(alignment: .leading, spacing: Spacing.twoXs) {
                Text(title)
                    .textStyle(.ui)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(nil)
                    .multilineTextAlignment(.leading)
                    .sharedContentDirectionIsolated(titleIsDirectionIsolated)
                if let metadata {
                    Text(metadata)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .lineLimit(nil)
                        .multilineTextAlignment(.leading)
                        .sharedContentDirectionIsolated(metadataIsDirectionIsolated)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(
            maxWidth: .infinity,
            minHeight: SharedContentGalleryLayout.metadataRowMinimumHeight,
            alignment: .leading
        )
        .padding(.vertical, Spacing.md)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private var rowIcon: Icon {
        switch item {
        case .file: .fileText
        case .link: .link
        case .voice: .microphone
        case .media: .photo
        }
    }

    private var title: String {
        switch item {
        case .file(let item): item.filename
        case .link(let item): item.title
        case .voice: "Voice message"
        case .media(let item): item.title ?? "Media"
        }
    }

    private var metadata: String? {
        switch item {
        case .file(let item):
            return [item.friendlyType, item.sizeLabel]
                .compactMap { $0 }
                .joined(separator: " · ")
        case .link(let item):
            return item.hostname
        case .voice(let item):
            return item.durationLabel
        case .media:
            return nil
        }
    }

    private var accessibilityLabel: String {
        switch item {
        case .file(let item): item.accessibilityLabel
        case .link(let item): item.accessibilityLabel
        case .voice(let item): item.accessibilityLabel
        case .media(let item): item.accessibilityLabel
        }
    }

    private var titleIsDirectionIsolated: Bool {
        if case .file(let item) = item {
            return item.filenameDirection == .isolate
        }
        return false
    }

    private var metadataIsDirectionIsolated: Bool {
        if case .link(let item) = item {
            return item.hostnameDirection == .isolate
        }
        return false
    }
}
