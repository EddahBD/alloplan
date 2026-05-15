import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const TABS = ["Upcoming", "Completed", "Cancelled"];

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          My Bookings
        </Text>

        {/* Tab switcher */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted, borderRadius: 12 }]}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              testID={`tab-${tab.toLowerCase()}`}
              onPress={() => setActiveTab(i)}
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === i ? colors.card : "transparent",
                  borderRadius: 10,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === i ? colors.primary : colors.mutedForeground,
                    fontFamily: activeTab === i ? "Poppins_600SemiBold" : "Poppins_400Regular",
                  },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Empty state */}
      <ScrollView
        contentContainerStyle={[
          styles.emptyContainer,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
      >
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary, borderRadius: 50 }]}>
            <Ionicons
              name={
                activeTab === 0
                  ? "calendar-outline"
                  : activeTab === 1
                  ? "checkmark-circle-outline"
                  : "close-circle-outline"
              }
              size={48}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            No {TABS[activeTab]} Bookings
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {activeTab === 0
              ? "You haven't made any bookings yet. Browse vendors and start planning your event."
              : activeTab === 1
              ? "Your completed bookings will appear here once services have been delivered."
              : "Cancelled bookings will appear here."}
          </Text>
          {activeTab === 0 && (
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={() => router.push("/(tabs)/marketplace")}
              testID="browse-vendors-btn"
            >
              <Ionicons name="storefront-outline" size={18} color="#fff" />
              <Text style={[styles.browseBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                Browse Vendors
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* How it works */}
        {activeTab === 0 && (
          <View style={[styles.howItWorks, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.howTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              How Bookings Work
            </Text>
            {[
              { step: "1", text: "Choose a vendor and select a service package", icon: "storefront-outline" as const },
              { step: "2", text: "Pay securely — funds held in escrow until completion", icon: "shield-checkmark-outline" as const },
              { step: "3", text: "Vendor delivers the service on your event day", icon: "checkmark-circle-outline" as const },
              { step: "4", text: "Confirm completion and vendor gets paid", icon: "cash-outline" as const },
            ].map((item) => (
              <View key={item.step} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}>
                  <Ionicons name={item.icon} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.stepText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { fontSize: 26 },
  tabRow: { flexDirection: "row", padding: 4, gap: 2 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tabText: { fontSize: 13 },
  emptyContainer: { flexGrow: 1, padding: 24, gap: 20 },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 20 },
  emptyIcon: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: "center" },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  browseBtnText: { fontSize: 15 },
  howItWorks: { padding: 20, gap: 14, borderWidth: 1 },
  howTitle: { fontSize: 16, marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
