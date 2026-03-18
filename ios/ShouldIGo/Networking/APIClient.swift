import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case decodingError(Error)
    case serverError(Int, String?)
    case noData

    var errorDescription: String? {
        switch self {
        case .invalidURL:              return "Invalid URL"
        case .networkError(let e):     return e.localizedDescription
        case .decodingError(let e):    return "Data format error: \(e.localizedDescription)"
        case .serverError(let c, let m): return m ?? "Server error \(c)"
        case .noData:                  return "No data received"
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private let baseURL = "https://api.shouldigo.surf/api"
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        session = URLSession(configuration: config)
    }

    // MARK: - Generic fetch

    private func fetch<T: Decodable>(_ path: String, queryItems: [URLQueryItem] = []) async throws -> T {
        var components = URLComponents(string: baseURL + path)!
        if !queryItems.isEmpty { components.queryItems = queryItems }
        guard let url = components.url else { throw APIError.invalidURL }

        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw APIError.noData }

        if !(200..<300).contains(http.statusCode) {
            let message = try? JSONDecoder().decode([String: String].self, from: data)["error"]
            throw APIError.serverError(http.statusCode, message)
        }

        do {
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.noData }

        if !(200..<300).contains(http.statusCode) {
            let message = try? JSONDecoder().decode([String: String].self, from: data)["error"]
            throw APIError.serverError(http.statusCode, message)
        }

        do {
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Spots

    func fetchSpots() async throws -> [Spot] {
        let response: SpotListResponse = try await fetch("/spots")
        return response.spots
    }

    func fetchNearestSpot(lat: Double? = nil, lon: Double? = nil) async throws -> NearestSpotResponse {
        var items: [URLQueryItem] = []
        if let lat {
            items.append(URLQueryItem(name: "lat", value: String(lat)))
        }
        if let lon {
            items.append(URLQueryItem(name: "lon", value: String(lon)))
        }
        return try await fetch("/nearest-spot", queryItems: items)
    }

    // MARK: - Conditions

    func fetchConditions(spotId: String, weight: String? = nil, skill: String? = nil) async throws -> ConditionsResponse {
        var items: [URLQueryItem] = []
        if let weight, !weight.isEmpty { items.append(URLQueryItem(name: "weight", value: weight)) }
        if let skill, !skill.isEmpty { items.append(URLQueryItem(name: "skill", value: skill)) }
        return try await fetch("/conditions/\(spotId)", queryItems: items)
    }

    func fetchConditionsByCoords(
        lat: Double,
        lon: Double,
        name: String,
        country: String? = nil,
        weight: String? = nil,
        skill: String? = nil
    ) async throws -> ConditionsResponse {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lon", value: String(lon)),
            URLQueryItem(name: "name", value: name),
        ]
        if let country, !country.isEmpty {
            items.append(URLQueryItem(name: "country", value: country))
        }
        if let weight, !weight.isEmpty {
            items.append(URLQueryItem(name: "weight", value: weight))
        }
        if let skill, !skill.isEmpty {
            items.append(URLQueryItem(name: "skill", value: skill))
        }
        return try await fetch("/conditions/custom", queryItems: items)
    }

    // MARK: - Create spot (for map-discovered spots)

    func createSpot(name: String, lat: Double, lon: Double, country: String?) async throws {
        struct Body: Encodable { let name: String; let lat: Double; let lon: Double; let country: String? }
        struct R: Codable { let success: Bool }
        let _: R = try await post("/spots", body: Body(name: name, lat: lat, lon: lon, country: country))
    }

    // MARK: - Push

    func subscribePush(token: String, spotId: String, threshold: Int) async throws -> PushSubscribeResponse {
        let body = PushSubscribeRequest(type: "apns", token: token, spotId: spotId, threshold: threshold)
        return try await post("/push/subscribe", body: body)
    }

    func unsubscribePush(token: String, spotId: String) async throws {
        struct R: Codable { let success: Bool }
        let body = PushUnsubscribeRequest(token: token, spotId: spotId, type: "apns")
        let _: R = try await post("/push/unsubscribe", body: body)
    }

    // MARK: - Feedback

    func submitFeedback(spotId: String, text: String) async throws -> FeedbackResponse {
        let body = FeedbackRequest(text: text)
        return try await post("/spots/\(spotId)/feedback", body: body)
    }

    func fetchFeedback(spotId: String) async throws -> FeedbackListResponse {
        return try await fetch("/spots/\(spotId)/feedback")
    }

    // MARK: - SSE stream URL

    func streamURL(for spotId: String) -> URL {
        URL(string: baseURL + "/conditions/\(spotId)/stream")!
    }
}
