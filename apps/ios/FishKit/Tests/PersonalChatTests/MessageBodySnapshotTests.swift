import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct MessageBodySnapshotTests {
    private let document = """
    # A calm heading
    Plain text with **bold**, *italic*, `inline code`, and a [safe link](https://fish.test/help).

    > Pause before the key point.

    - First step
      - Nested support
    - Second step

    1. Breathe
    2. Begin

    ```swift
    let greeting = "Hello"
    ```
    """

    @MainActor @Test func constructAndPaletteSnapshots() {
        let view = ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                MessageBody(body: document, isOutgoing: false)
                    .padding(Spacing.sm)
                    .background(Palette.messageIncomingContainer)
                MessageBody(body: document, isOutgoing: true)
                    .padding(Spacing.sm)
                    .background(Palette.messageOutgoingContainer)
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: view, named: "message-markdown")
        assertAccessibilitySnapshots(of: view, named: "message-markdown")
    }
}
