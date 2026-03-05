import Foundation

enum FetchState {
    case idle
    case streaming([ProgressStep])
    case loaded(ConditionsResponse)
    case error(String)
}

struct ProgressStep: Identifiable {
    let id = UUID()
    let name: String
    var status: StepStatus
}

enum StepStatus {
    case loading, success, failed
}

/// Represents a custom (map-discovered) spot with coordinates
struct CustomSpotMeta: Codable {
    let id: String
    let name: String
    let lat: Double
    let lon: Double
    let country: String?
}

@MainActor
class ConditionsViewModel: ObservableObject {
    @Published var state: FetchState = .idle

    private let sseClient = SSEClient()
    private var currentSpotId: String?

    func load(spot: Spot) async {
        // Check if this is a custom/map spot
        if let meta = CustomSpotStore.shared.find(id: spot.id) {
            await loadCustomSpot(meta)
            return
        }

        currentSpotId = spot.id
        state = .streaming([])

        let url = await APIClient.shared.streamURL(for: spot.id)
        let spotId = spot.id

        await sseClient.start(
            url: url,
            onStart: { _ in },
            onProgress: { [weak self] event in
                Task { @MainActor [weak self] in
                    guard let self, self.currentSpotId == spotId,
                          case .streaming(var steps) = self.state else { return }
                    let done = event.status == "complete" || event.status == "success"
                    steps.append(ProgressStep(name: event.source, status: done ? .success : .failed))
                    self.state = .streaming(steps)
                }
            },
            onComplete: { [weak self] response in
                Task { @MainActor [weak self] in
                    guard let self, self.currentSpotId == spotId else { return }
                    self.state = .loaded(response)
                }
            },
            onError: { [weak self] _ in
                // SSE failed or spot has no stream endpoint — fall back to REST
                Task { @MainActor [weak self] in
                    guard let self, self.currentSpotId == spotId else { return }
                    await self.loadViaREST(spotId: spotId)
                }
            }
        )
    }

    func refresh(spot: Spot) async {
        await sseClient.stop()
        await load(spot: spot)
    }

    private func loadCustomSpot(_ meta: CustomSpotMeta) async {
        currentSpotId = meta.id
        state = .streaming([ProgressStep(name: "Fetching conditions…", status: .loading)])
        do {
            // Register spot on backend (fire-and-forget)
            Task {
                try? await APIClient.shared.createSpot(name: meta.name, lat: meta.lat, lon: meta.lon, country: meta.country)
            }
            let response = try await APIClient.shared.fetchConditionsByCoords(
                lat: meta.lat, lon: meta.lon, name: meta.name, country: meta.country
            )
            state = .loaded(response)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private func loadViaREST(spotId: String) async {
        do {
            let response = try await APIClient.shared.fetchConditions(spotId: spotId)
            state = .loaded(response)
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}

// MARK: - Custom Spot Persistence

class CustomSpotStore {
    static let shared = CustomSpotStore()
    private let key = "customSpots"
    private let maxStored = 20

    func all() -> [CustomSpotMeta] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([CustomSpotMeta].self, from: data)) ?? []
    }

    func find(id: String) -> CustomSpotMeta? {
        all().first { $0.id == id }
    }

    func save(_ meta: CustomSpotMeta) {
        var spots = all().filter { $0.id != meta.id }
        spots.insert(meta, at: 0)
        if spots.count > maxStored { spots = Array(spots.prefix(maxStored)) }
        if let data = try? JSONEncoder().encode(spots) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    func recent(limit: Int = 5) -> [CustomSpotMeta] {
        Array(all().prefix(limit))
    }
}
