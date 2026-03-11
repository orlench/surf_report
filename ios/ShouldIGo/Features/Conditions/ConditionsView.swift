import SwiftUI

struct ConditionsView: View {
    let spot: Spot
    @StateObject private var vm = ConditionsViewModel()
    @ObservedObject var pushManager: PushManager
    @State private var showNotificationSheet = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color("background").ignoresSafeArea()

            switch vm.state {
            case .idle:
                Color.clear

            case .streaming(let steps):
                FetchProgressView(steps: steps, spotName: spot.name)

            case .loaded(let response):
                loadedView(response)

            case .error(let message):
                errorView(message)
            }
        }
        .task {
            if case .idle = vm.state {
                await vm.load(spot: spot)
            }
        }
        .navigationTitle(spot.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    if case .loaded(let r) = vm.state {
                        ShareLink(item: buildShareText(spot: spot, response: r)) {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundStyle(.blue)
                        }
                    }
                    Button {
                        showNotificationSheet = true
                    } label: {
                        Image(systemName: pushManager.isRegistered ? "bell.fill" : "bell")
                            .foregroundStyle(.blue)
                    }
                }
            }
        }
        .sheet(isPresented: $showNotificationSheet) {
            NotificationSheet(spot: spot, pushManager: pushManager, isPresented: $showNotificationSheet)
                .presentationDetents([.medium, .large])
        }
    }

    private func buildShareText(spot: Spot, response: ConditionsResponse) -> String {
        let score = response.score.overall
        let rating = response.score.rating
        let c = response.conditions
        var parts: [String] = []
        if let mn = c.waves?.height?.min, let mx = c.waves?.height?.max {
            parts.append("Waves: \(String(format: "%.1f", mn))–\(String(format: "%.1f", mx))m")
        } else if let avg = c.waves?.height?.avg {
            parts.append("Waves: \(String(format: "%.1f", avg))m")
        }
        if let ws = c.wind?.speed {
            var w = "Wind: \(Int(ws)) km/h"
            if let wd = c.wind?.direction { w += " \(wd)" }
            parts.append(w)
        }
        if let wt = c.weather?.waterTemp {
            parts.append("Water: \(Int(wt))°C")
        }
        let details = parts.joined(separator: " | ")
        let encodedName = spot.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? spot.name
        let url: String
        if let loc = spot.location {
            url = "https://shouldigo.surf?lat=\(loc.lat)&lon=\(loc.lon)&name=\(encodedName)"
        } else {
            url = "https://shouldigo.surf?spot=\(spot.id)"
        }
        return "Should I Go? 🏄 \(spot.name) — \(score)/100 (\(rating))\n\(details)\nCheck it out: \(url)"
    }

    // MARK: - Loaded

    @ViewBuilder
    private func loadedView(_ r: ConditionsResponse) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                ScoreMeterCard(score: r.score, conditions: r.conditions,
                               timestamp: r.timestamp, fromCache: r.fromCache, cacheAge: r.cacheAge,
                               onRefresh: { Task { await vm.refresh(spot: spot) } })
                if let breakdown = r.score.breakdown {
                    BreakdownCard(breakdown: breakdown)
                }
                if let trend = r.trend, let blocks = trend.blocks, !blocks.isEmpty {
                    ForecastCard(blocks: blocks, trend: trend)
                }
                if let board = r.boardRecommendation {
                    BoardCard(recommendation: board, conditions: r.conditions)
                }
                BeachSketchView(waveDirection: r.conditions.waves?.direction,
                                windDirection: r.conditions.wind?.direction)
                if let breakdown = r.score.breakdown {
                    SpotFeedbackCard(spotId: r.spotId, breakdown: breakdown)
                }
                siteFooter
                cacheFooter(r)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    private var siteFooter: some View {
        Text("Built between sessions by surfers who should've been in the water")
            .font(.caption)
            .foregroundStyle(.tertiary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
    }

    @ViewBuilder
    private func cacheFooter(_ r: ConditionsResponse) -> some View {
        EmptyView()
    }

    // MARK: - Error

    @ViewBuilder
    private func errorView(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't fetch conditions", systemImage: "water.waves.slash")
        } description: {
            Text(message)
        } actions: {
            Button("Try Again") { Task { await vm.refresh(spot: spot) } }
                .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - Score Meter (Hero card — matches web ScoreDisplay)

struct ScoreMeterCard: View {
    let score: SurfScore
    let conditions: SurfConditions
    let timestamp: String
    let fromCache: Bool?
    let cacheAge: Int?
    var onRefresh: (() -> Void)?

    private var heroColor: Color {
        switch score.rating {
        case "EPIC":     return Color(red: 0.00, green: 0.77, blue: 0.55)  // #00c48c
        case "GREAT":    return Color(red: 0.16, green: 0.82, blue: 0.47)  // #28d278
        case "GOOD":     return Color(red: 0.30, green: 0.85, blue: 0.39)  // #4cd964
        case "FAIR":     return Color(red: 0.96, green: 0.65, blue: 0.14)  // #f5a623
        case "MARGINAL": return Color(red: 0.90, green: 0.49, blue: 0.13)  // #e67e22
        case "POOR":     return Color(red: 1.00, green: 0.42, blue: 0.21)  // #ff6b35
        default:         return Color(red: 1.00, green: 0.23, blue: 0.19)  // #ff3b30
        }
    }

    private var waveText: String? {
        if let mn = conditions.waves?.height?.min, let mx = conditions.waves?.height?.max {
            return String(format: "%.1f–%.1fm", mn, mx)
        }
        if let avg = conditions.waves?.height?.avg {
            return String(format: "%.1fm", avg)
        }
        return nil
    }

    private func windDesc(_ speed: Double) -> String {
        if speed < 10 { return "Calm" }
        if speed < 20 { return "Light breeze" }
        if speed < 30 { return "Breezy" }
        if speed < 40 { return "Windy" }
        return "Very windy"
    }

    private func periodDesc(_ period: Double) -> String {
        if period >= 12 { return "Clean" }
        if period >= 9 { return "Decent" }
        if period >= 6 { return "Short" }
        return "Choppy"
    }

    private var updatedText: String {
        if fromCache == true, let age = cacheAge {
            return "Updated \(age / 60) min ago"
        }
        // Parse ISO timestamp
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: timestamp) {
            let mins = Int(Date().timeIntervalSince(date) / 60)
            if mins < 1 { return "Updated just now" }
            if mins < 60 { return "Updated \(mins) min ago" }
            return "Updated \(mins / 60) hour\(mins / 60 > 1 ? "s" : "") ago"
        }
        return ""
    }

    var body: some View {
        VStack(spacing: 12) {
            Text("Should I go?")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))

            Text(score.overall.surfVerdict)
                .font(.title.bold())
                .foregroundStyle(.white)

            ScoreArc(score: score.overall)
                .frame(height: 140)

            Text(score.rating)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white.opacity(0.75))
                .tracking(1.5)

            if let explanation = score.explanation {
                Text(explanation)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }

            // Wave height (prominent)
            if let wave = waveText {
                Text(wave)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                    .padding(.top, 4)
            }

            // Detail pills (like web hero-details)
            detailPills

            // Updated + refresh
            if !updatedText.isEmpty {
                HStack(spacing: 8) {
                    Text(updatedText)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                    if let onRefresh {
                        Button(action: onRefresh) {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.6))
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(heroColor, in: RoundedRectangle(cornerRadius: 20))
    }

    @ViewBuilder
    private var detailPills: some View {
        let pills = buildPills()
        if !pills.isEmpty {
            FlowLayout(spacing: 6) {
                ForEach(pills, id: \.self) { pill in
                    Text(pill)
                        .font(.caption)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(.white.opacity(0.2), in: Capsule())
                        .foregroundStyle(.white)
                }
            }
            .padding(.top, 4)
        }
    }

    private func buildPills() -> [String] {
        var pills: [String] = []
        if let p = conditions.waves?.period {
            pills.append("\(periodDesc(p)) \(Int(p))s swell")
        }
        if let d = conditions.waves?.direction {
            pills.append("\(d) direction")
        }
        if let ws = conditions.wind?.speed {
            var t = "\(windDesc(ws))"
            if let wd = conditions.wind?.direction { t += " \(wd)" }
            t += " \(Int(ws)) km/h"
            pills.append(t)
        }
        if let at = conditions.weather?.airTemp {
            pills.append("\(Int(at))°C air")
        }
        if let wt = conditions.weather?.waterTemp {
            pills.append("\(Int(wt))°C water")
        }
        return pills
    }
}

// MARK: - Flow Layout (for hero pills)

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(in: proposal.width ?? .infinity, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(in: bounds.width, subviews: subviews)
        for (index, offset) in result.offsets.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + offset.x, y: bounds.minY + offset.y),
                                  proposal: .unspecified)
        }
    }

    private func layout(in width: CGFloat, subviews: Subviews) -> (offsets: [CGPoint], size: CGSize) {
        var offsets: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxWidth: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            offsets.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxWidth = max(maxWidth, x)
        }
        return (offsets, CGSize(width: maxWidth, height: y + rowHeight))
    }
}

struct ScoreArc: View {
    let score: Int

    private var fraction: Double { Double(score) / 100.0 }
    private var color: Color {
        switch score {
        case 85...: return .green
        case 65..<85: return .blue
        case 50..<65: return .yellow
        case 35..<50: return .orange
        default: return .red
        }
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                // Track
                Arc(startAngle: .degrees(180), endAngle: .degrees(360))
                    .stroke(Color.white.opacity(0.25), style: StrokeStyle(lineWidth: 14, lineCap: .round))

                // Fill
                Arc(startAngle: .degrees(180), endAngle: .degrees(180 + fraction * 180))
                    .stroke(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .animation(.spring(duration: 0.8), value: score)

                // Score number
                Text("\(score)")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .offset(y: 12)
            }
            .frame(width: w, height: h)
        }
    }
}

struct Arc: Shape {
    let startAngle: Angle
    let endAngle: Angle

    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.addArc(
            center: CGPoint(x: rect.midX, y: rect.maxY),
            radius: rect.width / 2,
            startAngle: startAngle,
            endAngle: endAngle,
            clockwise: false
        )
        return p
    }
}

// MARK: - Breakdown Card

struct BreakdownCard: View {
    let breakdown: ScoreBreakdown

    private var items: [(String, Int, String)] {
        [
            ("Wave Height", breakdown.waveHeight, heightHint(breakdown.waveHeight)),
            ("Wave Period", breakdown.wavePeriod, periodHint(breakdown.wavePeriod)),
            ("Swell Quality", breakdown.swellQuality, swellHint(breakdown.swellQuality)),
            ("Surface Calm", breakdown.windSpeed, windHint(breakdown.windSpeed)),
            ("Wind Direction", breakdown.windDirection, windDirHint(breakdown.windDirection)),
            ("Wave Direction", breakdown.waveDirection, waveDirHint(breakdown.waveDirection))
        ]
    }

    var body: some View {
        VStack(spacing: 14) {
            SectionHeader("Score Breakdown")
            ForEach(items, id: \.0) { label, score, hint in
                BreakdownBar(label: label, score: score, hint: hint)
            }
        }
        .padding(16)
        .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 20))
    }

    private func heightHint(_ v: Int) -> String {
        v >= 80 ? "Ideal size" : v >= 60 ? "Decent size" : v >= 40 ? "A bit small" : v >= 20 ? "Very small" : "Flat"
    }
    private func periodHint(_ v: Int) -> String {
        v >= 80 ? "Long, clean waves" : v >= 60 ? "Good quality" : v >= 40 ? "Short period" : v >= 20 ? "Wind chop" : "Very choppy"
    }
    private func swellHint(_ v: Int) -> String {
        v >= 80 ? "Solid groundswell" : v >= 60 ? "Decent swell" : v >= 40 ? "Mixed swell" : v >= 20 ? "Mostly wind swell" : "No real swell"
    }
    private func windHint(_ v: Int) -> String {
        v >= 80 ? "Glassy, barely any wind" : v >= 60 ? "Light breeze" : v >= 40 ? "Moderate wind" : v >= 20 ? "Strong wind" : "Blown out"
    }
    private func windDirHint(_ v: Int) -> String {
        v >= 80 ? "Offshore" : v >= 60 ? "Cross-shore" : v >= 40 ? "Side-on" : v >= 20 ? "Onshore" : "Direct onshore"
    }
    private func waveDirHint(_ v: Int) -> String {
        v >= 80 ? "Perfect angle" : v >= 60 ? "Good angle" : v >= 40 ? "Okay angle" : v >= 20 ? "Off angle" : "Wrong direction"
    }
}

struct BreakdownBar: View {
    let label: String
    let score: Int
    let hint: String

    private var color: Color { scoreColor(score) }
    private var grade: String {
        score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F"
    }

    var body: some View {
        VStack(spacing: 6) {
            HStack(alignment: .top, spacing: 10) {
                Text(grade)
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(color)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                    Text(hint).font(.caption).foregroundStyle(.tertiary)
                }
                Spacer()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.gray.opacity(0.1))
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 3).fill(color)
                        .frame(width: geo.size.width * CGFloat(score) / 100, height: 4)
                        .animation(.spring(duration: 0.6), value: score)
                }
            }
            .frame(height: 4)
            .padding(.leading, 32)
        }
    }
}

// MARK: - Forecast Card

struct ForecastCard: View {
    let blocks: [ForecastBlock]
    var trend: SurfTrend?

    private var trendArrow: String {
        switch trend?.trend {
        case "improving": return "↗"
        case "declining": return "↘"
        default: return "→"
        }
    }

    var body: some View {
        VStack(spacing: 14) {
            SectionHeader("Forecast")

            if let message = trend?.message {
                HStack(alignment: .top, spacing: 8) {
                    Text(trendArrow)
                        .font(.title3)
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(Color(red: 0.29, green: 0.33, blue: 0.41)) // #4a5568
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color("background"), in: RoundedRectangle(cornerRadius: 10))
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(blocks) { block in
                        let isBest = trend?.bestWindow?.label == block.label
                        ForecastTile(block: block, isBest: isBest)
                    }
                }
                .padding(.horizontal, 2)
            }
        }
        .padding(16)
        .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 20))
    }
}

struct ForecastTile: View {
    let block: ForecastBlock
    var isBest: Bool = false

    private var color: Color { scoreColor(block.score) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: 6) {
                Text(block.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text("\(block.score)")
                    .font(.title3.bold())
                    .foregroundStyle(color)
                Text(block.rating)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(color.opacity(0.15), in: Capsule())
            }
            .frame(width: 100)
            .padding(.vertical, 12)
            .background(
                isBest ? Color.blue.opacity(0.06) : Color("background"),
                in: RoundedRectangle(cornerRadius: 12)
            )

            if isBest {
                Text("⭐")
                    .font(.system(size: 10))
                    .padding(4)
            }
        }
    }
}

// MARK: - Gear Card (matches web: two side-by-side cards)

struct BoardCard: View {
    let recommendation: BoardRecommendation
    let conditions: SurfConditions

    @AppStorage("userWeight") private var userWeight = ""
    @AppStorage("userSkill") private var userSkill = ""

    private var boardEmoji: String {
        switch recommendation.boardType.lowercased() {
        case let t where t.contains("long"): return "🏄"
        case let t where t.contains("gun"):  return "🚀"
        case let t where t.contains("fish"): return "🐟"
        default: return "🏄‍♂️"
        }
    }

    private func wetsuitLabel(for temp: Double) -> String {
        if temp >= 24 { return "Boardshorts" }
        if temp >= 20 { return "Spring Suit" }
        if temp >= 16 { return "3/2 Wetsuit" }
        return "4/3 Wetsuit"
    }

    private let skillOptions = ["", "beginner", "intermediate", "advanced", "expert"]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Gear")

            HStack(spacing: 12) {
                // Board card
                VStack(spacing: 8) {
                    Text(boardEmoji).font(.system(size: 32))
                    Text(recommendation.boardName ?? recommendation.boardType.capitalized)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if let reason = recommendation.reason {
                        Text(reason)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(4)
                            .truncationMode(.tail)
                            .multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(Color("background"), in: RoundedRectangle(cornerRadius: 14))

                // Wetsuit card
                if let wt = conditions.weather?.waterTemp {
                    VStack(spacing: 8) {
                        Image(systemName: "figure.surfing")
                            .font(.system(size: 28))
                            .foregroundStyle(.blue)
                        Text(wetsuitLabel(for: wt))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        Text(String(format: "%.0f°C water", wt))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(Color("background"), in: RoundedRectangle(cornerRadius: 14))
                }
            }

            // Personalize section
            VStack(alignment: .leading, spacing: 8) {
                Text("Personalize")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Weight (kg)")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        TextField("75", text: $userWeight)
                            .keyboardType(.numberPad)
                            .font(.subheadline)
                            .padding(8)
                            .background(Color("background"), in: RoundedRectangle(cornerRadius: 8))
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Skill")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        Picker("Skill", selection: $userSkill) {
                            Text("--").tag("")
                            Text("Beginner").tag("beginner")
                            Text("Intermediate").tag("intermediate")
                            Text("Advanced").tag("advanced")
                            Text("Expert").tag("expert")
                        }
                        .pickerStyle(.menu)
                        .font(.subheadline)
                        .fixedSize()
                        .padding(.vertical, 4)
                        .padding(.horizontal, 8)
                        .background(Color("background"), in: RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 20))
    }
}

// MARK: - Spot Feedback (matches web SpotFeedback)

struct SpotFeedbackCard: View {
    let spotId: String
    let breakdown: ScoreBreakdown

    @State private var text = ""
    @State private var isLoading = false
    @State private var feedbackCount = 0
    @State private var multipliers: [String: Double]?
    @State private var recentFeedback: [RecentFeedback] = []
    @State private var showRecent = false

    private let factorLabels: [(String, String)] = [
        ("waveHeight", "Wave Height"),
        ("wavePeriod", "Wave Period"),
        ("swellQuality", "Swell Quality"),
        ("windSpeed", "Surface Calm"),
        ("windDirection", "Wind Direction"),
        ("waveDirection", "Wave Direction")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Is this score right?")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("Share your local knowledge and we\u{2019}ll fine-tune the scoring \u{2014} e.g. \u{201C}needs longer period\u{201D} or \u{201C}works best on south swell\u{201D}")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if feedbackCount > 0 {
                Text("Tuned by \(feedbackCount) surfer\(feedbackCount != 1 ? "s" : "")")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.blue)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.blue.opacity(0.1), in: Capsule())
            }

            // Text input
            TextField("e.g. Wave period is everything here…", text: $text, axis: .vertical)
                .lineLimit(3...5)
                .font(.subheadline)
                .padding(12)
                .background(Color("background"), in: RoundedRectangle(cornerRadius: 10))
                .disabled(isLoading)

            // Submit button
            Button {
                Task { await submit() }
            } label: {
                Text(isLoading ? "Reading the local knowledge…" : "Adjust Score")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(text.trimmingCharacters(in: .whitespaces).count >= 10 ? Color.blue : Color.gray.opacity(0.3),
                                in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
            }
            .disabled(text.trimmingCharacters(in: .whitespaces).count < 10 || isLoading)

            // Weight change tags
            if let mults = multipliers {
                FlowLayout(spacing: 6) {
                    ForEach(factorLabels, id: \.0) { key, label in
                        if let val = mults[key] {
                            let pct = Int(round((val - 1) * 100))
                            if abs(pct) >= 5 {
                                Text("\(label) \(pct > 0 ? "+" : "")\(pct)%")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(pct > 0 ? Color.green.opacity(0.15) : Color.red.opacity(0.15),
                                                in: Capsule())
                                    .foregroundStyle(pct > 0 ? .green : .red)
                            }
                        }
                    }
                }
            }

            // Recent feedback
            if !recentFeedback.isEmpty {
                Button {
                    withAnimation { showRecent.toggle() }
                } label: {
                    Text("\(showRecent ? "Hide" : "Show") local tips (\(recentFeedback.count))")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }

                if showRecent {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(recentFeedback.indices, id: \.self) { i in
                            Text("\"\(recentFeedback[i].text)\"")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .italic()
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 20))
        .task { await loadFeedback() }
    }

    private func loadFeedback() async {
        do {
            let response = try await APIClient.shared.fetchFeedback(spotId: spotId)
            feedbackCount = response.feedbackCount
            recentFeedback = response.recentFeedback ?? []
        } catch {}
    }

    private func submit() async {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 10 else { return }
        isLoading = true
        do {
            let response = try await APIClient.shared.submitFeedback(spotId: spotId, text: trimmed)
            multipliers = response.yourMultipliers ?? response.multipliers
            feedbackCount = response.feedbackCount ?? (feedbackCount + 1)
            text = ""
            await loadFeedback()
        } catch {}
        isLoading = false
    }
}

// MARK: - Helpers

private func scoreColor(_ value: Int) -> Color {
    if value >= 80 { return Color(red: 0.00, green: 0.77, blue: 0.55) }  // #00c48c
    if value >= 60 { return Color(red: 0.30, green: 0.85, blue: 0.39) }  // #4cd964
    if value >= 40 { return Color(red: 0.96, green: 0.65, blue: 0.14) }  // #f5a623
    if value >= 20 { return Color(red: 1.00, green: 0.42, blue: 0.21) }  // #ff6b35
    return Color(red: 1.00, green: 0.23, blue: 0.19)                      // #ff3b30
}

struct SectionHeader: View {
    let title: String
    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
