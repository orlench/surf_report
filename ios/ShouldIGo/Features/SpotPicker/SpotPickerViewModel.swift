import Foundation

@MainActor
class SpotPickerViewModel: ObservableObject {
    @Published var spots: [Spot] = []
    @Published var nearbySpots: [Spot] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var error: String?
    @Published var isDetectingLocation = false

    private let locationHelper = LocationHelper()

    var filteredSpots: [Spot] {
        if searchText.isEmpty { return spots }
        let q = searchText.lowercased()
        return spots.filter {
            $0.name.lowercased().contains(q) ||
            $0.country.lowercased().contains(q) ||
            ($0.region?.lowercased().contains(q) ?? false)
        }
    }

    var groupedSpots: [(country: String, spots: [Spot])] {
        let byCountry = Dictionary(grouping: filteredSpots, by: \.country)
        return byCountry
            .sorted { $0.key < $1.key }
            .map { (country: $0.key, spots: $0.value.sorted { $0.name < $1.name }) }
    }

    func load() async {
        isLoading = true
        error = nil
        do {
            async let spotsTask = APIClient.shared.fetchSpots()
            let coordinate = await locationHelper.requestCurrentLocation()
            async let nearbyTask = APIClient.shared.fetchNearestSpot(
                lat: coordinate?.latitude,
                lon: coordinate?.longitude
            )

            spots = try await spotsTask

            let nearestResponse = try await nearbyTask
            if let nearby = nearestResponse.nearbySpots {
                nearbySpots = nearby.map { ns in
                    Spot(id: ns.id, name: ns.name, country: ns.country,
                         region: nil, location: nil, description: nil)
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func detectNearestSpot() async -> Spot? {
        isDetectingLocation = true
        defer { isDetectingLocation = false }
        do {
            let coordinate = await locationHelper.requestCurrentLocation()
            let response = try await APIClient.shared.fetchNearestSpot(
                lat: coordinate?.latitude,
                lon: coordinate?.longitude
            )
            if let id = response.nearestSpot, let name = response.nearestSpotName {
                return Spot(id: id, name: name,
                            country: response.location?.country ?? "",
                            region: nil, location: nil, description: nil)
            }
        } catch {}
        return nil
    }
}
