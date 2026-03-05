import SwiftUI

struct ContentView: View {
    @StateObject private var pushManager = PushManager.shared
    @State private var selectedSpot: Spot?
    @State private var showSpotPicker = false
    @State private var showMap = false
    @State private var isAutoDetecting = true

    private let lastSpotKey = "last_selected_spot_id"
    private let lastSpotNameKey = "last_selected_spot_name"

    var body: some View {
        NavigationStack {
            if let spot = selectedSpot {
                ConditionsView(spot: spot, pushManager: pushManager)
                    .id(spot.id)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                showSpotPicker = true
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: "mappin.and.ellipse")
                                    Text(spot.name).lineLimit(1)
                                }
                                .font(.subheadline.weight(.semibold))
                            }
                        }
                    }
            } else if isAutoDetecting {
                detectingView
            } else {
                splashView
            }
        }
        .sheet(isPresented: $showSpotPicker) {
            SpotPickerView { spot in
                select(spot)
                showSpotPicker = false
            }
        }
        .fullScreenCover(isPresented: $showMap) {
            SpotMapView { mapSpot in
                let id = mapSpot.name.lowercased()
                    .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
                let meta = CustomSpotMeta(id: id, name: mapSpot.name,
                                          lat: mapSpot.lat, lon: mapSpot.lon,
                                          country: mapSpot.country.isEmpty ? nil : mapSpot.country)
                CustomSpotStore.shared.save(meta)
                let spot = Spot(id: id, name: mapSpot.name,
                                country: mapSpot.country,
                                region: mapSpot.region.isEmpty ? nil : mapSpot.region,
                                location: SpotLocation(lat: mapSpot.lat, lon: mapSpot.lon),
                                description: nil)
                select(spot)
            }
        }
        .onAppear {
            if loadLastSpot() {
                isAutoDetecting = false
            } else {
                Task { await autoDetect() }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .pushNotificationTapped)) { note in
            handlePushTap(note.userInfo)
        }
    }

    // MARK: - Auto-detecting view (first launch)

    private var detectingView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "water.waves")
                .font(.system(size: 72))
                .foregroundStyle(.blue)
                .symbolEffect(.variableColor.cumulative)
            VStack(spacing: 10) {
                Text("Should I Go?")
                    .font(.largeTitle.bold())
                ProgressView()
                    .tint(.secondary)
                    .padding(.top, 4)
                Text("Finding your nearest spot…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Choose a spot manually") {
                isAutoDetecting = false
                showSpotPicker = true
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Splash (fallback when auto-detect fails)

    private var splashView: some View {
        VStack(spacing: 32) {
            Spacer()
            Image(systemName: "water.waves")
                .font(.system(size: 72))
                .foregroundStyle(.blue)
                .symbolEffect(.variableColor.cumulative)
            VStack(spacing: 8) {
                Text("Should I Go?")
                    .font(.largeTitle.bold())
                Text("Real-time surf conditions for any beach.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Button {
                showSpotPicker = true
            } label: {
                Label("Find a Spot", systemImage: "magnifyingglass")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(.blue)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(.horizontal, 40)

            Button {
                showMap = true
            } label: {
                Label("Browse Map", systemImage: "map")
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(.blue)
            .padding(.top, 4)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Auto-detect via IP geolocation (same as web)

    private func autoDetect() async {
        do {
            let response = try await APIClient.shared.fetchNearestSpot()
            if let id = response.nearestSpot, let name = response.nearestSpotName {
                let spot = Spot(id: id, name: name,
                                country: response.location?.country ?? "",
                                region: nil, location: nil, description: nil)
                select(spot)
            }
        } catch {}
        isAutoDetecting = false
    }

    // MARK: - Persistence

    @discardableResult
    private func loadLastSpot() -> Bool {
        guard let id = UserDefaults.standard.string(forKey: lastSpotKey),
              let name = UserDefaults.standard.string(forKey: lastSpotNameKey) else { return false }
        selectedSpot = Spot(id: id, name: name, country: "", region: nil, location: nil, description: nil)
        return true
    }

    private func select(_ spot: Spot) {
        selectedSpot = spot
        UserDefaults.standard.set(spot.id, forKey: lastSpotKey)
        UserDefaults.standard.set(spot.name, forKey: lastSpotNameKey)
    }

    // MARK: - Push tap

    private func handlePushTap(_ userInfo: [AnyHashable: Any]?) {
        guard let url = userInfo?["url"] as? String,
              url.hasPrefix("/?spot=") else { return }
        let spotId = String(url.dropFirst(7))
        if selectedSpot?.id == spotId { return }
        selectedSpot = Spot(id: spotId, name: spotId, country: "", region: nil, location: nil, description: nil)
    }
}
