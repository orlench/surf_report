import SwiftUI

struct SpotPickerView: View {
    let onSelect: (Spot) -> Void

    @StateObject private var vm = SpotPickerViewModel()
    @State private var showMap = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Pinned search bar
                searchBar
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color("background"))

                Divider()

                if vm.isLoading && vm.spots.isEmpty {
                    Spacer()
                    ProgressView("Loading spots…").tint(.blue)
                    Spacer()
                } else if let error = vm.error {
                    Spacer()
                    ContentUnavailableView {
                        Label("Failed to load spots", systemImage: "wifi.slash")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .buttonStyle(.borderedProminent)
                    }
                    Spacer()
                } else {
                    spotList
                }
            }
            .navigationTitle("Find a Spot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showMap = true
                    } label: {
                        Image(systemName: "map")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            if let spot = await vm.detectNearestSpot() {
                                onSelect(spot)
                            }
                        }
                    } label: {
                        if vm.isDetectingLocation {
                            ProgressView().tint(.blue)
                        } else {
                            Image(systemName: "location.fill")
                        }
                    }
                    .disabled(vm.isDetectingLocation)
                }
            }
            .fullScreenCover(isPresented: $showMap) {
                SpotMapView { mapSpot in
                    // Save as custom spot
                    let id = slugify(mapSpot.name)
                    let meta = CustomSpotMeta(id: id, name: mapSpot.name,
                                              lat: mapSpot.lat, lon: mapSpot.lon,
                                              country: mapSpot.country.isEmpty ? nil : mapSpot.country)
                    CustomSpotStore.shared.save(meta)

                    let spot = Spot(id: id, name: mapSpot.name,
                                    country: mapSpot.country,
                                    region: mapSpot.region.isEmpty ? nil : mapSpot.region,
                                    location: SpotLocation(lat: mapSpot.lat, lon: mapSpot.lon),
                                    description: nil)
                    onSelect(spot)
                }
            }
        }
        .task { await vm.load() }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .font(.subheadline)
            TextField("Search beach or country…", text: $vm.searchText)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !vm.searchText.isEmpty {
                Button { vm.searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
            }
        }
        .padding(10)
        .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 10))
    }

    private var spotList: some View {
        List {
            // Nearby spots section
            if vm.searchText.isEmpty && !vm.nearbySpots.isEmpty {
                Section("Near you") {
                    ForEach(vm.nearbySpots) { spot in
                        Button { onSelect(spot) } label: {
                            SpotRow(spot: spot)
                        }
                        .listRowBackground(Color("cardBackground"))
                    }
                }
            }

            // Recent custom spots
            if vm.searchText.isEmpty {
                let recentCustom = CustomSpotStore.shared.recent()
                if !recentCustom.isEmpty {
                    Section("Recent") {
                        ForEach(recentCustom, id: \.id) { meta in
                            Button {
                                let spot = Spot(id: meta.id, name: meta.name,
                                                country: meta.country ?? "",
                                                region: nil,
                                                location: SpotLocation(lat: meta.lat, lon: meta.lon),
                                                description: nil)
                                onSelect(spot)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(meta.name)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.primary)
                                        if let country = meta.country, !country.isEmpty {
                                            Text(country)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: "mappin.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.blue)
                                }
                                .padding(.vertical, 2)
                            }
                            .listRowBackground(Color("cardBackground"))
                        }
                    }
                }
            }

            // All spots grouped by country
            ForEach(vm.groupedSpots, id: \.country) { group in
                Section(group.country) {
                    ForEach(group.spots) { spot in
                        Button {
                            onSelect(spot)
                        } label: {
                            SpotRow(spot: spot)
                        }
                        .listRowBackground(Color("cardBackground"))
                    }
                }
            }

            // "Find on map" if search has no results
            if !vm.searchText.isEmpty && vm.groupedSpots.isEmpty {
                Section {
                    Button {
                        showMap = true
                    } label: {
                        Label("Find \"\(vm.searchText)\" on map", systemImage: "map")
                            .foregroundStyle(.blue)
                    }
                    .listRowBackground(Color("cardBackground"))
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }
}

struct SpotRow: View {
    let spot: Spot

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(spot.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                if let region = spot.region, !region.isEmpty {
                    Text(region)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

private func slugify(_ name: String) -> String {
    name.lowercased()
        .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
}
