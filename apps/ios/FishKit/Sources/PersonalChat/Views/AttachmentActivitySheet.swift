import SwiftUI
import UIKit

public struct AttachmentActivitySheet: UIViewControllerRepresentable {
    public let item: URL

    public init(item: URL) {
        self.item = item
    }

    public func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [item], applicationActivities: nil)
    }

    public func updateUIViewController(
        _ uiViewController: UIActivityViewController,
        context: Context
    ) {}
}
