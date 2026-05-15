import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress: () => void;
  badge?: string;
  danger?: boolean;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const avatarInitials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "AP";

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Account",
      items: [
        {
          id: "wallet",
          label: "My Wallet",
          icon: "wallet-outline",
          iconColor: "#10B981",
          onPress: () => {},
          badge: "TZS 0",
        },
        {
          id: "referrals",
          label: "Refer & Earn",
          icon: "gift-outline",
          iconColor: "#FFD166",
          onPress: () => {},
          badge: user?.referralCode ?? undefined,
        },
        {
          id: "bookings",
          label: "My Bookings",
          icon: "calendar-outline",
          iconColor: "#8B5CF6",
          onPress: () => router.push("/(tabs)/bookings"),
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          id: "notifications",
          label: "Notifications",
          icon: "notifications-outline",
          iconColor: colors.primary,
          onPress: () => {},
        },
        {
          id: "privacy",
          label: "Privacy & Security",
          icon: "shield-outline",
          iconColor: "#1E3A5F",
          onPress: () => {},
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          label: "Help Center",
          icon: "help-circle-outline",
          iconColor: colors.mutedForeground,
          onPress: () => {},
        },
        {
          id: "terms",
          label: "Terms of Service",
          icon: "document-text-outline",
          iconColor: colors.mutedForeground,
          onPress: () => {},
        },
        {
          id: "about",
          label: "About AlloPlan",
          icon: "information-circle-outline",
          iconColor: colors.mutedForeground,
          onPress: () => {},
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100,
      }}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.navy,
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
          },
        ]}
      >
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary, borderRadius: 40 }]}>
            <Text style={[styles.avatarText, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
              {avatarInitials}
            </Text>
          </View>
          <TouchableOpacity style={[styles.editBtn, { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20 }]}>
            <Ionicons name="pencil" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.userName, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
          {user?.name ?? "AlloPlan User"}
        </Text>
        <Text style={[styles.userEmail, { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular" }]}>
          {user?.email}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20 }]}>
          <Ionicons
            name={user?.role === "vendor" ? "briefcase" : "people"}
            size={12}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={[styles.roleText, { color: "rgba(255,255,255,0.8)", fontFamily: "Poppins_500Medium" }]}>
            {user?.role === "vendor" ? "Vendor" : "Customer"}
          </Text>
        </View>
      </View>

      {/* Referral code card */}
      {user?.referralCode && (
        <View style={[styles.referralCard, { backgroundColor: colors.accent + "18", borderRadius: colors.radius, borderColor: colors.accent + "40", margin: 16, borderWidth: 1 }]}>
          <Ionicons name="gift" size={20} color={colors.accent} />
          <View style={styles.referralContent}>
            <Text style={[styles.referralLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Your Referral Code
            </Text>
            <Text style={[styles.referralCode, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              {user.referralCode}
            </Text>
          </View>
          <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.accent + "33", borderRadius: 8 }]}>
            <Ionicons name="share-social-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {/* Menu sections */}
      {menuSections.map((section) => (
        <View key={section.title} style={[styles.section, { marginTop: 8 }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
            {section.title.toUpperCase()}
          </Text>
          <View style={[styles.menuCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            {section.items.map((item, idx) => (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  onPress={item.onPress}
                  testID={`menu-${item.id}`}
                  style={styles.menuItem}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: (item.iconColor ?? colors.primary) + "18", borderRadius: 10 }]}>
                    <Ionicons name={item.icon} size={20} color={item.iconColor ?? colors.primary} />
                  </View>
                  <Text style={[styles.menuLabel, { color: item.danger ? colors.destructive : colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                    {item.label}
                  </Text>
                  <View style={styles.menuRight}>
                    {item.badge && (
                      <View style={[styles.badge, { backgroundColor: colors.primary + "18", borderRadius: 6 }]}>
                        <Text style={[styles.badgeText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                          {item.badge}
                        </Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
                {idx < section.items.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}

      {/* Sign out */}
      <View style={[styles.section, { marginTop: 16 }]}>
        <TouchableOpacity
          onPress={handleLogout}
          testID="logout-btn"
          style={[styles.logoutBtn, { backgroundColor: colors.destructive + "12", borderRadius: colors.radius, borderColor: colors.destructive + "30" }]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive, fontFamily: "Poppins_600SemiBold" }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
        AlloPlan v1.0.0 — The OS for Events
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 28, alignItems: "center", gap: 8 },
  avatarRow: { position: "relative", marginBottom: 4 },
  avatar: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 30 },
  editBtn: { position: "absolute", bottom: 0, right: -4, width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 22 },
  userEmail: { fontSize: 14 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 },
  roleText: { fontSize: 12 },
  referralCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  referralContent: { flex: 1 },
  referralLabel: { fontSize: 11 },
  referralCode: { fontSize: 18, letterSpacing: 2 },
  shareBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 11, letterSpacing: 1 },
  menuCard: { borderWidth: 1 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  menuIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11 },
  divider: { height: 1, marginLeft: 68 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderWidth: 1 },
  logoutText: { fontSize: 15 },
  version: { textAlign: "center", fontSize: 12, marginTop: 16, marginBottom: 8 },
});
