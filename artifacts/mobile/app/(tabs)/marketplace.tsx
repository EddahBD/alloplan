import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  { id: "all", label: "All", icon: "grid-outline" as const },
  { id: "photography", label: "Photography", icon: "camera-outline" as const },
  { id: "decoration", label: "Decoration", icon: "color-palette-outline" as const },
  { id: "catering", label: "Catering", icon: "restaurant-outline" as const },
  { id: "music", label: "DJ / Music", icon: "musical-notes-outline" as const },
  { id: "venue", label: "Venues", icon: "location-outline" as const },
  { id: "transport", label: "Transport", icon: "car-outline" as const },
  { id: "makeup", label: "Makeup", icon: "brush-outline" as const },
  { id: "mc", label: "MC", icon: "mic-outline" as const },
];

export default function MarketplaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          Marketplace
        </Text>
        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.muted, borderRadius: colors.radius },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}
            placeholder="Search vendors, services..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="marketplace-search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                testID={`category-${cat.id}`}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: 999,
                  },
                ]}
              >
                <Ionicons name={cat.icon} size={14} color={active ? "#fff" : colors.mutedForeground} />
                <Text
                  style={[
                    styles.categoryLabel,
                    {
                      color: active ? "#fff" : colors.mutedForeground,
                      fontFamily: "Poppins_500Medium",
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Empty / Coming soon state */}
      <ScrollView
        contentContainerStyle={[
          styles.emptyContainer,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
      >
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary, borderRadius: 40 }]}>
            <Ionicons name="storefront-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            Vendors Coming Soon
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            We're onboarding top vendors for your area. Check back soon or be the first to list your services.
          </Text>
          <TouchableOpacity
            style={[styles.vendorCTA, { backgroundColor: colors.primary, borderRadius: colors.radius / 2 }]}
            testID="become-vendor"
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={[styles.vendorCTAText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              List Your Services
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats teaser */}
        <View style={[styles.statsRow]}>
          {[
            { label: "Vendors", value: "500+", icon: "people-outline" as const },
            { label: "Services", value: "1,200+", icon: "briefcase-outline" as const },
            { label: "Cities", value: "10+", icon: "location-outline" as const },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            >
              <Ionicons name={stat.icon} size={20} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {stat.label}
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
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  title: { fontSize: 26 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, fontSize: 14 },
  categoriesRow: { gap: 8, paddingRight: 20 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  categoryLabel: { fontSize: 13 },
  emptyContainer: { flexGrow: 1, padding: 20, gap: 16 },
  emptyCard: { padding: 32, alignItems: "center", gap: 12, borderWidth: 1 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 13, lineHeight: 22, textAlign: "center" },
  vendorCTA: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  vendorCTAText: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, alignItems: "center", gap: 4, padding: 16, borderWidth: 1 },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 11 },
});
