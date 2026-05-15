import { useEffect } from "react";
import { router } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { isLoading, isAuthenticated, hasOnboarded } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace("/(tabs)");
    } else if (!hasOnboarded) {
      router.replace("/(auth)/onboarding");
    } else {
      router.replace("/(auth)/login");
    }
  }, [isLoading, isAuthenticated, hasOnboarded]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
