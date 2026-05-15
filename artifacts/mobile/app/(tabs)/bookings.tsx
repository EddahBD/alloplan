import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: number;
  bookingRef: string;
  customerId: number;
  vendorId: number;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  totalAmount: number;
  platformFee?: number | null;
  escrowStatus: "held" | "released" | "refunded";
  eventDate?: string | null;
  eventLocation?: string | null;
  createdAt: string;
  customerName?: string;
  vendorName?: string;
  serviceName?: string;
  packageName?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#10B981",
  in_progress: "#3B82F6",
  completed: "#8B5CF6",
  cancelled: "#EF4444",
};

const STATUS_ICONS: Record<string, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  pending: "time-outline",
  confirmed: "checkmark-circle-outline",
  in_progress: "play-circle-outline",
  completed: "star-outline",
  cancelled: "close-circle-outline",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TABS = ["Upcoming", "Completed", "Cancelled"];

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  isVendor,
  colors,
}: {
  booking: Booking;
  isVendor: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const statusColor = STATUS_COLORS[booking.status] ?? colors.mutedForeground;
  const statusIcon = STATUS_ICONS[booking.status] ?? "help-circle-outline";
  const statusLabel = STATUS_LABELS[booking.status] ?? booking.status;

  const displayName = isVendor ? booking.customerName : booking.vendorName;
  const serviceLabel = booking.packageName ?? booking.serviceName ?? "Service Booking";

  return (
    <TouchableOpacity
      testID={`booking-card-${booking.id}`}
      onPress={() => router.push(`/booking/${booking.id}` as never)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      {/* Top row: ref + status */}
      <View style={styles.cardTop}>
        <Text style={[styles.bookingRef, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
          {booking.bookingRef}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <Ionicons name={statusIcon} size={12} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor, fontFamily: "Poppins_600SemiBold" }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Details */}
      {displayName && (
        <Text style={[styles.vendorName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          {displayName}
        </Text>
      )}
      <Text style={[styles.serviceLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
        {serviceLabel}
      </Text>

      {/* Date + amount */}
      <View style={styles.cardMeta}>
        {booking.eventDate && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {new Date(booking.eventDate).toLocaleDateString("en-TZ", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="cash-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            TZS {booking.totalAmount.toLocaleString()}
          </Text>
        </View>
        {booking.escrowStatus === "held" && (
          <View style={styles.metaItem}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.primary, fontFamily: "Poppins_400Regular" }]}>
              Escrow
            </Text>
          </View>
        )}
      </View>

      {/* Action hint for pending vendor bookings */}
      {booking.status === "pending" && isVendor && (
        <View style={[styles.actionHint, { backgroundColor: "#F59E0B15", borderRadius: 6 }]}>
          <Ionicons name="notifications-outline" size={12} color="#F59E0B" />
          <Text style={[{ color: "#F59E0B", fontFamily: "Poppins_400Regular", fontSize: 12 }]}>
            Action required — Accept or Decline
          </Text>
        </View>
      )}

      {/* Confirm completion hint */}
      {booking.status === "completed" && !isVendor && booking.escrowStatus === "held" && (
        <View style={[styles.actionHint, { backgroundColor: "#8B5CF615", borderRadius: 6 }]}>
          <Ionicons name="checkmark-circle-outline" size={12} color="#8B5CF6" />
          <Text style={[{ color: "#8B5CF6", fontFamily: "Poppins_400Regular", fontSize: 12 }]}>
            Please confirm completion to release payment
          </Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";

  const [activeTab, setActiveTab] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const statusGroupMap = ["upcoming", "completed", "cancelled"];

  const loadBookings = useCallback(async () => {
    try {
      const endpoint = isVendor ? "/bookings/vendor" : "/bookings/my";
      const data = await apiRequest<{ bookings: Booking[] }>(
        `${endpoint}?statusGroup=${statusGroupMap[activeTab]}`
      );
      setBookings(data.bookings ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [isVendor, activeTab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadBookings();
    }, [loadBookings])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

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
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            {isVendor ? "Booking Requests" : "My Bookings"}
          </Text>
          {pendingCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { fontFamily: "Poppins_700Bold" }]}>{pendingCount}</Text>
            </View>
          )}
        </View>

        {/* Tab switcher */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted, borderRadius: 12 }]}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              testID={`tab-${tab.toLowerCase().replace(" ", "-")}`}
              onPress={() => {
                setActiveTab(i);
                setLoading(true);
              }}
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

      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : bookings.length === 0 ? (
          <EmptyState tab={activeTab} isVendor={isVendor} colors={colors} />
        ) : (
          <View style={styles.list}>
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} isVendor={isVendor} colors={colors} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({
  tab,
  isVendor,
  colors,
}: {
  tab: number;
  isVendor: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const icons = ["calendar-outline", "checkmark-circle-outline", "close-circle-outline"] as const;
  const titles = ["No Upcoming Bookings", "No Completed Bookings", "No Cancelled Bookings"];
  const messages = [
    isVendor
      ? "Booking requests from customers will appear here once they book your services."
      : "You haven't made any bookings yet. Browse vendors and book your event services.",
    isVendor
      ? "Completed and paid-out bookings will appear here."
      : "Your completed bookings will appear here after services are delivered.",
    "Cancelled bookings will appear here.",
  ];

  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: colors.secondary, borderRadius: 50 }]}>
        <Ionicons name={icons[tab]} size={48} color={colors.primary} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
        {titles[tab]}
      </Text>
      <Text style={[emptyStyles.message, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
        {messages[tab]}
      </Text>
      {tab === 0 && !isVendor && (
        <TouchableOpacity
          testID="browse-vendors-btn"
          onPress={() => router.push("/(tabs)/marketplace" as never)}
          style={[emptyStyles.btn, { backgroundColor: colors.primary, borderRadius: 12 }]}
        >
          <Ionicons name="storefront-outline" size={18} color="#fff" />
          <Text style={[emptyStyles.btnText, { fontFamily: "Poppins_600SemiBold" }]}>Browse Vendors</Text>
        </TouchableOpacity>
      )}

      {tab === 0 && !isVendor && (
        <View style={[emptyStyles.howItWorks, { backgroundColor: colors.card, borderRadius: 16, borderColor: colors.border }]}>
          <Text style={[emptyStyles.howTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            How Bookings Work
          </Text>
          {[
            { icon: "storefront-outline" as const, text: "Choose a vendor and select a service package" },
            { icon: "shield-checkmark-outline" as const, text: "Pay securely — funds held in escrow until completion" },
            { icon: "checkmark-circle-outline" as const, text: "Vendor delivers the service on your event day" },
            { icon: "cash-outline" as const, text: "Confirm completion and vendor gets paid" },
          ].map((item, i) => (
            <View key={i} style={emptyStyles.stepRow}>
              <View style={[emptyStyles.stepIcon, { backgroundColor: colors.primary + "15", borderRadius: 8 }]}>
                <Ionicons name={item.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[emptyStyles.stepText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: "center", gap: 16, paddingTop: 32 },
  iconWrap: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20 },
  message: { fontSize: 14, lineHeight: 22, textAlign: "center" },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, marginTop: 4 },
  btnText: { color: "#fff", fontSize: 15 },
  howItWorks: { width: "100%", padding: 20, gap: 12, borderWidth: 1, marginTop: 8 },
  howTitle: { fontSize: 16, marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 11 },
  tabRow: { flexDirection: "row", padding: 4, gap: 2 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tabText: { fontSize: 13 },
  scrollContent: { padding: 16, flexGrow: 1 },
  centerLoader: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  list: { gap: 12 },
  card: { padding: 16, borderWidth: 1, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bookingRef: { fontSize: 13 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11 },
  vendorName: { fontSize: 16, marginTop: 2 },
  serviceLabel: { fontSize: 13 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  actionHint: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, marginTop: 4 },
  chevron: { position: "absolute", right: 16, top: "50%" },
});
