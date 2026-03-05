import SwiftUI

struct NotificationSheet: View {
    let spot: Spot
    @ObservedObject var pushManager: PushManager
    @Binding var isPresented: Bool

    @State private var selectedThreshold = 65
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isSubscribed = false

    private let thresholds = [
        (50, "Fair or better", "Any wave is better than no wave"),
        (65, "Good or better", "Recommended — solid sessions"),
        (75, "Great or better", "Worth rescheduling your day"),
        (85, "Epic only", "Rare, but unforgettable")
    ]

    private let subscriptionsKey = "push_subscriptions"

    var body: some View {
        NavigationStack {
            ZStack {
                Color("background").ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Header
                        VStack(spacing: 8) {
                            Image(systemName: "bell.badge.waveform.fill")
                                .font(.system(size: 40))
                                .foregroundStyle(.blue)
                            Text("Surf Alerts")
                                .font(.title2.bold())
                                .foregroundStyle(.primary)
                            Text("Get notified when \(spot.name) reaches your target score.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 8)

                        // Permission warning
                        if pushManager.authorizationStatus == .denied {
                            Label("Notifications are disabled. Enable them in Settings.", systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                                .padding(12)
                                .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                        }

                        // Threshold picker
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Alert me when the score reaches:")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 4)

                            VStack(spacing: 0) {
                                ForEach(thresholds, id: \.0) { threshold, title, subtitle in
                                    Button {
                                        selectedThreshold = threshold
                                    } label: {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                                                Text(subtitle).font(.caption).foregroundStyle(.secondary)
                                            }
                                            Spacer()
                                            if selectedThreshold == threshold {
                                                Image(systemName: "checkmark.circle.fill").foregroundStyle(.blue)
                                            } else {
                                                Image(systemName: "circle").foregroundStyle(.tertiary)
                                            }
                                        }
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    if threshold != thresholds.last?.0 {
                                        Divider().padding(.leading, 16)
                                    }
                                }
                            }
                            .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 14))
                        }

                        // Error
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .padding(12)
                                .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                        }

                        // Subscribe / Unsubscribe button
                        Button {
                            Task { await handleToggle() }
                        } label: {
                            HStack {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Image(systemName: isSubscribed ? "bell.slash.fill" : "bell.fill")
                                    Text(isSubscribed ? "Remove Alert" : "Enable Alert")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isSubscribed ? Color.red.opacity(0.8) : Color.blue)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .disabled(isLoading || pushManager.authorizationStatus == .denied)

                        Text("You can receive alerts for up to 2 spots. Alerts are sent at most once every 6 hours.")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(20)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { isPresented = false }
                }
            }
        }
        .onAppear { checkExistingSubscription() }
    }

    // MARK: - Logic

    private func checkExistingSubscription() {
        let subs = loadSubscriptions()
        isSubscribed = subs.contains { $0.spotId == spot.id }
        if let sub = subs.first(where: { $0.spotId == spot.id }) {
            selectedThreshold = sub.threshold
        }
    }

    private func handleToggle() async {
        if pushManager.deviceToken == nil {
            // Request permission and wait for APNs token
            let granted = await pushManager.requestPermissionAndRegister()
            if !granted {
                errorMessage = "Please enable notifications in Settings to receive surf alerts."
                return
            }
            try? await Task.sleep(for: .seconds(1))
        }

        guard let token = pushManager.deviceToken else {
            errorMessage = "Failed to register for notifications. Try again."
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            if isSubscribed {
                try await APIClient.shared.unsubscribePush(token: token, spotId: spot.id)
                removeSubscription(spotId: spot.id)
                isSubscribed = false
            } else {
                let response = try await APIClient.shared.subscribePush(
                    token: token,
                    spotId: spot.id,
                    threshold: selectedThreshold
                )
                if response.success == true {
                    saveSubscription(spotId: spot.id, spotName: spot.name, threshold: selectedThreshold)
                    isSubscribed = true
                } else {
                    errorMessage = response.error ?? "Failed to subscribe"
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Persistence

    struct StoredSubscription: Codable {
        let spotId: String
        let spotName: String
        var threshold: Int
    }

    private func loadSubscriptions() -> [StoredSubscription] {
        guard let data = UserDefaults.standard.data(forKey: subscriptionsKey),
              let subs = try? JSONDecoder().decode([StoredSubscription].self, from: data) else { return [] }
        return subs
    }

    private func saveSubscription(spotId: String, spotName: String, threshold: Int) {
        var subs = loadSubscriptions().filter { $0.spotId != spotId }
        subs.append(StoredSubscription(spotId: spotId, spotName: spotName, threshold: threshold))
        if let data = try? JSONEncoder().encode(subs) {
            UserDefaults.standard.set(data, forKey: subscriptionsKey)
        }
    }

    private func removeSubscription(spotId: String) {
        let subs = loadSubscriptions().filter { $0.spotId != spotId }
        if let data = try? JSONEncoder().encode(subs) {
            UserDefaults.standard.set(data, forKey: subscriptionsKey)
        }
    }
}
