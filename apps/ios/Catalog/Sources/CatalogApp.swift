import DesignSystem
import SwiftUI

@main
struct CatalogApp: App {
    init() {
        Fonts.register()
    }

    var body: some Scene {
        WindowGroup {
            CatalogRoot()
        }
    }
}

/// Development-only review tool. Its catalog menu is intentionally exempt
/// from the client product's "remove choices" rule because this target never
/// ships to users.
struct CatalogRoot: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Components") {
                    NavigationLink("Buttons") { ButtonsPage() }
                    NavigationLink("Icon buttons") { IconButtonsPage() }
                    NavigationLink("Text fields") { TextFieldsPage() }
                    NavigationLink("Avatars") { AvatarsPage() }
                    NavigationLink("Notices") { NoticesPage() }
                    NavigationLink("Loading") { LoadingPage() }
                    NavigationLink("Empty states") { EmptyStatesPage() }
                    NavigationLink("Top bars") { TopBarsPage() }
                }
                Section("Personal chat") {
                    NavigationLink("Chat states") { ChatStatesPage() }
                    NavigationLink("Media picker") { MediaPickerPage() }
                }
            }
            .navigationTitle("FISH catalog")
        }
    }
}
