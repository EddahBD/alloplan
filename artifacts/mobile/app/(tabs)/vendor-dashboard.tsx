import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text, fontFamily: "Poppins_700Bold" }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
        {label}
      </Text>
    </View>
  );
}

export default function VendorDashboardScreen() {
  const { user } = useAuth();
  const colors = useColors();

  const stats: StatCardProps[] = [
    { label: "Total Bookings", value: "0", icon: "calendar-outline", color: "#FF6B35" },
    { label: "Revenue (TZS)", value: "0", icon: "cash-outline", color: "#4CAF50" },
    { label: "Avg Rating", value: "—", icon: "star-outline", color: "#FFD166" },
    { label: "Active Services", value: "0", icon: "briefcase-outline", color: "#2196F3" },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Welcome back,
            </Text>
            <Text style={[styles.name, { color: colors.text, fontFamily: "Poppins_700Bold" }]}>
              {user?.name ?? "Vendor"}
            </Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Poppins_600SemiBold" }]}>
          Overview
        </Text>
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Poppins_600SemiBold" }]}>
          Recent Bookings
        </Text>
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            No bookings yet. Set up your services to start receiving orders.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Poppins_600SemiBold" }]}>
          Quick Actions
        </Text>
        {[
          { label: "Add a Service", icon: "briefcase-outline" as const },
          { label: "Manage Availability", icon: "time-outline" as const },
          { label: "View Reviews", icon: "star-outline" as const },
          { label: "Payout Settings", icon: "card-outline" as const },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name={action.icon} size={20} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.text, fontFamily: "Poppins_500Medium" }]}>
              {action.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 120 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: { fontSize: 13, marginBottom: 2 },
  name: { fontSize: 22 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, marginBottom: 12, marginTop: 4 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  actionLabel: { flex: 1, fontSize: 14 },
});
