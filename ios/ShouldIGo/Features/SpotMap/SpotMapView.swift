import SwiftUI
import MapKit
import CoreLocation

// MARK: - Local spot model (from bundled JSON)

struct MapSpot: Codable, Identifiable, Hashable {
    var id: String { "\(name)-\(lat)-\(lon)" }
    let name: String
    let lat: Double
    let lon: Double
    let country: String
    let region: String

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}

// MARK: - Spot data loader

@MainActor
class SpotMapViewModel: ObservableObject {
    @Published var allSpots: [MapSpot] = []
    @Published var searchText = ""
    @Published var selectedSpot: MapSpot?

    var searchResults: [MapSpot] {
        guard searchText.count >= 2 else { return [] }
        let q = searchText.lowercased()
        return allSpots.filter {
            $0.name.lowercased().contains(q) ||
            $0.country.lowercased().contains(q) ||
            $0.region.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    func load() {
        guard allSpots.isEmpty else { return }
        guard let url = Bundle.main.url(forResource: "surfSpots", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return }
        struct Wrapper: Codable { let spots: [MapSpot] }
        if let wrapper = try? JSONDecoder().decode(Wrapper.self, from: data) {
            allSpots = wrapper.spots
        }
    }
}

// MARK: - Map View

struct SpotMapView: View {
    let onSelect: (MapSpot) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = SpotMapViewModel()
    @StateObject private var locationManager = LocationHelper()
    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var visibleRegion: MKCoordinateRegion?
    @State private var showSearch = true

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                mapContent

                // Search overlay
                VStack(spacing: 0) {
                    searchBar
                    if !vm.searchResults.isEmpty && showSearch {
                        searchResultsList
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                // Selected spot bottom sheet
                if let spot = vm.selectedSpot {
                    VStack {
                        Spacer()
                        selectedSpotSheet(spot)
                    }
                }
            }
            .navigationTitle("Find a Spot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        locationManager.requestLocation()
                        if let loc = locationManager.location {
                            cameraPosition = .region(MKCoordinateRegion(
                                center: loc, latitudinalMeters: 50_000, longitudinalMeters: 50_000
                            ))
                        }
                    } label: {
                        Image(systemName: "location.fill")
                    }
                }
            }
            .onAppear {
                vm.load()
                locationManager.requestLocation()
                if let loc = locationManager.location {
                    cameraPosition = .region(MKCoordinateRegion(
                        center: loc, latitudinalMeters: 50_000, longitudinalMeters: 50_000
                    ))
                }
            }
        }
    }

    // MARK: - Map

    private var mapContent: some View {
        Map(position: $cameraPosition) {
            // Show visible spots as annotations
            ForEach(visibleSpots) { spot in
                Annotation("", coordinate: spot.coordinate) {
                    Button {
                        vm.selectedSpot = spot
                        showSearch = false
                    } label: {
                        SpotPin(isSelected: vm.selectedSpot?.id == spot.id)
                    }
                }
            }

            // User location
            UserAnnotation()
        }
        .mapStyle(.standard)
        .onMapCameraChange(frequency: .onEnd) { context in
            visibleRegion = context.region
        }
    }

    // Only render spots visible in the current map region (max 200 for perf)
    private var visibleSpots: [MapSpot] {
        guard let region = visibleRegion else {
            return Array(vm.allSpots.prefix(100))
        }
        let latDelta = region.span.latitudeDelta / 2
        let lonDelta = region.span.longitudeDelta / 2
        let minLat = region.center.latitude - latDelta
        let maxLat = region.center.latitude + latDelta
        let minLon = region.center.longitude - lonDelta
        let maxLon = region.center.longitude + lonDelta

        return vm.allSpots.filter {
            $0.lat >= minLat && $0.lat <= maxLat &&
            $0.lon >= minLon && $0.lon <= maxLon
        }.prefix(200).map { $0 }
    }

    // MARK: - Search

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .font(.subheadline)
            TextField("Search surf spots…", text: $vm.searchText)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .onTapGesture { showSearch = true }
            if !vm.searchText.isEmpty {
                Button {
                    vm.searchText = ""
                    showSearch = false
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
            }
        }
        .padding(10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private var searchResultsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(vm.searchResults) { spot in
                    Button {
                        vm.selectedSpot = spot
                        vm.searchText = ""
                        showSearch = false
                        cameraPosition = .region(MKCoordinateRegion(
                            center: spot.coordinate,
                            latitudinalMeters: 5_000, longitudinalMeters: 5_000
                        ))
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(spot.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                            Text([spot.region, spot.country].filter { !$0.isEmpty }.joined(separator: ", "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                    }
                    Divider().padding(.leading, 12)
                }
            }
        }
        .frame(maxHeight: 260)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Selected Spot Sheet

    private func selectedSpotSheet(_ spot: MapSpot) -> some View {
        VStack(spacing: 12) {
            Capsule()
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 36, height: 4)

            Text(spot.name)
                .font(.headline)

            Text([spot.region, spot.country].filter { !$0.isEmpty }.joined(separator: ", "))
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(String(format: "%.4f, %.4f", spot.lat, spot.lon))
                .font(.caption)
                .foregroundStyle(.tertiary)
                .monospaced()

            Button {
                onSelect(spot)
                dismiss()
            } label: {
                Text("Check conditions")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(.blue, in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(.white)
            }
        }
        .padding(20)
        .padding(.bottom, 8)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }
}

// MARK: - Pin

struct SpotPin: View {
    var isSelected: Bool = false

    var body: some View {
        Circle()
            .fill(Color.blue)
            .frame(width: isSelected ? 16 : 10, height: isSelected ? 16 : 10)
            .overlay(Circle().stroke(.white, lineWidth: 2))
            .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
    }
}

// MARK: - Location Helper

class LocationHelper: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var location: CLLocationCoordinate2D?
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestLocation() {
        manager.requestWhenInUseAuthorization()
        manager.requestLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        location = locations.first?.coordinate
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
