import CallData
import CallMediaLiveKit
import Calls
import DesignSystem
import SwiftUI
import UIComponents

/// Development-only end-to-end lab: real `call-command` requests, real
/// PostgREST reads with polling wakeups, and a real LiveKit room — against
/// the local stack from `docs/realtime-calling-local-setup.md`. Appears only
/// when the lab keys were injected at `xcodegen generate` time (the KLIPY
/// pattern); the page itself signs in with the seeded dev account.
struct LiveCallLabConfiguration {
    let supabaseUrl: URL
    let anonKey: String
    let email: String
    let password: String
    let recipientId: String
    let recipientName: String

    static func fromBundle() -> LiveCallLabConfiguration? {
        func value(_ key: String) -> String? {
            let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed?.isEmpty == false ? trimmed : nil
        }
        guard
            let rawUrl = value("SupabaseUrl"),
            let url = URL(string: rawUrl),
            let anonKey = value("SupabaseAnonKey"),
            let email = value("SupabaseEmail"),
            let password = value("SupabasePassword"),
            let recipientId = value("SupabaseRecipientId")
        else { return nil }
        return LiveCallLabConfiguration(
            supabaseUrl: url,
            anonKey: anonKey,
            email: email,
            password: password,
            recipientId: recipientId,
            recipientName: value("SupabaseRecipientName") ?? "Your call partner"
        )
    }
}

@MainActor @Observable
final class LiveCallLab {
    enum Phase {
        case signingIn
        case ready
        case failed(String)
    }

    private(set) var phase: Phase = .signingIn
    private(set) var model: CallSessionModel?
    private(set) var media: LiveKitCallMedia?

    private let configuration: LiveCallLabConfiguration

    init(configuration: LiveCallLabConfiguration) {
        self.configuration = configuration
    }

    func start() async {
        guard model == nil else { return }
        do {
            let session = try await signIn()
            let backend = CallBackendConfiguration(
                supabaseUrl: configuration.supabaseUrl,
                anonKey: configuration.anonKey,
                accessToken: { session.accessToken }
            )
            let directory = RestCallDirectory(configuration: backend)
            let media = LiveKitCallMedia()
            let model = CallSessionModel(
                userId: session.userId,
                commands: EdgeFunctionCallCommands(configuration: backend),
                realtime: PollingCallRealtime(directory: directory),
                media: media
            )
            self.media = media
            self.model = model
            phase = .ready
            await model.start()
        } catch {
            phase = .failed(
                "Sign-in didn’t complete. Check the local stack and the lab keys."
            )
        }
    }

    func shutdown() {
        model?.shutdown()
    }

    var recipientId: String { configuration.recipientId }
    var recipientName: String { configuration.recipientName }
    var accountLabel: String { configuration.email }

    // MARK: - Dev sign-in (password grant against the local stack)

    private struct SessionResponse: Decodable {
        struct User: Decodable { let id: String }
        let accessToken: String
        let user: User
    }

    private struct Session {
        let accessToken: String
        let userId: String
    }

    private func signIn() async throws -> Session {
        var components = URLComponents(
            url: configuration.supabaseUrl.appending(path: "auth/v1/token"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        guard let url = components?.url else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONEncoder().encode([
            "email": configuration.email,
            "password": configuration.password,
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.userAuthenticationRequired)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let session = try decoder.decode(SessionResponse.self, from: data)
        return Session(accessToken: session.accessToken, userId: session.user.id)
    }
}

struct LiveCallLabPage: View {
    let configuration: LiveCallLabConfiguration
    @State private var lab: LiveCallLab?

    var body: some View {
        ZStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(Palette.bg)

            if let lab, let model = lab.model, let media = lab.media {
                CallOverlay(
                    model: model,
                    localVideo: { media.localVideoView() },
                    remoteVideo: { media.remoteVideoView() }
                )
            }
        }
        .navigationTitle("Live call lab")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let lab = lab ?? LiveCallLab(configuration: configuration)
            self.lab = lab
            await lab.start()
        }
        .onDisappear { lab?.shutdown() }
    }

    @ViewBuilder private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            switch lab?.phase {
            case .none, .signingIn:
                Text("Signing in to the local stack…")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
            case .failed(let message):
                Notice(tone: .notice, title: message)
            case .ready:
                if let lab, let model = lab.model {
                    Text("Signed in as \(lab.accountLabel). Calls ring here while this page is open; answer from a web browser signed in as the other account.")
                        .textStyle(.body)
                        .foregroundStyle(Palette.body)

                    HStack(spacing: Spacing.md) {
                        Text("Call \(lab.recipientName)")
                            .textStyle(.label)
                            .foregroundStyle(Palette.foreground)
                        Spacer()
                        CallEntryButtons(
                            recipientName: lab.recipientName,
                            busy: model.busy,
                            onStartCall: { kind in
                                Task {
                                    await model.startCall(
                                        recipientId: lab.recipientId,
                                        recipientName: lab.recipientName,
                                        kind: kind
                                    )
                                }
                            }
                        )
                    }
                    .padding(Spacing.md)
                    .background(
                        Palette.surface,
                        in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    )
                }
            }
        }
        .padding(Spacing.page)
    }
}
