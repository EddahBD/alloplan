import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const EVENT_TYPES = [
  { id: "wedding", label: "Wedding", icon: "heart" as const, color: "#FF6B35" },
  { id: "birthday", label: "Birthday", icon: "gift" as const, color: "#8B5CF6" },
  { id: "corporate", label: "Corporate", icon: "business" as const, color: "#1E3A5F" },
  { id: "graduation", label: "Graduation", icon: "school" as const, color: "#10B981" },
  { id: "concert", label: "Concert", icon: "musical-notes" as const, color: "#EF4444" },
];

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Array<{ id: string; name: string; type: string; date: string }>>([]);

  const handleCreateEvent = () => {
    Alert.alert(
      "Create New Event",
      "Full event creation wizard with AI assistance is coming in the next update!",
      [{ text: "OK" }]
    );
  };

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
          Event Planner
        </Text>
        <TouchableOpacity
          onPress={handleCreateEvent}
          style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius / 2 }]}
          testID="create-event-btn"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={[styles.addBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
            New Event
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
      >
        {events.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary, borderRadius: 50 }]}>
              <Ionicons name="calendar-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              No Events Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Start planning your first event. Our AI assistant will help you find the best vendors within your budget.
            </Text>
            <TouchableOpacity
              onPress={handleCreateEvent}
              style={[styles.createBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              testID="create-first-event"
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={[styles.createBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                Plan with AI
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Event type quick start */}
        <View style={styles.typeSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            Start by Event Type
          </Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                testID={`event-type-${type.id}`}
                activeOpacity={0.8}
                onPress={handleCreateEvent}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: type.color + "14",
                    borderRadius: colors.radius,
                    borderColor: type.color + "30",
                  },
                ]}
              >
                <View style={[styles.typeIcon, { backgroundColor: type.color + "22", borderRadius: 12 }]}>
                  <Ionicons name={type.icon} size={24} color={type.color} />
                </View>
                <Text style={[styles.typeLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI Planner teaser */}
        <View style={[styles.aiCard, { backgroundColor: colors.navy, borderRadius: colors.radius }]}>
          <View style={styles.aiHeader}>
            <View style={[styles.aiIcon, { backgroundColor: colors.primary + "33", borderRadius: 12 }]}>
              <Ionicons name="sparkles" size={24} color={colors.primary} />
            </View>
            <View style={styles.aiText}>
              <Text style={[styles.aiTitle, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                AI Event Assistant
              </Text>
              <Text style={[styles.aiSub, { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular" }]}>
                Tell us your budget and we plan everything
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.aiBubble, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: colors.radius / 2 }]}
            onPress={handleCreateEvent}
          >
            <Text style={[styles.aiBubbleText, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>
              "Nataka harusi ya watu 300 budget 5M..."
            </Text>
            <View style={[styles.aiSend, { backgroundColor: colors.primary, borderRadius: colors.radius / 2 }]}>
              <Ionicons name="send" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Budget calculator teaser */}
        <View style={[styles.budgetCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          <View style={styles.budgetHeader}>
            <Ionicons name="calculator-outline" size={24} color={colors.accent} />
            <Text style={[styles.budgetTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Smart Budget Engine
            </Text>
          </View>
          <Text style={[styles.budgetSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Enter your total budget and we'll auto-allocate across venues, catering, photography, and more.
          </Text>
          {[
            { label: "Venue", pct: "40%", color: "#FF6B35" },
            { label: "Catering", pct: "20%", color: "#8B5CF6" },
            { label: "Photography", pct: "15%", color: "#10B981" },
            { label: "Decoration", pct: "15%", color: "#FFD166" },
            { label: "Other", pct: "10%", color: "#6B7689" },
          ].map((item) => (
            <View key={item.label} style={styles.budgetRow}>
              <View style={[styles.budgetDot, { backgroundColor: item.color }]} />
              <Text style={[styles.budgetLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {item.label}
              </Text>
              <View style={styles.budgetBarTrack}>
                <View style={[styles.budgetBar, { backgroundColor: item.color, width: item.pct as `${number}%` }]} />
              </View>
              <Text style={[styles.budgetPct, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                {item.pct}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { fontSize: 14 },
  content: { padding: 20, gap: 20 },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 20 },
  emptyIcon: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: "center", paddingHorizontal: 20 },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  createBtnText: { fontSize: 15 },
  typeSection: { gap: 12 },
  sectionTitle: { fontSize: 17 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  typeCard: { width: "47%", padding: 16, alignItems: "center", gap: 10, borderWidth: 1 },
  typeIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 13 },
  aiCard: { padding: 20, gap: 16 },
  aiHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  aiIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  aiText: { gap: 2 },
  aiTitle: { fontSize: 16 },
  aiSub: { fontSize: 12 },
  aiBubble: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  aiBubbleText: { flex: 1, fontSize: 13 },
  aiSend: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  budgetCard: { padding: 20, gap: 12, borderWidth: 1 },
  budgetHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  budgetTitle: { fontSize: 16 },
  budgetSub: { fontSize: 13, lineHeight: 20 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetDot: { width: 8, height: 8, borderRadius: 4 },
  budgetLabel: { width: 90, fontSize: 13 },
  budgetBarTrack: { flex: 1, height: 6, backgroundColor: "#E8ECF4", borderRadius: 3, overflow: "hidden" },
  budgetBar: { height: 6, borderRadius: 3 },
  budgetPct: { fontSize: 13, width: 36, textAlign: "right" },
});
