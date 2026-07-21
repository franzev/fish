import UIKit
import UniformTypeIdentifiers

@MainActor
final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private let activity = UIActivityIndicatorView(style: .medium)
    private var hasStarted = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        statusLabel.text = "Preparing for FISH…"
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        activity.startAnimating()

        let stack = UIStackView(arrangedSubviews: [activity, statusLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !hasStarted else { return }
        hasStarted = true
        Task { await prepareShare() }
    }

    private func prepareShare() async {
        let providers = inputProviders()
        let payloadId = UUID().uuidString
        var text: String?
        var items: [FishShareItem] = []
        var omitted = 0

        for provider in providers {
            guard text == nil || items.count < 5 else {
                omitted += 1
                continue
            }
            guard let loaded = await load(provider: provider) else {
                omitted += 1
                continue
            }
            if let loadedText = loaded.text {
                text = [text, loadedText]
                    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .joined(separator: "\n")
                continue
            }
            guard let data = loaded.data, items.count < 5 else {
                omitted += 1
                continue
            }
            do {
                let fileName = "\(UUID().uuidString).shared"
                let url = try FishShareStore.itemURL(for: payloadId, fileName: fileName)
                try data.write(to: url, options: .atomic)
                items.append(FishShareItem(
                    relativePath: "pending-share-items/\(payloadId)/\(fileName)",
                    originalName: loaded.name,
                    sourceMimeType: loaded.mimeType
                ))
            } catch {
                omitted += 1
            }
        }

        let payload = FishSharePayload(id: payloadId, text: text, items: items, omittedCount: omitted)
        guard !payload.isEmpty else {
            await showFailure("That item cannot be shared to FISH yet.")
            return
        }
        do {
            try FishShareStore.write(payload)
            guard let url = URL(string: "fish://share") else { throw FishShareStoreError.invalidPath }
            guard let context = extensionContext, await context.open(url) else {
                await showFailure("Open FISH to finish sharing.")
                return
            }
            context.completeRequest(returningItems: nil)
        } catch {
            await showFailure("FISH could not prepare that item. Try again.")
        }
    }

    private func inputProviders() -> [NSItemProvider] {
        extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []
    }

    private func load(provider: NSItemProvider) async -> LoadedShare? {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            if let value = await loadItemText(provider, type: UTType.url.identifier) {
                return LoadedShare(text: value)
            }
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier),
           let value = await loadItemText(provider, type: UTType.text.identifier) {
            return LoadedShare(text: value)
        }

        let supportedTypes: [UTType] = [
            .image, .pdf, .plainText, .commaSeparatedText, .mpeg4Audio,
            UTType(filenameExtension: "docx"),
            UTType(filenameExtension: "xlsx"),
            UTType(filenameExtension: "pptx"),
        ].compactMap { $0 }
        guard let type = supportedTypes.first(where: {
            provider.hasItemConformingToTypeIdentifier($0.identifier)
        }), let data = await loadData(provider, type: type.identifier) else {
            return nil
        }
        return LoadedShare(
            data: data,
            name: provider.suggestedName ?? (type == .image ? "Photo" : "Shared file"),
            mimeType: type.preferredMIMEType ?? "application/octet-stream"
        )
    }

    private func loadItemText(_ provider: NSItemProvider, type: String) async -> String? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
                let value: String?
                if let string = item as? String {
                    value = string
                } else if let string = item as? NSString {
                    value = String(string)
                } else if let url = item as? URL {
                    value = url.absoluteString
                } else if let url = item as? NSURL {
                    value = url.absoluteString
                } else {
                    value = nil
                }
                continuation.resume(returning: value)
            }
        }
    }

    private func loadData(_ provider: NSItemProvider, type: String) async -> Data? {
        await withCheckedContinuation { continuation in
            provider.loadDataRepresentation(forTypeIdentifier: type) { data, _ in
                continuation.resume(returning: data)
            }
        }
    }

    @MainActor
    private func showFailure(_ message: String) async {
        activity.stopAnimating()
        statusLabel.text = message
        let close = UIButton(type: .system)
        close.setTitle("Close", for: .normal)
        close.addAction(UIAction { [weak self] _ in
            self?.extensionContext?.cancelRequest(withError: FishShareExtensionError.failed)
        }, for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(close)
        NSLayoutConstraint.activate([
            close.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            close.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 16),
        ])
    }
}

private struct LoadedShare {
    let text: String?
    let data: Data?
    let name: String
    let mimeType: String

    init(text: String) {
        self.text = text
        data = nil
        name = ""
        mimeType = "text/plain"
    }

    init(data: Data, name: String, mimeType: String) {
        text = nil
        self.data = data
        self.name = name
        self.mimeType = mimeType
    }
}

private enum FishShareExtensionError: Error {
    case failed
}
