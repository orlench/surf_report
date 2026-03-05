import UIKit
import UserNotifications

@MainActor
class PushManager: NSObject, ObservableObject {
    static let shared = PushManager()

    @Published var isRegistered = false
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private let tokenKey = "apns_device_token"

    var deviceToken: String? {
        KeychainHelper.load(forKey: tokenKey)
    }

    override private init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
        refreshAuthorizationStatus()
    }

    func refreshAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.authorizationStatus = settings.authorizationStatus
                self?.isRegistered = settings.authorizationStatus == .authorized
            }
        }
    }

    func requestPermissionAndRegister() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            await MainActor.run { refreshAuthorizationStatus() }
            return granted
        } catch {
            return false
        }
    }

    func storeToken(_ tokenData: Data) {
        let token = tokenData.map { String(format: "%02.2hhx", $0) }.joined()
        KeychainHelper.save(token, forKey: tokenKey)
        isRegistered = true
    }
}

extension PushManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is foregrounded
        completionHandler([.banner, .sound, .badge])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Handle notification tap — post to NotificationCenter for the app to handle
        let userInfo = response.notification.request.content.userInfo
        NotificationCenter.default.post(name: .pushNotificationTapped, object: nil, userInfo: userInfo)
        completionHandler()
    }
}

extension Notification.Name {
    static let pushNotificationTapped = Notification.Name("pushNotificationTapped")
}
