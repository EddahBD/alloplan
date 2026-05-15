import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
  serviceId?: number | null;
  packageId?: number | null;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  totalAmount: number;
  platformFee?: number | null;
  vendorAmount?: number | null;
  escrowStatus: "held" | "released" | "refunded";
  eventDate?: string | null;
  eventLocation?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  counterProposedDate?: string | null;
  counterProposedNote?: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  vendorName?: string;
  serviceName?: string;
  packageName?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  Booking["status"],
  { label: string; color: string; icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap; description: string }
> = {
  pending: {
    label: "Pending",
    color: "#F59E0B",
    icon: "time-outline",
    description: "Waiting for vendor to accept your booking",
  },
  confirmed: {
    label: "Confirmed",
    color: "#10B981",
    icon: "checkmark-circle-outline",
    description: "Vendor has accepted — get ready for your event!",
  },
  in_progress: {
    label: "In Progress",
    color: "#3B82F6",
    icon: "play-circle-outline",
    description: "Service is currently being delivered",
  },
  completed: {
    label: "Completed",
    color: "#8B5CF6",
    icon: "star-outline",
    description: "Service delivered — please confirm to release payment",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    icon: "close-circle-outline",
    description: "This booking has been cancelled",
  },
};

const STATUS_ORDER: Booking["status"][] = [
  "pending", "confirmed", "in_progress", "completed",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = parseInt(id ?? "0");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [vendorProfileId, setVendorProfileId] = useState<number | null>(null);

  // Counter-proposal modal state (vendor side)
  const [proposeModalVisible, setProposeModalVisible] = useState(false);
  const [proposedDateInput, setProposedDateInput] = useState("");
  const [proposedNoteInput, setProposedNoteInput] = useState("");
  const [proposeLoading, setProposeLoading] = useState(false);

  const loadBooking = useCallback(async () => {
    try {
      const data = await apiRequest<Booking>(`/bookings/${bookingId}`);
      setBooking(data);
    } catch (e) {
      Alert.alert("Error", "Failed to load booking");
      router.back();
    }
  }, [bookingId]);

  const loadVendorProfileId = useCallback(async () => {
    if (user?.role !== "vendor") return;
    try {
      const profile = await apiRequest<{ id: number }>("/vendors/my-profile");
      setVendorProfileId(profile.id);
    } catch {}
  }, [user?.role]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadBooking(), loadVendorProfileId()]);
      setLoading(false);
    };
    init();
  }, [loadBooking, loadVendorProfileId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBooking();
    setRefreshing(false);
  };

  const patchStatus = async (status: string, reason?: string) => {
    if (!booking) return;
    setActionLoading(true);
    try {
      await apiRequest(`/bookings/${booking.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      await loadBooking();
    } catch (e: unknown) {
      Alert.alert("Action failed", e instanceof Error ? e.message : "Please try again");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelBooking = () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel? A full refund will be issued to your wallet.",
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiRequest(`/bookings/${booking!.id}/cancel`, {
                method: "POST",
                body: JSON.stringify({ reason: "Cancelled by customer" }),
              });
              await loadBooking();
            } catch (e: unknown) {
              Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const confirmCompletion = () => {
    Alert.alert(
      "Confirm Service Completion",
      "Are you satisfied with the service? This will release the payment to the vendor.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Yes, Release Payment", onPress: () => patchStatus("completed") },
      ]
    );
  };

  const submitProposal = async () => {
    if (!proposedDateInput.trim()) {
      Alert.alert("Date required", "Please enter a date for your proposal.");
      return;
    }
    const parsed = new Date(proposedDateInput.trim());
    if (isNaN(parsed.getTime())) {
      Alert.alert("Invalid date", "Please use format: YYYY-MM-DD");
      return;
    }
    setProposeLoading(true);
    try {
      await apiRequest(`/bookings/${booking!.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "counter_proposed",
          proposedDate: parsed.toISOString(),
          proposalNote: proposedNoteInput.trim() || undefined,
        }),
      });
      setProposeModalVisible(false);
      setProposedDateInput("");
      setProposedNoteInput("");
      await loadBooking();
    } catch (e: unknown) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setProposeLoading(false);
    }
  };

  const acceptProposal = () => {
    Alert.alert(
      "Accept New Date",
      `Accept the vendor's proposed date?\n${booking?.counterProposedDate ? new Date(booking.counterProposedDate).toLocaleDateString("en-TZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiRequest(`/bookings/${booking!.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "accept_proposal" }),
              });
              await loadBooking();
            } catch (e: unknown) {
              Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const declineProposal = () => {
    Alert.alert(
      "Decline Proposed Date",
      "Decline the vendor's alternative date? The original event date will remain unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiRequest(`/bookings/${booking!.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "decline_proposal" }),
              });
              await loadBooking();
            } catch (e: unknown) {
              Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) return null;

  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const isCustomer = booking.customerId === user?.id;
  const isVendor = vendorProfileId !== null && booking.vendorId === vendorProfileId;
  const currentStepIndex = STATUS_ORDER.indexOf(booking.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Booking Details
          </Text>
          <Text style={[styles.headerRef, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
            {booking.bookingRef}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 34 + 120 : insets.bottom + 120 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Status badge */}
        <View style={[styles.statusCard, { backgroundColor: cfg.color + "15", borderColor: cfg.color + "40", borderRadius: colors.radius }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: cfg.color + "25" }]}>
            <Ionicons name={cfg.icon} size={28} color={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: cfg.color, fontFamily: "Poppins_700Bold" }]}>
              {cfg.label}
            </Text>
            <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {cfg.description}
            </Text>
          </View>
        </View>

        {/* Status Timeline */}
        {booking.status !== "cancelled" && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Booking Progress
            </Text>
            {STATUS_ORDER.map((st, i) => {
              const c = STATUS_CONFIG[st];
              const isDone = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <View key={st} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: isDone ? c.color : colors.muted,
                          borderColor: isCurrent ? c.color : "transparent",
                        },
                      ]}
                    >
                      {isDone && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                    {i < STATUS_ORDER.length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: i < currentStepIndex ? c.color : colors.border }]} />
                    )}
                  </View>
                  <View style={[styles.timelineContent, { paddingBottom: i < STATUS_ORDER.length - 1 ? 20 : 0 }]}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        {
                          color: isDone ? colors.foreground : colors.mutedForeground,
                          fontFamily: isCurrent ? "Poppins_600SemiBold" : "Poppins_400Regular",
                        },
                      ]}
                    >
                      {c.label}
                    </Text>
                    {isCurrent && (
                      <Text style={[styles.timelineDesc, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {c.description}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Booking Info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            Booking Info
          </Text>
          {isCustomer && booking.vendorName && (
            <InfoRow label="Vendor" value={booking.vendorName} colors={colors} />
          )}
          {isVendor && booking.customerName && (
            <InfoRow label="Customer" value={booking.customerName} colors={colors} />
          )}
          {booking.serviceName && <InfoRow label="Service" value={booking.serviceName} colors={colors} />}
          {booking.packageName && <InfoRow label="Package" value={booking.packageName} colors={colors} />}
          {booking.eventDate && (
            <InfoRow
              label="Event Date"
              value={new Date(booking.eventDate).toLocaleDateString("en-TZ", { day: "numeric", month: "long", year: "numeric" })}
              colors={colors}
            />
          )}
          {booking.eventLocation && <InfoRow label="Location" value={booking.eventLocation} colors={colors} />}
          {booking.notes && <InfoRow label="Special Requests" value={booking.notes} colors={colors} />}
          <InfoRow
            label="Booked On"
            value={new Date(booking.createdAt).toLocaleDateString("en-TZ", { day: "numeric", month: "short", year: "numeric" })}
            colors={colors}
          />
        </View>

        {/* Payment Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            Payment Breakdown
          </Text>
          <InfoRow label="Total Amount" value={`TZS ${booking.totalAmount.toLocaleString()}`} colors={colors} />
          {booking.platformFee != null && (
            <InfoRow label="Platform Fee (5%)" value={`TZS ${booking.platformFee.toLocaleString()}`} colors={colors} muted />
          )}
          {booking.vendorAmount != null && (
            <InfoRow label={isVendor ? "You Receive" : "Vendor Receives"} value={`TZS ${booking.vendorAmount.toLocaleString()}`} colors={colors} muted />
          )}
          <View style={[styles.escrowRow, { backgroundColor: booking.escrowStatus === "released" ? "#10B98115" : booking.escrowStatus === "refunded" ? "#EF444415" : colors.primary + "10", borderRadius: 8 }]}>
            <Ionicons
              name={booking.escrowStatus === "released" ? "checkmark-circle" : booking.escrowStatus === "refunded" ? "arrow-undo-circle" : "shield-checkmark"}
              size={16}
              color={booking.escrowStatus === "released" ? "#10B981" : booking.escrowStatus === "refunded" ? "#EF4444" : colors.primary}
            />
            <Text style={[styles.escrowLabel, { color: booking.escrowStatus === "released" ? "#10B981" : booking.escrowStatus === "refunded" ? "#EF4444" : colors.primary, fontFamily: "Poppins_500Medium" }]}>
              Escrow: {booking.escrowStatus === "held" ? "Funds Held Securely" : booking.escrowStatus === "released" ? "Payment Released to Vendor" : "Refunded to Customer"}
            </Text>
          </View>
        </View>

        {/* Cancellation reason */}
        {booking.cancellationReason && (
          <View style={[styles.card, { backgroundColor: "#EF444410", borderColor: "#EF444430", borderRadius: colors.radius }]}>
            <Text style={[styles.cardTitle, { color: "#EF4444", fontFamily: "Poppins_600SemiBold" }]}>
              Cancellation Reason
            </Text>
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 14 }]}>
              {booking.cancellationReason}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      {booking.status !== "cancelled" && (booking.escrowStatus !== "released") && (
        <View style={[styles.actionBar, { borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12 }]}>
          {/* Customer actions */}
          {isCustomer && booking.status === "pending" && (
            <TouchableOpacity
              testID="cancel-booking-btn"
              onPress={cancelBooking}
              disabled={actionLoading}
              style={[styles.dangerBtn, { borderColor: "#EF4444", borderRadius: colors.radius }]}
            >
              {actionLoading ? <ActivityIndicator color="#EF4444" /> : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={[styles.dangerBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isCustomer && booking.status === "confirmed" && (
            <TouchableOpacity
              onPress={cancelBooking}
              disabled={actionLoading}
              style={[styles.dangerBtn, { borderColor: "#EF4444", borderRadius: colors.radius }]}
            >
              {actionLoading ? <ActivityIndicator color="#EF4444" /> : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={[styles.dangerBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isCustomer && booking.status === "completed" && booking.escrowStatus === "held" && (
            <TouchableOpacity
              testID="confirm-completion-btn"
              onPress={confirmCompletion}
              disabled={actionLoading}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Confirm & Release Payment</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Vendor actions */}
          {isVendor && booking.status === "pending" && (
            <View style={styles.vendorActions}>
              <TouchableOpacity
                testID="reject-booking-btn"
                onPress={() =>
                  Alert.alert("Decline Booking", "Are you sure you want to decline?", [
                    { text: "No" },
                    { text: "Decline", style: "destructive", onPress: () => patchStatus("cancelled", "Vendor declined") },
                  ])
                }
                disabled={actionLoading}
                style={[styles.dangerBtn, { borderColor: "#EF4444", borderRadius: colors.radius, flex: 1 }]}
              >
                <Ionicons name="close-outline" size={18} color="#EF4444" />
                <Text style={[styles.dangerBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="accept-booking-btn"
                onPress={() => patchStatus("confirmed")}
                disabled={actionLoading}
                style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, flex: 1 }]}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark-outline" size={18} color="#fff" />
                    <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isVendor && booking.status === "confirmed" && (
            <TouchableOpacity
              testID="start-service-btn"
              onPress={() => patchStatus("in_progress")}
              disabled={actionLoading}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="play-circle-outline" size={18} color="#fff" />
                  <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Mark as Started</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isVendor && booking.status === "in_progress" && (
            <TouchableOpacity
              testID="complete-service-btn"
              onPress={() =>
                Alert.alert("Mark as Completed", "Confirm that you have delivered the service?", [
                  { text: "Not yet" },
                  { text: "Yes, Completed", onPress: () => patchStatus("completed") },
                ])
              }
              disabled={actionLoading}
              style={[styles.primaryBtn, { backgroundColor: "#10B981", borderRadius: colors.radius }]}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                  <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Mark Service Completed</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value, colors, muted }: { label: string; value: string; colors: ReturnType<typeof useColors>; muted?: boolean }) {
  return (
    <View style={irStyles.row}>
      <Text style={[irStyles.label, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{label}</Text>
      <Text style={[irStyles.value, { color: muted ? colors.mutedForeground : colors.foreground, fontFamily: "Poppins_500Medium" }]}>
        {value}
      </Text>
    </View>
  );
}

const irStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 8 },
  label: { fontSize: 13, flex: 1 },
  value: { fontSize: 13, flex: 1.2, textAlign: "right" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18 },
  headerRef: { fontSize: 13, marginTop: 1 },
  content: { padding: 16, gap: 14 },
  statusCard: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 14, borderWidth: 1 },
  statusIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 18 },
  statusDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  card: { padding: 16, borderWidth: 1, gap: 2 },
  cardTitle: { fontSize: 15, marginBottom: 8 },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineLeft: { alignItems: "center", width: 22 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  timelineLine: { flex: 1, width: 2, marginTop: 3 },
  timelineContent: { flex: 1, paddingTop: 1 },
  timelineLabel: { fontSize: 14 },
  timelineDesc: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  escrowRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, marginTop: 8 },
  escrowLabel: { fontSize: 13 },
  actionBar: { padding: 16, borderTopWidth: 1 },
  vendorActions: { flexDirection: "row", gap: 12 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  primaryBtnText: { color: "#fff", fontSize: 15 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1.5 },
  dangerBtnText: { color: "#EF4444", fontSize: 15 },
});
