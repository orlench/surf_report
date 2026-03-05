import Foundation

// MARK: - Spots

struct SpotListResponse: Codable {
    let success: Bool
    let count: Int
    let spots: [Spot]
}

struct Spot: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let country: String
    let region: String?
    let location: SpotLocation?
    let description: String?

    var lat: Double { location?.lat ?? 0 }
    var lon: Double { location?.lon ?? 0 }
}

struct SpotLocation: Codable, Hashable {
    let lat: Double
    let lon: Double
}

// MARK: - Nearest Spot

struct NearestSpotResponse: Codable {
    let success: Bool
    let detected: Bool
    let location: DetectedLocation?
    let nearestSpot: String?
    let nearestSpotName: String?
    let distance: Double?
    let nearbySpots: [NearbySpot]?
}

struct DetectedLocation: Codable {
    let city: String?
    let country: String?
}

struct NearbySpot: Codable {
    let id: String
    let name: String
    let country: String
    let distance: Double?
}

// MARK: - Conditions

struct ConditionsResponse: Codable {
    let spotId: String
    let spotName: String
    let timestamp: String
    let score: SurfScore
    let conditions: SurfConditions
    let trend: SurfTrend?
    let boardRecommendation: BoardRecommendation?
    let sources: [DataSource]?
    let fromCache: Bool?
    let cacheAge: Int?
}

struct SurfScore: Codable {
    let overall: Int
    let rating: String
    let explanation: String?
    let breakdown: ScoreBreakdown?
}

struct ScoreBreakdown: Codable {
    let waveHeight: Int
    let wavePeriod: Int
    let swellQuality: Int
    let windSpeed: Int
    let windDirection: Int
    let waveDirection: Int
}

struct SurfConditions: Codable {
    let waves: WaveConditions?
    let wind: WindConditions?
    let weather: WeatherConditions?
    let tide: TideConditions?
}

struct WaveConditions: Codable {
    let height: WaveHeight?
    let period: Double?
    let direction: String?
    let swell: SwellConditions?
}

struct WaveHeight: Codable {
    let min: Double?
    let max: Double?
    let avg: Double?
}

struct SwellConditions: Codable {
    let height: Double?
    let period: Double?
    let direction: String?
}

struct WindConditions: Codable {
    let speed: Double?
    let direction: String?
    let gusts: Double?
}

struct WeatherConditions: Codable {
    let airTemp: Double?
    let waterTemp: Double?
    let cloudCover: Double?
}

struct TideConditions: Codable {
    let current: String?
    let height: Double?
}

// MARK: - Trend / Forecast

struct SurfTrend: Codable {
    let trend: String?       // "improving" | "declining" | "stable"
    let summary: String?
    let message: String?
    let bestWindow: BestWindow?
    let blocks: [ForecastBlock]?
}

struct BestWindow: Codable {
    let label: String
    let score: Int
    let rating: String
}

struct ForecastBlock: Codable, Identifiable {
    var id: String { label }
    let label: String
    let score: Int
    let rating: String
    let ratingGrade: String?
    let conditions: SurfConditions?
}

// MARK: - Board

struct BoardRecommendation: Codable {
    let boardType: String
    let boardName: String?
    let reason: String?
}

// MARK: - Sources

struct DataSource: Codable {
    let name: String
    let status: String
    let timestamp: String?
    let url: String?
}

// MARK: - SSE Progress

struct SSEStartEvent: Codable {
    let spotId: String
    let spotName: String
}

struct SSEProgressEvent: Codable {
    let source: String
    let status: String
    let timestamp: String?
}

// MARK: - Push

struct PushSubscribeRequest: Encodable {
    let type: String          // "apns"
    let token: String
    let spotId: String
    let threshold: Int
}

struct PushSubscribeResponse: Codable {
    let success: Bool
    let id: String?
    let count: Int?
    let error: String?
}

struct PushUnsubscribeRequest: Encodable {
    let token: String
    let spotId: String
    let type: String
}

// MARK: - Feedback

struct FeedbackRequest: Encodable {
    let text: String
}

struct FeedbackResponse: Codable {
    let success: Bool
    let multipliers: [String: Double]?
    let yourMultipliers: [String: Double]?
    let feedbackCount: Int?
}

struct FeedbackListResponse: Codable {
    let feedbackCount: Int
    let recentFeedback: [RecentFeedback]?
}

struct RecentFeedback: Codable {
    let text: String
}

// MARK: - Rating helpers

extension String {
    /// Map rating string to a display color name
    var ratingColor: String {
        switch self {
        case "EPIC":  return "ratingEpic"
        case "GREAT": return "ratingGreat"
        case "GOOD":  return "ratingGood"
        case "FAIR":  return "ratingFair"
        case "POOR":  return "ratingPoor"
        default:      return "ratingFlat"
        }
    }

    var ratingEmoji: String {
        switch self {
        case "EPIC":  return "🔥"
        case "GREAT": return "🤙"
        case "GOOD":  return "👍"
        case "FAIR":  return "😐"
        case "POOR":  return "👎"
        default:      return "🏠"
        }
    }
}

extension Int {
    var surfVerdict: String {
        switch self {
        case 85...: return "Absolutely!"
        case 75..<85: return "Get out there!"
        case 65..<75: return "Yes, go!"
        case 50..<65: return "Maybe..."
        case 35..<50: return "Probably not"
        case 20..<35: return "Not worth it"
        default: return "Stay home"
        }
    }
}
