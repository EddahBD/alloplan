import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

export default function RoleSelectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedRole, setSelectedRole } = useAuth();

  const roles: Array<{
    id: "customer" | "vendor" | "admin";
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    subtitle: string;
    badge: string;
  }> = [
    {
      id: "customer",
      icon: "people",
      title: "I'm Planning an Event",
      subtitle: "Find vendors, book services, and plan the perfect event with AI assistance",
      badge: "Customer",
    },
    {
      id: "vendor",
      icon: "briefcase",
      title: "I'm a Service Provider",
      subtitle: "List your services, receive bookings, and grow your event business",
      badge: "Vendor",
    },
    {
      id: "admin",
      icon: "shield-checkmark",
      title: "Platform Administrator",
      subtitle: "Manage users, vendors, payments, and platform-wide settings",
      badge: "Admin",
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? 67 : insets.top + 24,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoText, { fontFamily: "Poppins_700Bold" }]}>A</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          How will you use{"\n"}AlloPlan?
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
          Choose your role — you can always switch later
        </Text>
      </View>

      <View style={styles.cards}>
        {roles.map((role) => {
          const selected = selectedRole === role.id;
          return (
            <TouchableOpacity
              key={role.id}
              testID={`role-${role.id}`}
              activeOpacity={0.85}
              onPress={() => setSelectedRole(role.id)}
              style={[
                styles.roleCard,
                {
                  borderRadius: colors.radius,
                  backgroundColor: selected ? colors.secondary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: selected ? 2 : 1.5,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: selected ? colors.primary : colors.muted, borderRadius: colors.radius }]}>
                <Ionicons name={role.icon} size={28} color={selected ? "#fff" : colors.mutedForeground} />
              </View>
              <View style={styles.roleText}>
                <View style={styles.roleTitleRow}>
                  <Text style={[styles.roleTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                    {role.title}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </View>
                <Text style={[styles.roleSubtitle, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  {role.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button
          title="Continue"
          onPress={() => router.push("/(auth)/register")}
          size="lg"
          style={{ width: "100%" }}
          testID="role-continue"
        />
        <TouchableOpacity onPress={() => router.push("/(auth)/login")} testID="go-to-login">
          <Text style={[styles.loginLink, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Already have an account?{" "}
            <Text style={[{ color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { alignItems: "center", gap: 12, marginBottom: 36 },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 32, color: "#fff" },
  title: { fontSize: 28, textAlign: "center", lineHeight: 38 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  cards: { gap: 16, flex: 1 },
  roleCard: {
    padding: 20,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  iconWrap: { padding: 14 },
  roleText: { flex: 1, gap: 6 },
  roleTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roleTitle: { fontSize: 16, flex: 1 },
  roleSubtitle: { fontSize: 13, lineHeight: 20 },
  actions: { gap: 16, alignItems: "center", marginTop: 24 },
  loginLink: { fontSize: 14 },
});
