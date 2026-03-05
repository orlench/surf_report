import SwiftUI

struct FetchProgressView: View {
    let steps: [ProgressStep]
    let spotName: String

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 28) {
                Image(systemName: "water.waves")
                    .font(.system(size: 52))
                    .foregroundStyle(.blue)
                    .symbolEffect(.variableColor.cumulative)

                VStack(spacing: 6) {
                    Text("Checking conditions")
                        .font(.title3.bold())
                    Text(spotName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if !steps.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(steps) { step in
                            HStack(spacing: 12) {
                                stepIcon(step.status)
                                    .frame(width: 20, height: 20)
                                Text(step.name)
                                    .font(.subheadline)
                                    .foregroundStyle(step.status == .loading ? .secondary : .primary)
                                Spacer()
                            }
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                    }
                    .padding(.horizontal, 48)
                    .animation(.spring(duration: 0.3), value: steps.count)
                } else {
                    ProgressView().tint(.secondary)
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func stepIcon(_ status: StepStatus) -> some View {
        switch status {
        case .loading:
            ProgressView().scaleEffect(0.75).tint(.blue)
        case .success:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .transition(.scale.combined(with: .opacity))
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.orange)
        }
    }
}
