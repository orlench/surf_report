import SwiftUI

// MARK: - Board Illustration (top-down view, matching Android Canvas drawings)

private let boardBlue = Color(red: 0.231, green: 0.510, blue: 0.965) // #3B82F6
private let boardBlueDark = Color(red: 0.145, green: 0.388, blue: 0.922) // #2563EB
private let finColor = Color(red: 0.231, green: 0.510, blue: 0.965).opacity(0.5)

struct BoardIllustration: View {
    let boardType: String

    var body: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height

            switch boardType.lowercased() {
            case let t where t.contains("long"):
                drawLongboard(context: context, w: w, h: h)
            case let t where t.contains("fish"):
                drawFish(context: context, w: w, h: h)
            case let t where t.contains("short"):
                drawShortboard(context: context, w: w, h: h)
            case let t where t.contains("step"):
                drawStepup(context: context, w: w, h: h)
            case let t where t.contains("gun"):
                drawGun(context: context, w: w, h: h)
            case let t where t.contains("sup"):
                drawSUP(context: context, w: w, h: h)
            default:
                drawMidlength(context: context, w: w, h: h)
            }
        }
        .frame(width: 28, height: 64)
    }

    // MARK: - Longboard

    private func drawLongboard(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.01))
        path.addCurve(to: CGPoint(x: w * 0.92, y: h * 0.17),
                      control1: CGPoint(x: w * 0.75, y: h * 0.01),
                      control2: CGPoint(x: w * 0.9, y: h * 0.05))
        path.addLine(to: CGPoint(x: w * 0.93, y: h * 0.44))
        path.addQuadCurve(to: CGPoint(x: w * 0.92, y: h * 0.78),
                          control: CGPoint(x: w * 0.93, y: h * 0.65))
        path.addCurve(to: CGPoint(x: w * 0.7, y: h * 0.97),
                      control1: CGPoint(x: w * 0.9, y: h * 0.88),
                      control2: CGPoint(x: w * 0.78, y: h * 0.95))
        path.addLine(to: CGPoint(x: w * 0.5, y: h * 0.99))
        path.addLine(to: CGPoint(x: w * 0.3, y: h * 0.97))
        path.addCurve(to: CGPoint(x: w * 0.08, y: h * 0.78),
                      control1: CGPoint(x: w * 0.22, y: h * 0.95),
                      control2: CGPoint(x: w * 0.1, y: h * 0.88))
        path.addQuadCurve(to: CGPoint(x: w * 0.07, y: h * 0.44),
                          control: CGPoint(x: w * 0.07, y: h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.08, y: h * 0.17))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.01),
                      control1: CGPoint(x: w * 0.1, y: h * 0.05),
                      control2: CGPoint(x: w * 0.25, y: h * 0.01))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        // Stringer
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.04))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.97))
        }, with: .color(.black.opacity(0.12)), lineWidth: 0.8)
        // Single fin
        drawFin(context: context, top: CGPoint(x: w * 0.5, y: h * 0.88),
                left: CGPoint(x: w * 0.4, y: h * 0.95),
                right: CGPoint(x: w * 0.6, y: h * 0.95))
    }

    // MARK: - Fish

    private func drawFish(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.02))
        path.addCurve(to: CGPoint(x: w * 0.95, y: h * 0.2),
                      control1: CGPoint(x: w * 0.72, y: h * 0.02),
                      control2: CGPoint(x: w * 0.92, y: h * 0.08))
        path.addLine(to: CGPoint(x: w * 0.96, y: h * 0.42))
        path.addQuadCurve(to: CGPoint(x: w * 0.92, y: h * 0.76),
                          control: CGPoint(x: w * 0.96, y: h * 0.62))
        path.addCurve(to: CGPoint(x: w * 0.68, y: h * 0.94),
                      control1: CGPoint(x: w * 0.88, y: h * 0.84),
                      control2: CGPoint(x: w * 0.78, y: h * 0.9))
        // Swallowtail
        path.addLine(to: CGPoint(x: w * 0.62, y: h * 0.98))
        path.addQuadCurve(to: CGPoint(x: w * 0.5, y: h * 0.98),
                          control: CGPoint(x: w * 0.56, y: h * 0.94))
        path.addQuadCurve(to: CGPoint(x: w * 0.38, y: h * 0.98),
                          control: CGPoint(x: w * 0.44, y: h * 0.94))
        path.addLine(to: CGPoint(x: w * 0.32, y: h * 0.94))
        path.addCurve(to: CGPoint(x: w * 0.08, y: h * 0.76),
                      control1: CGPoint(x: w * 0.22, y: h * 0.9),
                      control2: CGPoint(x: w * 0.12, y: h * 0.84))
        path.addQuadCurve(to: CGPoint(x: w * 0.04, y: h * 0.42),
                          control: CGPoint(x: w * 0.04, y: h * 0.62))
        path.addLine(to: CGPoint(x: w * 0.05, y: h * 0.2))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.02),
                      control1: CGPoint(x: w * 0.08, y: h * 0.08),
                      control2: CGPoint(x: w * 0.28, y: h * 0.02))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.05))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.96))
        }, with: .color(.black.opacity(0.12)), lineWidth: 0.8)
        // Twin keel fins
        drawFin(context: context, top: CGPoint(x: w * 0.28, y: h * 0.78),
                left: CGPoint(x: w * 0.18, y: h * 0.88),
                right: CGPoint(x: w * 0.32, y: h * 0.86))
        drawFin(context: context, top: CGPoint(x: w * 0.72, y: h * 0.78),
                left: CGPoint(x: w * 0.82, y: h * 0.88),
                right: CGPoint(x: w * 0.68, y: h * 0.86))
    }

    // MARK: - Midlength

    private func drawMidlength(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.02))
        path.addCurve(to: CGPoint(x: w * 0.9, y: h * 0.18),
                      control1: CGPoint(x: w * 0.72, y: h * 0.02),
                      control2: CGPoint(x: w * 0.88, y: h * 0.07))
        path.addLine(to: CGPoint(x: w * 0.92, y: h * 0.43))
        path.addQuadCurve(to: CGPoint(x: w * 0.88, y: h * 0.79),
                          control: CGPoint(x: w * 0.92, y: h * 0.65))
        path.addCurve(to: CGPoint(x: w * 0.62, y: h * 0.96),
                      control1: CGPoint(x: w * 0.85, y: h * 0.88),
                      control2: CGPoint(x: w * 0.72, y: h * 0.94))
        path.addQuadCurve(to: CGPoint(x: w * 0.38, y: h * 0.96),
                          control: CGPoint(x: w * 0.5, y: h * 0.99))
        path.addCurve(to: CGPoint(x: w * 0.12, y: h * 0.79),
                      control1: CGPoint(x: w * 0.28, y: h * 0.94),
                      control2: CGPoint(x: w * 0.15, y: h * 0.88))
        path.addQuadCurve(to: CGPoint(x: w * 0.08, y: h * 0.43),
                          control: CGPoint(x: w * 0.08, y: h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.1, y: h * 0.18))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.02),
                      control1: CGPoint(x: w * 0.12, y: h * 0.07),
                      control2: CGPoint(x: w * 0.28, y: h * 0.02))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.05))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.95))
        }, with: .color(.black.opacity(0.12)), lineWidth: 0.8)
        // 2+1 fins
        drawFin(context: context, top: CGPoint(x: w * 0.5, y: h * 0.86),
                left: CGPoint(x: w * 0.45, y: h * 0.93),
                right: CGPoint(x: w * 0.55, y: h * 0.93))
        drawFin(context: context, top: CGPoint(x: w * 0.28, y: h * 0.84),
                left: CGPoint(x: w * 0.22, y: h * 0.89),
                right: CGPoint(x: w * 0.34, y: h * 0.88))
        drawFin(context: context, top: CGPoint(x: w * 0.72, y: h * 0.84),
                left: CGPoint(x: w * 0.78, y: h * 0.89),
                right: CGPoint(x: w * 0.66, y: h * 0.88))
    }

    // MARK: - Shortboard

    private func drawShortboard(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.005))
        path.addCurve(to: CGPoint(x: w * 0.86, y: h * 0.22),
                      control1: CGPoint(x: w * 0.58, y: h * 0.02),
                      control2: CGPoint(x: w * 0.82, y: h * 0.1))
        path.addLine(to: CGPoint(x: w * 0.88, y: h * 0.42))
        path.addQuadCurve(to: CGPoint(x: w * 0.85, y: h * 0.78),
                          control: CGPoint(x: w * 0.88, y: h * 0.64))
        path.addCurve(to: CGPoint(x: w * 0.62, y: h * 0.95),
                      control1: CGPoint(x: w * 0.82, y: h * 0.86),
                      control2: CGPoint(x: w * 0.72, y: h * 0.92))
        path.addLine(to: CGPoint(x: w * 0.56, y: h * 0.97))
        path.addQuadCurve(to: CGPoint(x: w * 0.44, y: h * 0.97),
                          control: CGPoint(x: w * 0.5, y: h * 0.98))
        path.addLine(to: CGPoint(x: w * 0.38, y: h * 0.95))
        path.addCurve(to: CGPoint(x: w * 0.15, y: h * 0.78),
                      control1: CGPoint(x: w * 0.28, y: h * 0.92),
                      control2: CGPoint(x: w * 0.18, y: h * 0.86))
        path.addQuadCurve(to: CGPoint(x: w * 0.12, y: h * 0.42),
                          control: CGPoint(x: w * 0.12, y: h * 0.64))
        path.addLine(to: CGPoint(x: w * 0.14, y: h * 0.22))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.005),
                      control1: CGPoint(x: w * 0.18, y: h * 0.1),
                      control2: CGPoint(x: w * 0.42, y: h * 0.02))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.03))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.95))
        }, with: .color(.black.opacity(0.12)), lineWidth: 0.8)
        // Thruster fins
        drawFin(context: context, top: CGPoint(x: w * 0.5, y: h * 0.84),
                left: CGPoint(x: w * 0.44, y: h * 0.92),
                right: CGPoint(x: w * 0.56, y: h * 0.92))
        drawFin(context: context, top: CGPoint(x: w * 0.25, y: h * 0.81),
                left: CGPoint(x: w * 0.18, y: h * 0.87),
                right: CGPoint(x: w * 0.3, y: h * 0.86))
        drawFin(context: context, top: CGPoint(x: w * 0.75, y: h * 0.81),
                left: CGPoint(x: w * 0.82, y: h * 0.87),
                right: CGPoint(x: w * 0.7, y: h * 0.86))
    }

    // MARK: - Step-up

    private func drawStepup(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.005))
        path.addCurve(to: CGPoint(x: w * 0.88, y: h * 0.22),
                      control1: CGPoint(x: w * 0.6, y: h * 0.02),
                      control2: CGPoint(x: w * 0.84, y: h * 0.1))
        path.addLine(to: CGPoint(x: w * 0.9, y: h * 0.44))
        path.addQuadCurve(to: CGPoint(x: w * 0.86, y: h * 0.79),
                          control: CGPoint(x: w * 0.9, y: h * 0.66))
        path.addCurve(to: CGPoint(x: w * 0.58, y: h * 0.97),
                      control1: CGPoint(x: w * 0.82, y: h * 0.87),
                      control2: CGPoint(x: w * 0.68, y: h * 0.93))
        path.addLine(to: CGPoint(x: w * 0.5, y: h * 0.99))
        path.addLine(to: CGPoint(x: w * 0.42, y: h * 0.97))
        path.addCurve(to: CGPoint(x: w * 0.14, y: h * 0.79),
                      control1: CGPoint(x: w * 0.32, y: h * 0.93),
                      control2: CGPoint(x: w * 0.18, y: h * 0.87))
        path.addQuadCurve(to: CGPoint(x: w * 0.1, y: h * 0.44),
                          control: CGPoint(x: w * 0.1, y: h * 0.66))
        path.addLine(to: CGPoint(x: w * 0.12, y: h * 0.22))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.005),
                      control1: CGPoint(x: w * 0.16, y: h * 0.1),
                      control2: CGPoint(x: w * 0.4, y: h * 0.02))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.03))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.97))
        }, with: .color(.black.opacity(0.12)), lineWidth: 0.8)
        drawFin(context: context, top: CGPoint(x: w * 0.5, y: h * 0.87),
                left: CGPoint(x: w * 0.44, y: h * 0.94),
                right: CGPoint(x: w * 0.56, y: h * 0.94))
        drawFin(context: context, top: CGPoint(x: w * 0.25, y: h * 0.84),
                left: CGPoint(x: w * 0.18, y: h * 0.9),
                right: CGPoint(x: w * 0.3, y: h * 0.89))
        drawFin(context: context, top: CGPoint(x: w * 0.75, y: h * 0.84),
                left: CGPoint(x: w * 0.82, y: h * 0.9),
                right: CGPoint(x: w * 0.7, y: h * 0.89))
    }

    // MARK: - Gun

    private func drawGun(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.005))
        path.addCurve(to: CGPoint(x: w * 0.82, y: h * 0.22),
                      control1: CGPoint(x: w * 0.57, y: h * 0.02),
                      control2: CGPoint(x: w * 0.78, y: h * 0.1))
        path.addLine(to: CGPoint(x: w * 0.84, y: h * 0.42))
        path.addQuadCurve(to: CGPoint(x: w * 0.8, y: h * 0.8),
                          control: CGPoint(x: w * 0.84, y: h * 0.66))
        path.addCurve(to: CGPoint(x: w * 0.56, y: h * 0.97),
                      control1: CGPoint(x: w * 0.76, y: h * 0.88),
                      control2: CGPoint(x: w * 0.64, y: h * 0.94))
        path.addLine(to: CGPoint(x: w * 0.5, y: h * 0.995))
        path.addLine(to: CGPoint(x: w * 0.44, y: h * 0.97))
        path.addCurve(to: CGPoint(x: w * 0.2, y: h * 0.8),
                      control1: CGPoint(x: w * 0.36, y: h * 0.94),
                      control2: CGPoint(x: w * 0.24, y: h * 0.88))
        path.addQuadCurve(to: CGPoint(x: w * 0.16, y: h * 0.42),
                          control: CGPoint(x: w * 0.16, y: h * 0.66))
        path.addLine(to: CGPoint(x: w * 0.18, y: h * 0.22))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.005),
                      control1: CGPoint(x: w * 0.22, y: h * 0.1),
                      control2: CGPoint(x: w * 0.43, y: h * 0.02))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.03))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.97))
        }, with: .color(.black.opacity(0.12)), lineWidth: 0.8)
        drawFin(context: context, top: CGPoint(x: w * 0.5, y: h * 0.87),
                left: CGPoint(x: w * 0.44, y: h * 0.94),
                right: CGPoint(x: w * 0.56, y: h * 0.94))
        drawFin(context: context, top: CGPoint(x: w * 0.27, y: h * 0.85),
                left: CGPoint(x: w * 0.2, y: h * 0.9),
                right: CGPoint(x: w * 0.32, y: h * 0.89))
        drawFin(context: context, top: CGPoint(x: w * 0.73, y: h * 0.85),
                left: CGPoint(x: w * 0.8, y: h * 0.9),
                right: CGPoint(x: w * 0.68, y: h * 0.89))
    }

    // MARK: - SUP

    private func drawSUP(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.02))
        path.addCurve(to: CGPoint(x: w * 0.93, y: h * 0.16),
                      control1: CGPoint(x: w * 0.72, y: h * 0.02),
                      control2: CGPoint(x: w * 0.9, y: h * 0.06))
        path.addLine(to: CGPoint(x: w * 0.95, y: h * 0.4))
        path.addQuadCurve(to: CGPoint(x: w * 0.92, y: h * 0.78),
                          control: CGPoint(x: w * 0.95, y: h * 0.62))
        path.addCurve(to: CGPoint(x: w * 0.64, y: h * 0.96),
                      control1: CGPoint(x: w * 0.88, y: h * 0.88),
                      control2: CGPoint(x: w * 0.74, y: h * 0.94))
        path.addQuadCurve(to: CGPoint(x: w * 0.36, y: h * 0.96),
                          control: CGPoint(x: w * 0.5, y: h * 0.99))
        path.addCurve(to: CGPoint(x: w * 0.08, y: h * 0.78),
                      control1: CGPoint(x: w * 0.26, y: h * 0.94),
                      control2: CGPoint(x: w * 0.12, y: h * 0.88))
        path.addQuadCurve(to: CGPoint(x: w * 0.05, y: h * 0.4),
                          control: CGPoint(x: w * 0.05, y: h * 0.62))
        path.addLine(to: CGPoint(x: w * 0.07, y: h * 0.16))
        path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.02),
                      control1: CGPoint(x: w * 0.1, y: h * 0.06),
                      control2: CGPoint(x: w * 0.28, y: h * 0.02))
        path.closeSubpath()

        context.fill(path, with: .color(boardBlue.opacity(0.85)))
        context.stroke(path, with: .color(boardBlueDark), lineWidth: 0.8)
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.05))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.95))
        }, with: .color(.black.opacity(0.1)), lineWidth: 0.8)
        // Deck pad
        context.stroke(RoundedRectangle(cornerRadius: 3).path(in: CGRect(
            x: w * 0.28, y: h * 0.34, width: w * 0.44, height: h * 0.28
        )), with: .color(.black.opacity(0.06)), lineWidth: 0.8)
        // Grip lines
        for i in 0..<5 {
            let y = h * (0.37 + Double(i) * 0.05)
            context.stroke(Path { p in
                p.move(to: CGPoint(x: w * 0.32, y: y))
                p.addLine(to: CGPoint(x: w * 0.68, y: y))
            }, with: .color(.black.opacity(0.04)), lineWidth: 0.6)
        }
        // Single fin
        drawFin(context: context, top: CGPoint(x: w * 0.5, y: h * 0.86),
                left: CGPoint(x: w * 0.42, y: h * 0.93),
                right: CGPoint(x: w * 0.58, y: h * 0.93))
    }

    // MARK: - Fin helper

    private func drawFin(context: GraphicsContext, top: CGPoint, left: CGPoint, right: CGPoint) {
        var fin = Path()
        fin.move(to: top)
        fin.addLine(to: left)
        fin.addQuadCurve(to: right,
                         control: CGPoint(x: (left.x + right.x) / 2,
                                          y: left.y + (left.y - top.y) * 0.15))
        fin.closeSubpath()
        context.fill(fin, with: .color(finColor))
    }
}

// MARK: - Wetsuit Illustration

private let gearGray = Color(red: 0.392, green: 0.455, blue: 0.545) // #64748B
private let gearGrayDark = Color(red: 0.278, green: 0.333, blue: 0.412) // #475569

struct WetsuitIllustration: View {
    let isShorts: Bool

    var body: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height
            if isShorts {
                drawBoardshorts(context: context, w: w, h: h)
            } else {
                drawWetsuit(context: context, w: w, h: h)
            }
        }
        .frame(width: 36, height: 64)
    }

    private func drawWetsuit(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        // Neck
        path.move(to: CGPoint(x: w * 0.38, y: h * 0.04))
        path.addQuadCurve(to: CGPoint(x: w * 0.62, y: h * 0.04),
                          control: CGPoint(x: w * 0.5, y: h * 0.02))
        // Right shoulder → sleeve
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.08))
        path.addLine(to: CGPoint(x: w * 0.92, y: h * 0.2))
        path.addLine(to: CGPoint(x: w * 0.88, y: h * 0.26))
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.16))
        // Right torso → leg
        path.addLine(to: CGPoint(x: w * 0.68, y: h * 0.38))
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.7, y: h * 0.98))
        path.addLine(to: CGPoint(x: w * 0.56, y: h * 0.98))
        // Crotch
        path.addLine(to: CGPoint(x: w * 0.5, y: h * 0.6))
        path.addLine(to: CGPoint(x: w * 0.44, y: h * 0.98))
        // Left leg
        path.addLine(to: CGPoint(x: w * 0.3, y: h * 0.98))
        path.addLine(to: CGPoint(x: w * 0.28, y: h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.32, y: h * 0.38))
        // Left sleeve
        path.addLine(to: CGPoint(x: w * 0.28, y: h * 0.16))
        path.addLine(to: CGPoint(x: w * 0.12, y: h * 0.26))
        path.addLine(to: CGPoint(x: w * 0.08, y: h * 0.2))
        path.addLine(to: CGPoint(x: w * 0.28, y: h * 0.08))
        path.closeSubpath()

        context.fill(path, with: .color(gearGray.opacity(0.85)))
        context.stroke(path, with: .color(gearGrayDark), lineWidth: 0.8)
        // Zip line
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.05))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.32))
        }, with: .color(.black.opacity(0.15)), style: StrokeStyle(lineWidth: 0.8, lineCap: .round))
    }

    private func drawBoardshorts(context: GraphicsContext, w: CGFloat, h: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: w * 0.2, y: h * 0.15))
        path.addLine(to: CGPoint(x: w * 0.8, y: h * 0.15))
        path.addLine(to: CGPoint(x: w * 0.82, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.78, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.56, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.5, y: h * 0.52))
        path.addLine(to: CGPoint(x: w * 0.44, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.22, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.18, y: h * 0.22))
        path.closeSubpath()

        context.fill(path, with: .color(gearGray.opacity(0.85)))
        context.stroke(path, with: .color(gearGrayDark), lineWidth: 0.8)
        // Waistband
        context.stroke(Path { p in
            p.move(to: CGPoint(x: w * 0.22, y: h * 0.22))
            p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.22))
        }, with: .color(.black.opacity(0.15)), lineWidth: 0.8)
    }
}
