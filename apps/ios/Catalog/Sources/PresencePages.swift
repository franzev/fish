import DesignSystem
import PersonalChat
import Presence
import PresenceData
import SwiftUI
import TestSupport
import UIComponents

/// Fixture-driven presence gallery: the indicator matrix, avatar badges,
/// last-seen tiers, the live-bound chat top bar, and the account sheet flow
/// running against a scripted repository so every state works offline.
struct PresencePage: View {
    private static let formatter = PresenceFormatter(
        locale: Locale(identifier: "en_US"),
        calendar: Calendar(identifier: .gregorian),
        timeZone: TimeZone(identifier: "UTC")!
    )
    private static let now = ISO8601DateFormatter().date(from: PresenceFixtures.nowIso)!

    @State private var model = PresenceModel(
        repository: ScriptedPresenceRepository(
            initial: PresenceState(
                currentUserId: PresenceFixtures.selfId,
                snapshots: [
                    PresenceFixtures.selfId: PresenceFixtures.snapshot(
                        userId: PresenceFixtures.selfId
                    ),
                    PresenceFixtures.coachId: PresenceFixtures.snapshot(
                        userId: PresenceFixtures.coachId
                    ),
                ],
                preferenceRevision: 1,
                connection: .connected
            )
        ),
        formatter: formatter
    )
    @State private var isSheetPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                section("Indicators") {
                    ForEach(PresenceDisplayStatus.allCases, id: \.self) { status in
                        HStack(spacing: Spacing.sm) {
                            PresenceIndicator(
                                status: status,
                                label: PresenceFormatter.label(for: status),
                                isDecorative: false
                            )
                            Text(PresenceFormatter.label(for: status))
                                .textStyle(.ui)
                                .foregroundStyle(Palette.body)
                        }
                    }
                }

                section("Avatars") {
                    HStack(spacing: Spacing.md) {
                        PresenceAvatar(
                            name: "Sam Rivera",
                            size: .sm,
                            status: .online,
                            statusLabel: "Online"
                        )
                        PresenceAvatar(
                            name: "Sam Rivera",
                            size: .md,
                            status: .busy,
                            statusLabel: "Do not disturb"
                        )
                        PresenceAvatar(
                            name: "Maya Chen",
                            size: .md,
                            status: .offline,
                            statusLabel: "Offline"
                        )
                    }
                }

                section("Last seen") {
                    ForEach(lastSeenSamples, id: \.0) { _, snapshot in
                        let presentation = Self.formatter.format(snapshot, now: Self.now)
                        PresenceSummary(
                            status: presentation.status,
                            label: presentation.label,
                            detail: presentation.detail
                        )
                    }
                }

                section("Chat top bar") {
                    PersonalChatTopBar(
                        participantName: PersonalChatFixtures.coachName,
                        presence: topBarPresence,
                        onBack: {},
                        accountContent: AnyView(
                            PresenceAccountTrigger(
                                displayName: "Maya Chen",
                                presentation: model.uiState.own,
                                action: { isSheetPresented = true }
                            )
                        )
                    )
                }

                section("Account and status") {
                    PresenceAccountTrigger(
                        displayName: "Maya Chen",
                        presentation: model.uiState.own,
                        action: { isSheetPresented = true }
                    )
                    Text("Tap the avatar to change status — the sheet runs the full drill-down against fixtures.")
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                }
            }
            .padding(Spacing.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.bg)
        .navigationTitle("Presence")
        .task { await model.start() }
        .sheet(isPresented: $isSheetPresented) {
            PresenceAccountSheet(
                model: model,
                displayName: "Maya Chen",
                onSignOut: { isSheetPresented = false }
            )
            .presentationDetents([.medium, .large])
        }
    }

    private var topBarPresence: PresenceUiModel {
        let presentation = model.uiState.presentationFor(PresenceFixtures.coachId)
        return PresenceUiModel(label: presentation.label, tone: presentation.status)
    }

    private var lastSeenSamples: [(String, PresenceSnapshot)] {
        [
            ("online", PresenceFixtures.snapshot(status: .online)),
            ("minutes", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: "2026-07-16T14:35:00Z"
            )),
            ("yesterday", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: "2026-07-15T09:00:00Z"
            )),
            ("date", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: "2026-07-05T12:00:00Z"
            )),
        ]
    }

    private func section(
        _ title: String,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .textStyle(.label)
                .foregroundStyle(Palette.foreground)
            content()
        }
    }
}

/// Development-only end-to-end lab: a real presence session against the
/// local stack — heartbeats, realtime, and status commands. Change status
/// from a web browser signed in as the same account and watch it land here.
@MainActor @Observable
final class LivePresenceLab {
    enum Phase {
        case signingIn
        case ready
        case signedOut
        case failed(String)
    }

    private(set) var phase: Phase = .signingIn
    private(set) var model: PresenceModel?

    private let configuration: LiveCallLabConfiguration
    private var session: PresenceLiveSession?
    private var repository: DefaultPresenceRepository?
    private var runner: Task<Void, Never>?

    init(configuration: LiveCallLabConfiguration) {
        self.configuration = configuration
    }

    func start() async {
        guard model == nil else { return }
        do {
            let session = try await PresenceLive.signIn(
                supabaseUrl: configuration.supabaseUrl,
                anonKey: configuration.anonKey,
                email: configuration.email,
                password: configuration.password
            )
            let repository = DefaultPresenceRepository(remote: session.remote)
            let model = PresenceModel(repository: repository)
            self.session = session
            self.repository = repository
            self.model = model
            runner = Task { await model.start() }
            await repository.setAuthenticatedUser(session.userId)
            await repository.setAppForegrounded(true)
            phase = .ready
        } catch {
            phase = .failed(
                "Sign-in didn't complete. Check the local stack and the lab keys."
            )
        }
    }

    func setForegrounded(_ foregrounded: Bool) {
        guard let repository else { return }
        Task { await repository.setAppForegrounded(foregrounded) }
    }

    func markActive() {
        guard let repository else { return }
        Task { await repository.markActive() }
    }

    func signOut() async {
        guard let repository, let session else { return }
        await repository.endSession()
        await repository.setAuthenticatedUser(nil)
        await PresenceLive.signOut(session)
        phase = .signedOut
    }

    func shutdown() {
        setForegrounded(false)
        runner?.cancel()
    }

    var accountLabel: String { configuration.email }
    var recipientId: String { configuration.recipientId }
    var recipientName: String { configuration.recipientName }
    var userId: String? { session?.userId }
}

struct LivePresenceLabPage: View {
    let configuration: LiveCallLabConfiguration
    @State private var lab: LivePresenceLab?
    @State private var isSheetPresented = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                content
            }
            .padding(Spacing.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.bg)
        .navigationTitle("Presence lab")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let lab = lab ?? LivePresenceLab(configuration: configuration)
            self.lab = lab
            await lab.start()
        }
        .onDisappear { lab?.shutdown() }
        .onChange(of: scenePhase) {
            lab?.setForegrounded(scenePhase != .background)
            if scenePhase == .active { lab?.markActive() }
        }
        .simultaneousGesture(
            TapGesture().onEnded { lab?.markActive() }
        )
        .sheet(isPresented: $isSheetPresented) {
            if let lab, let model = lab.model {
                PresenceAccountSheet(
                    model: model,
                    displayName: lab.accountLabel,
                    onSignOut: {
                        isSheetPresented = false
                        Task { await lab.signOut() }
                    }
                )
                .presentationDetents([.medium, .large])
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch lab?.phase {
        case .none, .signingIn:
            Text("Signing in to the local stack…")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
        case .failed(let message):
            Notice(tone: .notice, title: message)
        case .signedOut:
            Text("Signed out. Reopen this page to start a new session.")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
        case .ready:
            if let lab, let model = lab.model {
                Text("Signed in as \(lab.accountLabel). Your status is live while this page is open — flip your status from a web session and watch both sides move.")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)

                PersonalChatTopBar(
                    participantName: lab.recipientName,
                    presence: participantPresence(model),
                    accountContent: AnyView(
                        PresenceAccountTrigger(
                            displayName: lab.accountLabel,
                            presentation: model.uiState.own,
                            action: { isSheetPresented = true }
                        )
                    )
                )

                visibleSubjects(model)
            }
        }
    }

    private func participantPresence(_ model: PresenceModel) -> PresenceUiModel {
        let presentation = model.uiState.presentationFor(lab?.recipientId)
        return PresenceUiModel(label: presentation.label, tone: presentation.status)
    }

    @ViewBuilder private func visibleSubjects(_ model: PresenceModel) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Visible presence")
                .textStyle(.label)
                .foregroundStyle(Palette.foreground)
            ForEach(
                model.uiState.subjects.keys.sorted(),
                id: \.self
            ) { subjectId in
                let presentation = model.uiState.presentationFor(subjectId)
                HStack(spacing: Spacing.sm) {
                    Text(subjectName(subjectId))
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                    Spacer(minLength: Spacing.sm)
                    PresenceSummary(
                        status: presentation.status,
                        label: presentation.label,
                        detail: presentation.detail
                    )
                }
                .padding(Spacing.xs)
                .background(
                    Palette.surface,
                    in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
            }
        }
    }

    private func subjectName(_ subjectId: String) -> String {
        if subjectId == lab?.userId { return "You" }
        if subjectId == lab?.recipientId { return lab?.recipientName ?? subjectId }
        return String(subjectId.prefix(8))
    }
}
