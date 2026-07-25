import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentCategoryBar: View {
    let categories: [SharedContentGalleryCategory]
    let selectedCategory: SharedContentGalleryCategory?
    let onSelect: (SharedContentGalleryCategory) -> Void

    var body: some View {
        if categories.count > 1 {
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(categories) { category in
                            categoryButton(category)
                                .id(category)
                        }
                    }
                    .padding(.horizontal, Spacing.page)
                }
                .onChange(of: selectedCategory) { _, selected in
                    guard let selected else { return }
                    withAnimation(.none) {
                        proxy.scrollTo(selected, anchor: .center)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Shared content categories")
        }
    }

    private func categoryButton(
        _ category: SharedContentGalleryCategory
    ) -> some View {
        let selected = category == selectedCategory
        return Button {
            onSelect(category)
        } label: {
            VStack(spacing: Spacing.twoXs) {
                Text(category.label)
                    .textStyle(.ui)
                    .foregroundStyle(selected ? Palette.foreground : Palette.body)
                    .fixedSize(horizontal: true, vertical: false)
                Rectangle()
                    .fill(selected ? Palette.foreground : .clear)
                    .frame(height: Spacing.threeXs)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: Metrics.targetTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(category.label)
        .accessibilityValue(selected ? "Selected" : "")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
