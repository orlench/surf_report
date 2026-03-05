import SwiftUI

// MARK: - Direction lookup

private let directionDegrees: [String: Double] = [
    "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5,
    "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
    "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5,
    "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5,
]

private func compassToVec(_ deg: Double) -> CGPoint {
    let rad = (deg - 90) * .pi / 180
    return CGPoint(x: cos(rad), y: sin(rad))
}

private func windRelation(waveDeg: Double, windDeg: Double) -> String {
    let diff = abs(((waveDeg - windDeg + 540).truncatingRemainder(dividingBy: 360)) - 180)
    if diff < 50 { return "Onshore" }
    if diff > 130 { return "Offshore" }
    return "Cross-shore"
}

// MARK: - Beach Sketch View

struct BeachSketchView: View {
    let waveDirection: String?
    let windDirection: String?

    private let W: CGFloat = 400
    private let H: CGFloat = 220

    private var waveDeg: Double? {
        guard let d = waveDirection else { return nil }
        return directionDegrees[d]
    }
    private var windDeg: Double? {
        guard let d = windDirection else { return nil }
        return directionDegrees[d]
    }

    var body: some View {
        if let wd = waveDeg {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Beach View")

                Canvas { context, size in
                    drawSketch(context: context, size: size, waveDeg: wd)
                }
                .frame(height: 180)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                // Footer labels
                HStack(spacing: 16) {
                    if let dir = waveDirection {
                        Label("Swell \(dir)", systemImage: "water.waves")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(red: 0.15, green: 0.39, blue: 0.93)) // #2563eb
                    }
                    if let wdeg = windDeg, let wvdeg = waveDeg {
                        let relation = windRelation(waveDeg: wvdeg, windDeg: wdeg)
                        Label("\(relation)\(windDirection.map { " (\($0))" } ?? "")",
                              systemImage: "wind")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(16)
            .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 20))
        }
    }

    // MARK: - Drawing

    private func drawSketch(context: GraphicsContext, size: CGSize, waveDeg: Double) {
        let scaleX = size.width / W
        let scaleY = size.height / H

        var ctx = context
        ctx.scaleBy(x: scaleX, y: scaleY)

        // Background water
        ctx.fill(Path(roundedRect: CGRect(x: 0, y: 0, width: W, height: H), cornerRadius: 6),
                 with: .color(Color(red: 0.91, green: 0.96, blue: 0.99).opacity(0.6)))

        let seaVec = compassToVec(waveDeg)
        let inlandVec = CGPoint(x: -seaVec.x, y: -seaVec.y)
        let mid = CGPoint(x: W / 2, y: H / 2)

        // Shore angle (perpendicular to wave direction)
        let shoreAngle = atan2(-seaVec.x, seaVec.y)
        let shorePv = CGPoint(x: cos(shoreAngle), y: sin(shoreAngle))

        // 1. Bathymetry contour arcs
        let contours: [(dist: CGFloat, halfLen: CGFloat, opacity: Double, width: CGFloat)] = [
            (32, 105, 0.4, 1.2),
            (70, 120, 0.28, 0.9),
            (115, 108, 0.18, 0.7),
        ]
        for c in contours {
            let arcPath = shoreParallelArc(mid: mid, seaVec: seaVec, dist: c.dist,
                                           halfLen: c.halfLen, shoreAngle: shoreAngle)
            ctx.stroke(arcPath, with: .color(Color(red: 0.38, green: 0.65, blue: 0.98).opacity(c.opacity)),
                       lineWidth: c.width)
        }

        // 2. Beach shape (simple arc)
        let beachPath = makeBeachPath(mid: mid, inlandVec: inlandVec, shorePv: shorePv)
        ctx.fill(beachPath, with: .color(Color(red: 0.90, green: 0.83, blue: 0.60).opacity(0.7)))
        ctx.stroke(beachPath, with: .color(Color(red: 0.54, green: 0.46, blue: 0.38)), lineWidth: 1.5)

        // 3. Foam / shore-break
        let foamPath = makeFoamPath(mid: mid, seaVec: seaVec, shoreAngle: shoreAngle)
        ctx.stroke(foamPath, with: .color(Color(red: 0.75, green: 0.86, blue: 0.99).opacity(0.7)),
                   style: StrokeStyle(lineWidth: 4, lineCap: .round))

        // 4. Wave crest lines
        let waveLines: [(dist: CGFloat, halfLen: CGFloat, opacity: Double, width: CGFloat)] = [
            (15, 55, 0.55, 1.8),
            (50, 68, 0.45, 1.5),
            (88, 72, 0.35, 1.2),
            (130, 65, 0.25, 1.0),
            (170, 55, 0.18, 0.8),
        ]
        for w in waveLines {
            let wavePath = shoreParallelArc(mid: mid, seaVec: seaVec, dist: w.dist,
                                            halfLen: w.halfLen, shoreAngle: shoreAngle)
            ctx.stroke(wavePath, with: .color(Color.blue.opacity(w.opacity)), lineWidth: w.width)
        }

        // 5. Swell direction arrow (blue)
        let maxDist = maxSeawardDist(mid: mid, vec: seaVec)
        let wvCx = mid.x + seaVec.x * maxDist * 0.70 + shorePv.x * 30
        let wvCy = mid.y + seaVec.y * maxDist * 0.70 + shorePv.y * 30
        drawArrow(ctx: &ctx, cx: wvCx, cy: wvCy, direction: inlandVec, length: 44,
                  color: Color(red: 0.15, green: 0.39, blue: 0.93), lineWidth: 2.0)
        drawLabel(ctx: &ctx, x: wvCx + seaVec.x * 26, y: wvCy + seaVec.y * 26,
                  text: "SWELL", color: Color(red: 0.15, green: 0.39, blue: 0.93))

        // 6. Wind direction arrow (amber, dashed)
        if let windDeg {
            let windTV = compassToVec((windDeg + 180).truncatingRemainder(dividingBy: 360))
            let wdCx = mid.x + seaVec.x * maxDist * 0.55 + shorePv.x * (-35)
            let wdCy = mid.y + seaVec.y * maxDist * 0.55 + shorePv.y * (-35)
            drawArrow(ctx: &ctx, cx: wdCx, cy: wdCy, direction: windTV, length: 36,
                      color: Color(red: 0.96, green: 0.62, blue: 0.04), lineWidth: 1.5,
                      dashed: true)
            drawLabel(ctx: &ctx, x: wdCx - windTV.x * 22, y: wdCy - windTV.y * 22,
                      text: "WIND", color: Color(red: 0.96, green: 0.62, blue: 0.04))
        }

        // 7. Compass rose (top-right)
        let compassX = W - 16
        drawLabel(ctx: &ctx, x: compassX, y: 12, text: "N", color: Color.gray)
        var arrowPath = Path()
        arrowPath.move(to: CGPoint(x: compassX, y: 18))
        arrowPath.addLine(to: CGPoint(x: compassX, y: 27))
        ctx.stroke(arrowPath, with: .color(.gray.opacity(0.6)), lineWidth: 1.2)
        var tri = Path()
        tri.move(to: CGPoint(x: compassX, y: 18))
        tri.addLine(to: CGPoint(x: compassX - 3, y: 24))
        tri.addLine(to: CGPoint(x: compassX + 3, y: 24))
        tri.closeSubpath()
        ctx.fill(tri, with: .color(.gray.opacity(0.6)))
    }

    // MARK: - Drawing helpers

    private func shoreParallelArc(mid: CGPoint, seaVec: CGPoint, dist: CGFloat,
                                   halfLen: CGFloat, shoreAngle: CGFloat) -> Path {
        let cx = mid.x + seaVec.x * dist
        let cy = mid.y + seaVec.y * dist
        let pv = CGPoint(x: cos(shoreAngle), y: sin(shoreAngle))
        let p1 = CGPoint(x: cx - pv.x * halfLen, y: cy - pv.y * halfLen)
        let p2 = CGPoint(x: cx + pv.x * halfLen, y: cy + pv.y * halfLen)
        let cp = CGPoint(x: cx + seaVec.x * 8, y: cy + seaVec.y * 8)
        var path = Path()
        path.move(to: p1)
        path.addQuadCurve(to: p2, control: cp)
        return path
    }

    private func makeBeachPath(mid: CGPoint, inlandVec: CGPoint, shorePv: CGPoint) -> Path {
        let cx = mid.x + inlandVec.x * 35
        let cy = mid.y + inlandVec.y * 35
        let halfLen: CGFloat = 130
        let width: CGFloat = 22

        let p1 = CGPoint(x: cx - shorePv.x * halfLen, y: cy - shorePv.y * halfLen)
        let p2 = CGPoint(x: cx + shorePv.x * halfLen, y: cy + shorePv.y * halfLen)
        let p3 = CGPoint(x: p2.x + inlandVec.x * width, y: p2.y + inlandVec.y * width)
        let p4 = CGPoint(x: p1.x + inlandVec.x * width, y: p1.y + inlandVec.y * width)

        var path = Path()
        path.move(to: p1)
        path.addLine(to: p2)
        path.addLine(to: p3)
        path.addLine(to: p4)
        path.closeSubpath()
        return path
    }

    private func makeFoamPath(mid: CGPoint, seaVec: CGPoint, shoreAngle: CGFloat) -> Path {
        shoreParallelArc(mid: mid, seaVec: seaVec, dist: 5, halfLen: 120, shoreAngle: shoreAngle)
    }

    private func maxSeawardDist(mid: CGPoint, vec: CGPoint) -> CGFloat {
        let margin: CGFloat = 18
        let bounds = [
            vec.x > 0.01 ? (W - margin - mid.x) / vec.x : CGFloat.infinity,
            vec.x < -0.01 ? (margin - mid.x) / vec.x : CGFloat.infinity,
            vec.y > 0.01 ? (H - margin - mid.y) / vec.y : CGFloat.infinity,
            vec.y < -0.01 ? (margin - mid.y) / vec.y : CGFloat.infinity,
        ]
        return min(160, bounds.filter { $0 > 0 }.min() ?? 160)
    }

    private func drawArrow(ctx: inout GraphicsContext, cx: CGFloat, cy: CGFloat,
                           direction: CGPoint, length: CGFloat, color: Color,
                           lineWidth: CGFloat, dashed: Bool = false) {
        let halfLen = length / 2
        let s = CGPoint(x: cx - direction.x * halfLen, y: cy - direction.y * halfLen)
        let e = CGPoint(x: cx + direction.x * halfLen, y: cy + direction.y * halfLen)

        var line = Path()
        line.move(to: s)
        line.addLine(to: e)
        let style = dashed
            ? StrokeStyle(lineWidth: lineWidth, dash: [5, 3])
            : StrokeStyle(lineWidth: lineWidth)
        ctx.stroke(line, with: .color(color), style: style)

        // Arrowhead
        let hw: CGFloat = 5, hl: CGFloat = 9
        let pv = CGPoint(x: -direction.y, y: direction.x)
        var head = Path()
        head.move(to: e)
        head.addLine(to: CGPoint(x: e.x - direction.x * hl + pv.x * hw,
                                 y: e.y - direction.y * hl + pv.y * hw))
        head.addLine(to: CGPoint(x: e.x - direction.x * hl - pv.x * hw,
                                 y: e.y - direction.y * hl - pv.y * hw))
        head.closeSubpath()
        ctx.fill(head, with: .color(color))
    }

    private func drawLabel(ctx: inout GraphicsContext, x: CGFloat, y: CGFloat,
                           text: String, color: Color) {
        let resolved = ctx.resolve(Text(text)
            .font(.system(size: 7.5, weight: .semibold, design: .serif))
            .foregroundColor(color))
        ctx.draw(resolved, at: CGPoint(x: x, y: y), anchor: .center)
    }
}
