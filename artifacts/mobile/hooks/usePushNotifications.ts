import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

async function requestPermissionAndGetToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

async function registerTokenWithBackend(
  token: string,
  authToken: string,
  baseUrl: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/auth/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken: token }),
    });
  } catch {
    // Non-fatal: token registration failure should not break the app
  }
}

export function usePushNotifications(
  authToken: string | null,
  baseUrl: string
): void {
  useEffect(() => {
    if (!authToken) return;

    let active = true;

    requestPermissionAndGetToken()
      .then((pushToken) => {
        if (active && pushToken && authToken) {
          registerTokenWithBackend(pushToken, authToken, baseUrl);
        }
      })
      .catch(() => {
        // Non-fatal
      });

    return () => {
      active = false;
    };
  }, [authToken, baseUrl]);
}
