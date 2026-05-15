import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Package {
  id: number;
  serviceId: number;
  name: string;
  description?: string | null;
  price: number;
  inclusions: string[];
  durationHours?: number | null;
  isActive: boolean;
}

interface Service {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  basePrice: number;
  packages: Package[];
}

interface VendorInfo {
  id: number;
  businessName: string;
  location?: string | null;
  rating?: number | null;
  subscriptionTier: string;
}

interface WalletBalance {
  balance: number;
  pendingBalance: number;
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ["Package", "Date & Place", "Details", "Review & Pay"];

function StepBar({ current, total }: { current: number; total: number }) {
  const colors = useColors();
  return (
    <View style={stepBarStyles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            stepBarStyles.segment,
            { backgroundColor: i <= current ? colors.primary : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

const stepBarStyles = StyleSheet.create({
  container: { flexDirection: "row", gap: 4, marginTop: 8 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
});

// ─── Date Picker ──────────────────────────────────────────────────────────────

function SimpleDatePicker({
  value,
  onChange,
  colors,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const today = new Date();
  const [year, setYear] = useState(value?.getFullYear() ?? today.getFullYear());
  const [month, setMonth] = useState(value?.getMonth() ?? today.getMonth());
  const [day, setDay] = useState(value?.getDate() ?? today.getDate());

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);

  useEffect(() => {
    onChange(new Date(year, month, clampedDay));
  }, [year, month, clampedDay]);

  const nudge = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number,
    min: number,
    max: number
  ) => setter((v) => Math.max(min, Math.min(max, v + delta)));

  const counter = (
    label: string,
    val: number | string,
    onDec: () => void,
    onInc: () => void
  ) => (
    <View style={dpStyles.counter}>
      <Text style={[dpStyles.label, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
        {label}
      </Text>
      <View style={dpStyles.controls}>
        <TouchableOpacity onPress={onDec} style={[dpStyles.btn, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
          <Ionicons name="remove" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[dpStyles.val, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          {val}
        </Text>
        <TouchableOpacity onPress={onInc} style={[dpStyles.btn, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
          <Ionicons name="add" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[dpStyles.wrapper, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border }]}>
      {counter(
        "Day",
        clampedDay,
        () => nudge(setDay, -1, 1, daysInMonth),
        () => nudge(setDay, 1, 1, daysInMonth)
      )}
      {counter(
        "Month",
        MONTHS[month],
        () => nudge(setMonth, -1, 0, 11),
        () => nudge(setMonth, 1, 0, 11)
      )}
      {counter(
        "Year",
        year,
        () => nudge(setYear, -1, today.getFullYear(), 2035),
        () => nudge(setYear, 1, today.getFullYear(), 2035)
      )}
    </View>
  );
}

const dpStyles = StyleSheet.create({
  wrapper: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderWidth: 1 },
  counter: { alignItems: "center", flex: 1, gap: 8 },
  label: { fontSize: 12 },
  controls: { flexDirection: "row", alignItems: "center", gap: 10 },
  btn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  val: { fontSize: 15, minWidth: 40, textAlign: "center" },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookVendorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vendorId: vendorIdParam, packageId: packageIdParam, serviceId: serviceIdParam } = useLocalSearchParams<{
    vendorId: string;
    packageId?: string;
    serviceId?: string;
  }>();
  const vendorId = parseInt(vendorIdParam ?? "0");

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  // Data
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [walletBalance, setWalletBalance] = useState<WalletBalance>({ balance: 0, pendingBalance: 0 });
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("50000");

  // Booking state
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    serviceIdParam ? parseInt(serviceIdParam) : null
  );
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventLocation, setEventLocation] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [vendorData, servicesData, walletData] = await Promise.all([
        apiRequest<VendorInfo>(`/vendors/${vendorId}`),
        apiRequest<{ services: Service[] }>(`/vendors/${vendorId}/services`),
        apiRequest<WalletBalance>("/bookings/wallet/balance"),
      ]);
      setVendor(vendorData);
      setServices(servicesData.services ?? []);
      setWalletBalance(walletData);

      // Pre-select package if passed in URL
      if (packageIdParam) {
        const pkgId = parseInt(packageIdParam);
        for (const svc of servicesData.services ?? []) {
          const pkg = svc.packages.find((p) => p.id === pkgId);
          if (pkg) {
            setSelectedPackage(pkg);
            setSelectedServiceId(svc.id);
            break;
          }
        }
      }
    } catch (e) {
      Alert.alert("Error", "Failed to load vendor info. Please try again.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [vendorId, packageIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAmount = selectedPackage
    ? selectedPackage.price
    : parseFloat(customAmount) || 0;
  const platformFee = totalAmount * 0.05;
  const vendorAmount = totalAmount - platformFee;
  const hasEnoughBalance = walletBalance.balance >= totalAmount;

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid amount");
      return;
    }
    try {
      setToppingUp(true);
      const result = await apiRequest<{ balance: number }>("/bookings/wallet/top-up", {
        method: "POST",
        body: JSON.stringify({ amount: amt }),
      });
      setWalletBalance((prev) => ({ ...prev, balance: result.balance }));
      setShowTopUpModal(false);
      Alert.alert("Success", `TZS ${amt.toLocaleString()} added to your wallet!`);
    } catch (e: unknown) {
      Alert.alert("Top-up failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setToppingUp(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!totalAmount || totalAmount <= 0) {
      Alert.alert("Please enter a valid amount");
      return;
    }
    if (!hasEnoughBalance) {
      setShowTopUpModal(true);
      return;
    }
    try {
      setSubmitting(true);
      const booking = await apiRequest<{ id: number; bookingRef: string }>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          vendorId,
          serviceId: selectedServiceId,
          packageId: selectedPackage?.id,
          totalAmount: selectedPackage ? undefined : totalAmount,
          eventDate: eventDate?.toISOString(),
          eventLocation: eventLocation || undefined,
          notes: notes || undefined,
        }),
      });
      router.replace(`/booking/${booking.id}` as never);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      Alert.alert("Booking Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (step === 0) return selectedPackage !== null || parseFloat(customAmount) > 0;
    if (step === 1) return eventDate !== null;
    return true;
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => (step === 0 ? router.back() : setStep(step - 1))} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            Book {vendor?.businessName ?? "Vendor"}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </Text>
        </View>
      </View>

      <StepBar current={step} total={STEPS.length} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 0: Package Selection ── */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Select a Package
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Choose a service package from {vendor?.businessName}
            </Text>

            {services.length === 0 && (
              <View style={[styles.emptyBox, { borderColor: colors.border, borderRadius: colors.radius }]}>
                <Ionicons name="cube-outline" size={32} color={colors.mutedForeground} />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", marginTop: 8 }]}>
                  No packages available yet
                </Text>
              </View>
            )}

            {services.map((svc) => (
              <View key={svc.id}>
                <Text style={[styles.serviceLabel, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                  {svc.name}
                </Text>
                {svc.packages.filter((p) => p.isActive).map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    testID={`pkg-${pkg.id}`}
                    onPress={() => {
                      setSelectedPackage(pkg);
                      setSelectedServiceId(svc.id);
                      setCustomAmount("");
                    }}
                    style={[
                      styles.packageCard,
                      {
                        borderColor: selectedPackage?.id === pkg.id ? colors.primary : colors.border,
                        backgroundColor: selectedPackage?.id === pkg.id ? colors.primary + "10" : colors.card,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <View style={styles.packageTop}>
                      <Text style={[styles.packageName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                        {pkg.name}
                      </Text>
                      <Text style={[styles.packagePrice, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
                        TZS {pkg.price.toLocaleString()}
                      </Text>
                    </View>
                    {pkg.description && (
                      <Text style={[styles.packageDesc, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {pkg.description}
                      </Text>
                    )}
                    {pkg.inclusions.length > 0 && (
                      <View style={styles.inclusions}>
                        {pkg.inclusions.slice(0, 3).map((inc, i) => (
                          <View key={i} style={styles.inclusionRow}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                            <Text style={[styles.inclusionText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                              {inc}
                            </Text>
                          </View>
                        ))}
                        {pkg.inclusions.length > 3 && (
                          <Text style={[{ color: colors.primary, fontFamily: "Poppins_400Regular", fontSize: 12 }]}>
                            +{pkg.inclusions.length - 3} more
                          </Text>
                        )}
                      </View>
                    )}
                    {selectedPackage?.id === pkg.id && (
                      <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                        <Text style={[styles.selectedText, { fontFamily: "Poppins_600SemiBold" }]}>Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Custom amount fallback */}
            <View style={[styles.customBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
              <Text style={[styles.customLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                Or enter a custom amount
              </Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, fontFamily: "Poppins_400Regular" }]}
                placeholder="e.g. 150000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={(v) => {
                  setCustomAmount(v);
                  setSelectedPackage(null);
                }}
              />
            </View>
          </View>
        )}

        {/* ── Step 1: Date & Location ── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Event Date & Location
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              When and where is your event?
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
              Event Date *
            </Text>
            <SimpleDatePicker value={eventDate} onChange={setEventDate} colors={colors} />

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium", marginTop: 20 }]}>
              Event Location
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular" }]}
              placeholder="e.g. Dar es Salaam, Julius Nyerere Hall"
              placeholderTextColor={colors.mutedForeground}
              value={eventLocation}
              onChangeText={setEventLocation}
            />
          </View>
        )}

        {/* ── Step 2: Special Requests ── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Special Requests
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Any specific requirements or instructions for the vendor?
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
              Notes (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular" },
              ]}
              placeholder="Describe your needs, preferences, theme, etc."
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Summary card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                Booking Summary
              </Text>
              <SummaryRow label="Vendor" value={vendor?.businessName ?? ""} colors={colors} />
              {selectedPackage && <SummaryRow label="Package" value={selectedPackage.name} colors={colors} />}
              {eventDate && (
                <SummaryRow label="Date" value={eventDate.toLocaleDateString("en-TZ", { day: "numeric", month: "long", year: "numeric" })} colors={colors} />
              )}
              {eventLocation && <SummaryRow label="Location" value={eventLocation} colors={colors} />}
            </View>
          </View>
        )}

        {/* ── Step 3: Review & Pay ── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Review & Pay
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Funds are held securely in escrow until service is completed
            </Text>

            {/* Escrow explainer */}
            <View style={[styles.escrowBanner, { backgroundColor: colors.primary + "12", borderRadius: colors.radius, borderColor: colors.primary + "30" }]}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={[styles.escrowText, { color: colors.primary, fontFamily: "Poppins_400Regular" }]}>
                Your payment is protected by AlloPlan Escrow. Funds are released to the vendor only after you confirm service completion.
              </Text>
            </View>

            {/* Booking details */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                Order Details
              </Text>
              <SummaryRow label="Vendor" value={vendor?.businessName ?? ""} colors={colors} />
              {selectedPackage && <SummaryRow label="Package" value={selectedPackage.name} colors={colors} />}
              {eventDate && (
                <SummaryRow
                  label="Event Date"
                  value={eventDate.toLocaleDateString("en-TZ", { day: "numeric", month: "long", year: "numeric" })}
                  colors={colors}
                />
              )}
              {eventLocation && <SummaryRow label="Location" value={eventLocation} colors={colors} />}
            </View>

            {/* Payment breakdown */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                Payment Breakdown
              </Text>
              <SummaryRow label="Service Amount" value={`TZS ${totalAmount.toLocaleString()}`} colors={colors} />
              <SummaryRow label="Platform Fee (5%)" value={`TZS ${platformFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} colors={colors} muted />
              <SummaryRow label="Vendor Receives" value={`TZS ${vendorAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} colors={colors} muted />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>Total to Pay</Text>
                <Text style={[styles.totalAmount, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
                  TZS {totalAmount.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Wallet balance */}
            <View style={[styles.walletRow, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: hasEnoughBalance ? colors.border : "#EF4444" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.walletLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  Wallet Balance
                </Text>
                <Text style={[styles.walletAmount, { color: hasEnoughBalance ? colors.foreground : "#EF4444", fontFamily: "Poppins_700Bold" }]}>
                  TZS {walletBalance.balance.toLocaleString()}
                </Text>
                {!hasEnoughBalance && (
                  <Text style={[{ color: "#EF4444", fontFamily: "Poppins_400Regular", fontSize: 12, marginTop: 2 }]}>
                    Shortfall: TZS {(totalAmount - walletBalance.balance).toLocaleString()}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowTopUpModal(true)}
                style={[styles.topUpBtn, { backgroundColor: colors.secondary, borderRadius: 8 }]}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={[{ color: colors.primary, fontFamily: "Poppins_600SemiBold", fontSize: 13 }]}>Top Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12 }]}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            testID="next-step-btn"
            onPress={() => setStep(step + 1)}
            disabled={!canGoNext()}
            style={[
              styles.primaryBtn,
              { backgroundColor: canGoNext() ? colors.primary : colors.muted, borderRadius: colors.radius },
            ]}
          >
            <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>
              Continue
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID="confirm-booking-btn"
            onPress={handleConfirmBooking}
            disabled={submitting || totalAmount <= 0}
            style={[
              styles.primaryBtn,
              { backgroundColor: submitting || totalAmount <= 0 ? colors.muted : colors.primary, borderRadius: colors.radius },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>
                  {hasEnoughBalance ? "Confirm & Pay" : "Top Up to Continue"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Top-Up Modal */}
      <Modal visible={showTopUpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderRadius: colors.radius }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Top Up Wallet
            </Text>
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 14, marginBottom: 16 }]}>
              Add funds via mobile money (M-Pesa, Tigo, Airtel). Demo mode — funds credited instantly.
            </Text>
            {["20000", "50000", "100000", "200000"].map((amt) => (
              <TouchableOpacity
                key={amt}
                onPress={() => setTopUpAmount(amt)}
                style={[
                  styles.amountChip,
                  {
                    backgroundColor: topUpAmount === amt ? colors.primary : colors.secondary,
                    borderRadius: 8,
                  },
                ]}
              >
                <Text style={[{ color: topUpAmount === amt ? "#fff" : colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                  TZS {parseInt(amt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium", marginTop: 12 }]}>
              Custom Amount
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular" }]}
              keyboardType="numeric"
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              placeholder="Enter amount"
              placeholderTextColor={colors.mutedForeground}
            />
            <TouchableOpacity
              onPress={handleTopUp}
              disabled={toppingUp}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, marginTop: 8 }]}
            >
              {toppingUp ? <ActivityIndicator color="#fff" /> : (
                <Text style={[styles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Add Funds</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTopUpModal(false)} style={styles.cancelBtn}>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 14 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryRow({ label, value, colors, muted }: { label: string; value: string; colors: ReturnType<typeof useColors>; muted?: boolean }) {
  return (
    <View style={srStyles.row}>
      <Text style={[srStyles.label, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{label}</Text>
      <Text style={[srStyles.value, { color: muted ? colors.mutedForeground : colors.foreground, fontFamily: "Poppins_500Medium" }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const srStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontSize: 13, flex: 1 },
  value: { fontSize: 13, flex: 1, textAlign: "right" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18 },
  headerSub: { fontSize: 12, marginTop: 1 },
  content: { padding: 20, gap: 0 },
  stepContent: { gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 30 },
  sectionSub: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  serviceLabel: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  packageCard: { padding: 16, borderWidth: 1.5, marginBottom: 10, gap: 6 },
  packageTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  packageName: { fontSize: 15, flex: 1 },
  packagePrice: { fontSize: 15 },
  packageDesc: { fontSize: 13, lineHeight: 18 },
  inclusions: { gap: 4, marginTop: 4 },
  inclusionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  inclusionText: { fontSize: 12 },
  selectedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  selectedText: { color: "#fff", fontSize: 11 },
  emptyBox: { alignItems: "center", padding: 32, borderWidth: 1, borderStyle: "dashed" },
  customBox: { padding: 16, borderWidth: 1, marginTop: 8 },
  customLabel: { fontSize: 14, marginBottom: 8 },
  fieldLabel: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  textArea: { minHeight: 120 },
  summaryCard: { padding: 16, borderWidth: 1, marginTop: 12 },
  summaryTitle: { fontSize: 15, marginBottom: 10 },
  escrowBanner: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 10, borderWidth: 1 },
  escrowText: { fontSize: 13, lineHeight: 19, flex: 1 },
  divider: { height: 1, marginVertical: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 16 },
  totalAmount: { fontSize: 18 },
  walletRow: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, gap: 12, marginTop: 4 },
  walletLabel: { fontSize: 12 },
  walletAmount: { fontSize: 18 },
  topUpBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  bottomBar: { padding: 16, borderTopWidth: 1 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { padding: 24, gap: 8, margin: 8, marginBottom: 24 },
  modalTitle: { fontSize: 20, marginBottom: 4 },
  amountChip: { padding: 12, alignItems: "center", marginBottom: 4 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
});
