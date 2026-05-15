import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: number;
  name: string;
  type: string;
  eventDate?: string | null;
  guestCount?: number | null;
  location?: string | null;
  totalBudget?: number | null;
  status: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { id: "wedding", label: "Wedding", icon: "heart" as const, color: "#FF6B35" },
  { id: "birthday", label: "Birthday", icon: "gift" as const, color: "#8B5CF6" },
  { id: "corporate", label: "Corporate", icon: "business" as const, color: "#1E3A5F" },
  { id: "graduation", label: "Graduation", icon: "school" as const, color: "#10B981" },
  { id: "concert", label: "Concert", icon: "musical-notes" as const, color: "#EF4444" },
  { id: "engagement", label: "Engagement", icon: "diamond" as const, color: "#EC4899" },
  { id: "babyshower", label: "Baby Shower", icon: "star" as const, color: "#F59E0B" },
  { id: "other", label: "Other", icon: "calendar" as const, color: "#6B7280" },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  planning: { color: "#F59E0B", label: "Planning" },
  active: { color: "#10B981", label: "Active" },
  completed: { color: "#8B5CF6", label: "Completed" },
  cancelled: { color: "#EF4444", label: "Cancelled" },
};

// ─── Simple Date Picker ───────────────────────────────────────────────────────

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
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);

  React.useEffect(() => { onChange(new Date(year, month, clampedDay)); }, [year, month, clampedDay]);

  const nudge = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number, min: number, max: number) =>
    setter((v) => Math.max(min, Math.min(max, v + delta)));

  const counter = (label: string, val: number | string, onDec: () => void, onInc: () => void) => (
    <View style={dpStyles.counter}>
      <Text style={[dpStyles.label, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{label}</Text>
      <View style={dpStyles.controls}>
        <TouchableOpacity onPress={onDec} style={[dpStyles.btn, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
          <Ionicons name="remove" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[dpStyles.val, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>{val}</Text>
        <TouchableOpacity onPress={onInc} style={[dpStyles.btn, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
          <Ionicons name="add" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[dpStyles.wrapper, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border }]}>
      {counter("Day", clampedDay, () => nudge(setDay, -1, 1, daysInMonth), () => nudge(setDay, 1, 1, daysInMonth))}
      {counter("Month", MONTHS[month], () => nudge(setMonth, -1, 0, 11), () => nudge(setMonth, 1, 0, 11))}
      {counter("Year", year, () => nudge(setYear, -1, today.getFullYear(), 2035), () => nudge(setYear, 1, today.getFullYear(), 2035))}
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

// ─── Create Event Wizard ──────────────────────────────────────────────────────

const WIZARD_STEPS = ["Event Type", "Date & Name", "Guests & Venue", "Budget", "Confirm"];

function CreateEventWizard({
  onClose,
  onCreated,
  colors,
}: {
  onClose: () => void;
  onCreated: (event: Event) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState("");
  const [location, setLocation] = useState("");
  const [totalBudget, setTotalBudget] = useState("");

  const canNext = () => {
    if (step === 0) return eventType !== "";
    if (step === 1) return eventName.trim() !== "" && eventDate !== null;
    return true;
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const event = await apiRequest<Event>("/events", {
        method: "POST",
        body: JSON.stringify({
          name: eventName.trim(),
          type: eventType,
          eventDate: eventDate?.toISOString(),
          guestCount: guestCount ? parseInt(guestCount) : undefined,
          location: location.trim() || undefined,
          totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
        }),
      });
      onCreated(event);
    } catch (e: unknown) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Could not create event");
    } finally {
      setSaving(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[wStyles.container, { backgroundColor: colors.background }]}>
      {/* Wizard header */}
      <View style={[wStyles.header, { borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12 }]}>
        <TouchableOpacity onPress={onClose} style={wStyles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[wStyles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Create Event
          </Text>
          <Text style={[wStyles.sub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Step {step + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[step]}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View style={wStyles.progress}>
        {WIZARD_STEPS.map((_, i) => (
          <View key={i} style={[wStyles.progressSeg, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={[wStyles.content, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
        {/* Step 0: Event Type */}
        {step === 0 && (
          <View style={wStyles.step}>
            <Text style={[wStyles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              What type of event?
            </Text>
            <Text style={[wStyles.sectionSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Select the category that best describes your event
            </Text>
            <View style={wStyles.typeGrid}>
              {EVENT_TYPES.map((et) => (
                <TouchableOpacity
                  key={et.id}
                  testID={`event-type-${et.id}`}
                  onPress={() => setEventType(et.id)}
                  style={[
                    wStyles.typeCard,
                    {
                      backgroundColor: eventType === et.id ? et.color + "15" : colors.card,
                      borderColor: eventType === et.id ? et.color : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <View style={[wStyles.typeIcon, { backgroundColor: et.color + "20" }]}>
                    <Ionicons name={et.icon} size={24} color={et.color} />
                  </View>
                  <Text style={[wStyles.typeLabel, { color: colors.foreground, fontFamily: eventType === et.id ? "Poppins_600SemiBold" : "Poppins_400Regular" }]}>
                    {et.label}
                  </Text>
                  {eventType === et.id && (
                    <View style={[wStyles.selectedDot, { backgroundColor: et.color }]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 1: Date & Name */}
        {step === 1 && (
          <View style={wStyles.step}>
            <Text style={[wStyles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Event Name & Date
            </Text>
            <Text style={[wStyles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
              Event Name *
            </Text>
            <TextInput
              style={[wStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular" }]}
              placeholder="e.g. Amina & John's Wedding"
              placeholderTextColor={colors.mutedForeground}
              value={eventName}
              onChangeText={setEventName}
            />
            <Text style={[wStyles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium", marginTop: 16 }]}>
              Event Date *
            </Text>
            <SimpleDatePicker value={eventDate} onChange={setEventDate} colors={colors} />
            {eventDate && (
              <Text style={[{ color: colors.primary, fontFamily: "Poppins_500Medium", fontSize: 13, marginTop: 6 }]}>
                Selected: {eventDate.toLocaleDateString("en-TZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </Text>
            )}
          </View>
        )}

        {/* Step 2: Guests & Venue */}
        {step === 2 && (
          <View style={wStyles.step}>
            <Text style={[wStyles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Guests & Venue
            </Text>
            <Text style={[wStyles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
              Expected Guest Count
            </Text>
            <View style={wStyles.guestRow}>
              {["50", "100", "200", "300", "500", "1000"].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setGuestCount(n)}
                  style={[wStyles.guestChip, { backgroundColor: guestCount === n ? colors.primary : colors.secondary, borderRadius: 8 }]}
                >
                  <Text style={[{ color: guestCount === n ? "#fff" : colors.foreground, fontFamily: "Poppins_500Medium", fontSize: 13 }]}>
                    {parseInt(n).toLocaleString()}+
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[wStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular", marginTop: 8 }]}
              placeholder="Custom count, e.g. 150"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={guestCount}
              onChangeText={setGuestCount}
            />
            <Text style={[wStyles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium", marginTop: 16 }]}>
              Event Venue / Location
            </Text>
            <TextInput
              style={[wStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular" }]}
              placeholder="e.g. Mlimani City Hall, Dar es Salaam"
              placeholderTextColor={colors.mutedForeground}
              value={location}
              onChangeText={setLocation}
            />
          </View>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <View style={wStyles.step}>
            <Text style={[wStyles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Event Budget
            </Text>
            <Text style={[wStyles.sectionSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Your total event budget helps us match the best vendors for you
            </Text>
            <View style={wStyles.budgetGrid}>
              {[
                { label: "Under 1M", value: "1000000" },
                { label: "1M – 5M", value: "5000000" },
                { label: "5M – 10M", value: "10000000" },
                { label: "10M – 30M", value: "30000000" },
                { label: "30M+", value: "50000000" },
              ].map((b) => (
                <TouchableOpacity
                  key={b.value}
                  onPress={() => setTotalBudget(b.value)}
                  style={[
                    wStyles.budgetCard,
                    {
                      backgroundColor: totalBudget === b.value ? colors.primary + "15" : colors.card,
                      borderColor: totalBudget === b.value ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={[{ color: totalBudget === b.value ? colors.primary : colors.foreground, fontFamily: totalBudget === b.value ? "Poppins_600SemiBold" : "Poppins_400Regular", fontSize: 14 }]}>
                    TZS {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[wStyles.fieldLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium", marginTop: 12 }]}>
              Custom Budget (TZS)
            </Text>
            <TextInput
              style={[wStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Poppins_400Regular" }]}
              placeholder="e.g. 8000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={totalBudget}
              onChangeText={setTotalBudget}
            />
          </View>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <View style={wStyles.step}>
            <Text style={[wStyles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              Confirm Event
            </Text>
            <View style={[wStyles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {(() => {
                const et = EVENT_TYPES.find((t) => t.id === eventType);
                return et ? (
                  <View style={[wStyles.typeIconLg, { backgroundColor: et.color + "20", borderRadius: 16 }]}>
                    <Ionicons name={et.icon} size={36} color={et.color} />
                  </View>
                ) : null;
              })()}
              <Text style={[wStyles.confirmName, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {eventName}
              </Text>
              <Text style={[wStyles.confirmType, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                {EVENT_TYPES.find((t) => t.id === eventType)?.label ?? eventType}
              </Text>

              <View style={[wStyles.confirmDivider, { backgroundColor: colors.border }]} />

              {eventDate && (
                <ConfirmRow icon="calendar-outline" value={eventDate.toLocaleDateString("en-TZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} colors={colors} />
              )}
              {guestCount && (
                <ConfirmRow icon="people-outline" value={`${parseInt(guestCount).toLocaleString()} guests`} colors={colors} />
              )}
              {location && (
                <ConfirmRow icon="location-outline" value={location} colors={colors} />
              )}
              {totalBudget && (
                <ConfirmRow icon="cash-outline" value={`TZS ${parseFloat(totalBudget).toLocaleString()} budget`} colors={colors} />
              )}
            </View>

            <View style={[wStyles.tipBox, { backgroundColor: colors.primary + "10", borderRadius: colors.radius, borderColor: colors.primary + "25" }]}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={[wStyles.tipText, { color: colors.primary, fontFamily: "Poppins_400Regular" }]}>
                After creating your event, browse the marketplace to book vendors that match your budget and location.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[wStyles.bottomBar, { borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12 }]}>
        {step < WIZARD_STEPS.length - 1 ? (
          <TouchableOpacity
            testID="wizard-next-btn"
            onPress={() => setStep(step + 1)}
            disabled={!canNext()}
            style={[wStyles.primaryBtn, { backgroundColor: canNext() ? colors.primary : colors.muted, borderRadius: colors.radius }]}
          >
            <Text style={[wStyles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID="create-event-confirm-btn"
            onPress={handleCreate}
            disabled={saving}
            style={[wStyles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={[wStyles.primaryBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Create Event</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ConfirmRow({ icon, value, colors }: { icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={crStyles.row}>
      <Ionicons name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[crStyles.text, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{value}</Text>
    </View>
  );
}
const crStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  text: { fontSize: 14 },
});

const wStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  closeBtn: { padding: 4 },
  title: { fontSize: 18 },
  sub: { fontSize: 12, marginTop: 1 },
  progress: { flexDirection: "row", gap: 4, margin: 16, marginBottom: 0 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  content: { padding: 20, gap: 0 },
  step: { gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 30 },
  sectionSub: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "47%", padding: 16, borderWidth: 1.5, alignItems: "center", gap: 8, position: "relative" },
  typeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 13 },
  selectedDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  fieldLabel: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  guestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  guestChip: { paddingHorizontal: 14, paddingVertical: 8 },
  budgetGrid: { gap: 8 },
  budgetCard: { padding: 14, borderWidth: 1, alignItems: "center" },
  confirmCard: { padding: 20, borderWidth: 1, alignItems: "center", gap: 4 },
  typeIconLg: { width: 72, height: 72, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  confirmName: { fontSize: 22 },
  confirmType: { fontSize: 15, marginTop: 2 },
  confirmDivider: { height: 1, width: "100%", marginVertical: 12 },
  tipBox: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 10, borderWidth: 1 },
  tipText: { fontSize: 13, lineHeight: 19, flex: 1 },
  bottomBar: { padding: 16, borderTopWidth: 1 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16 },
});

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onDelete, colors }: { event: Event; onDelete: () => void; colors: ReturnType<typeof useColors> }) {
  const et = EVENT_TYPES.find((t) => t.id === event.type);
  const sc = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.planning;

  return (
    <View style={[ecStyles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={ecStyles.top}>
        <View style={[ecStyles.iconWrap, { backgroundColor: (et?.color ?? colors.primary) + "20" }]}>
          <Ionicons name={et?.icon ?? "calendar"} size={22} color={et?.color ?? colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ecStyles.name, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>{event.name}</Text>
          <Text style={[ecStyles.type, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {et?.label ?? event.type}
          </Text>
        </View>
        <View style={[ecStyles.statusBadge, { backgroundColor: sc.color + "20" }]}>
          <Text style={[ecStyles.statusText, { color: sc.color, fontFamily: "Poppins_600SemiBold" }]}>{sc.label}</Text>
        </View>
      </View>

      <View style={ecStyles.meta}>
        {event.eventDate && (
          <View style={ecStyles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
            <Text style={[ecStyles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {new Date(event.eventDate).toLocaleDateString("en-TZ", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}
        {event.guestCount && (
          <View style={ecStyles.metaItem}>
            <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
            <Text style={[ecStyles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {event.guestCount.toLocaleString()} guests
            </Text>
          </View>
        )}
        {event.totalBudget && (
          <View style={ecStyles.metaItem}>
            <Ionicons name="cash-outline" size={12} color={colors.mutedForeground} />
            <Text style={[ecStyles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              TZS {event.totalBudget.toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      <View style={ecStyles.actions}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/marketplace" as never)}
          style={[ecStyles.actionBtn, { backgroundColor: colors.primary + "15", borderRadius: 8 }]}
        >
          <Ionicons name="storefront-outline" size={14} color={colors.primary} />
          <Text style={[ecStyles.actionText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
            Find Vendors
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Delete Event", "Are you sure?", [
              { text: "Cancel" },
              { text: "Delete", style: "destructive", onPress: onDelete },
            ])
          }
          style={[ecStyles.deleteBtn, { borderRadius: 8 }]}
        >
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ecStyles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, gap: 10 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15 },
  type: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  actionText: { fontSize: 13 },
  deleteBtn: { padding: 10, backgroundColor: "#EF444415" },
});

// ─── Main Planner Screen ──────────────────────────────────────────────────────

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiRequest<{ events: Event[] }>("/events/my");
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadEvents(); }, [loadEvents]));

  const onRefresh = async () => { setRefreshing(true); await loadEvents(); setRefreshing(false); };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/events/${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      Alert.alert("Failed to delete event");
    }
  };

  return (
    <>
      <View style={[planStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[planStyles.header, { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12, borderBottomColor: colors.border }]}>
          <Text style={[planStyles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Event Planner
          </Text>
          <TouchableOpacity
            testID="create-event-btn"
            onPress={() => setShowWizard(true)}
            style={[planStyles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius / 2 }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={[planStyles.addBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>New Event</Text>
          </TouchableOpacity>
        </View>

        {/* Events list */}
        <ScrollView
          contentContainerStyle={[planStyles.content, { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {loading ? (
            <View style={planStyles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : events.length === 0 ? (
            <View style={planStyles.emptyState}>
              <View style={[planStyles.emptyIcon, { backgroundColor: colors.secondary, borderRadius: 50 }]}>
                <Ionicons name="calendar-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[planStyles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                No Events Yet
              </Text>
              <Text style={[planStyles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                Create your first event and start booking vendors to make it unforgettable.
              </Text>
              <TouchableOpacity
                testID="create-first-event-btn"
                onPress={() => setShowWizard(true)}
                style={[planStyles.createBtn, { backgroundColor: colors.primary, borderRadius: 12 }]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={[planStyles.createBtnText, { fontFamily: "Poppins_600SemiBold" }]}>Create My First Event</Text>
              </TouchableOpacity>

              {/* Event type showcase */}
              <View style={[planStyles.typeShowcase, { backgroundColor: colors.card, borderRadius: 16, borderColor: colors.border }]}>
                <Text style={[{ color: colors.foreground, fontFamily: "Poppins_600SemiBold", fontSize: 15, marginBottom: 12 }]}>
                  Events We Help You Plan
                </Text>
                <View style={planStyles.typeRow}>
                  {EVENT_TYPES.slice(0, 4).map((et) => (
                    <View key={et.id} style={planStyles.typeItem}>
                      <View style={[planStyles.typeIconSm, { backgroundColor: et.color + "20" }]}>
                        <Ionicons name={et.icon} size={20} color={et.color} />
                      </View>
                      <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 11 }]}>
                        {et.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={planStyles.typeRow}>
                  {EVENT_TYPES.slice(4).map((et) => (
                    <View key={et.id} style={planStyles.typeItem}>
                      <View style={[planStyles.typeIconSm, { backgroundColor: et.color + "20" }]}>
                        <Ionicons name={et.icon} size={20} color={et.color} />
                      </View>
                      <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 11 }]}>
                        {et.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={planStyles.list}>
              {events.map((ev) => (
                <EventCard key={ev.id} event={ev} onDelete={() => handleDelete(ev.id)} colors={colors} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Wizard Modal */}
      <Modal visible={showWizard} animationType="slide" presentationStyle="fullScreen">
        <CreateEventWizard
          colors={colors}
          onClose={() => setShowWizard(false)}
          onCreated={(event) => {
            setEvents((prev) => [event, ...prev]);
            setShowWizard(false);
            Alert.alert(
              "Event Created! 🎉",
              "Browse the marketplace to find and book vendors for your event.",
              [
                { text: "Browse Vendors", onPress: () => router.push("/(tabs)/marketplace" as never) },
                { text: "Later" },
              ]
            );
          }}
        />
      </Modal>
    </>
  );
}

const planStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 26 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 14 },
  content: { padding: 16, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  list: { gap: 12 },
  emptyState: { alignItems: "center", gap: 14, paddingTop: 20, paddingHorizontal: 8 },
  emptyIcon: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: "center" },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  createBtnText: { color: "#fff", fontSize: 15 },
  typeShowcase: { width: "100%", padding: 20, borderWidth: 1, gap: 0 },
  typeRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  typeItem: { alignItems: "center", gap: 6, width: "23%" },
  typeIconSm: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
