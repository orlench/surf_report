import Foundation

/// Reads a Server-Sent Events stream from the backend /conditions/:id/stream endpoint.
/// Calls the provided handlers on the main actor as events arrive.
actor SSEClient {
    private var task: URLSessionDataTask?

    func start(
        url: URL,
        onStart: @escaping (SSEStartEvent) -> Void,
        onProgress: @escaping (SSEProgressEvent) -> Void,
        onComplete: @escaping (ConditionsResponse) -> Void,
        onError: @escaping (String) -> Void
    ) {
        stop()

        var request = URLRequest(url: url)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 120

        let handler = SSEStreamHandler(
            onStart: onStart,
            onProgress: onProgress,
            onComplete: onComplete,
            onError: onError
        )

        let session = URLSession(configuration: .default, delegate: handler, delegateQueue: nil)
        let t = session.dataTask(with: request)
        task = t
        t.resume()
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}

// MARK: - Delegate

private class SSEStreamHandler: NSObject, URLSessionDataDelegate {
    private var buffer = ""
    private var receivedComplete = false
    private let onStart: (SSEStartEvent) -> Void
    private let onProgress: (SSEProgressEvent) -> Void
    private let onComplete: (ConditionsResponse) -> Void
    private let onError: (String) -> Void

    init(
        onStart: @escaping (SSEStartEvent) -> Void,
        onProgress: @escaping (SSEProgressEvent) -> Void,
        onComplete: @escaping (ConditionsResponse) -> Void,
        onError: @escaping (String) -> Void
    ) {
        self.onStart = onStart
        self.onProgress = onProgress
        self.onComplete = onComplete
        self.onError = onError
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        buffer += text

        while let range = buffer.range(of: "\n\n") {
            let message = String(buffer[buffer.startIndex..<range.lowerBound])
            buffer = String(buffer[range.upperBound...])
            parseMessage(message)
        }
    }

    private func parseMessage(_ message: String) {
        var eventType: String?
        var dataLine: String?

        for line in message.components(separatedBy: "\n") {
            if line.hasPrefix("event:") {
                eventType = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                dataLine = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            }
        }

        guard let json = dataLine, let data = json.data(using: .utf8) else { return }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        switch eventType {
        case "start":
            if let event = try? decoder.decode(SSEStartEvent.self, from: data) {
                DispatchQueue.main.async { self.onStart(event) }
            }
        case "progress":
            if let event = try? decoder.decode(SSEProgressEvent.self, from: data) {
                DispatchQueue.main.async { self.onProgress(event) }
            }
        case "complete":
            receivedComplete = true
            if let response = try? decoder.decode(ConditionsResponse.self, from: data) {
                DispatchQueue.main.async { self.onComplete(response) }
            } else {
                DispatchQueue.main.async { self.onError("Failed to decode response") }
            }
        case "error":
            let msg = (try? decoder.decode([String: String].self, from: data))?["message"] ?? "Stream error"
            DispatchQueue.main.async { self.onError(msg) }
        default:
            break
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error {
            if (error as NSError).code != NSURLErrorCancelled {
                DispatchQueue.main.async { self.onError(error.localizedDescription) }
            }
        } else if !receivedComplete {
            // Stream closed cleanly but never sent "complete" — trigger REST fallback
            DispatchQueue.main.async { self.onError("Stream ended without data") }
        }
    }
}
