import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";

interface VendorCard {
  id: number;
  businessName?: string | null;
  bio?: string | null;
  businessType?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount: number;
  verified: boolean;
  subscriptionTier: string;
  coverImage?: string | null;
  isAvailable: boolean;
  ownerName: string;
  isFeatured: boolean;
  isTopRated: boolean;
  minPrice?: number | null;
}

/**
 * Approximate pixel positions for each city within the 300×280 map canvas,
 * derived from real Tanzania geographic coordinates projected onto the canvas.
 *
 * Longitude range: ~29°E (west border) – ~41°E (east coast)  → x ∈ [10, 290]
 * Latitude range:  ~1°S (north border) – ~11.5°S (south border) → y ∈ [10, 270]
 */
const CITY_CENTERS: Record<string, { x: number; y: number }> = {
  "Dar es Salaam": { x: 255, y: 162 }, // 39.3°E, 6.8°S
  Arusha:          { x: 178, y: 57  }, // 36.7°E, 3.4°S
  Mwanza:          { x: 74,  y: 40  }, // 32.9°E, 2.5°S
  Dodoma:          { x: 150, y: 140 }, // 35.7°E, 6.2°S
  Mbeya:           { x: 90,  y: 220 }, // 33.4°E, 8.9°S
  Tanga:           { x: 258, y: 95  }, // 39.1°E, 5.1°S
  Morogoro:        { x: 200, y: 162 }, // 37.7°E, 6.8°S
  Zanzibar:        { x: 272, y: 148 }, // 39.2°E, 6.2°S
  Kilimanjaro:     { x: 190, y: 52  }, // 37.3°E, 3.1°S
};

const DEFAULT_CENTER = { x: 140, y: 140 };

const CATEGORY_ICONS: Record<string, string> = {
  photography: "📷",
  decoration: "🌸",
  catering: "🍽️",
  music: "🎵",
  venue: "🏛️",
  transport: "🚗",
  makeup: "💄",
  mc: "🎤",
  florist: "💐",
};

/** Spread vendors around their city centre; offset is deterministic by index. */
function getPinPosition(cityCenter: { x: number; y: number }, idx: number): { x: number; y: number } {
  const OFFSETS: Array<[number, number]> = [
    [0, 0], [14, -12], [-14, 10], [20, 12], [-20, -8],
    [8, 20], [-8, -20], [24, -4], [-24, 4], [4, 28],
  ];
  const [dx, dy] = OFFSETS[idx % OFFSETS.length] ?? [0, 0];
  return {
    x: Math.max(8, Math.min(272, cityCenter.x + dx)),
    y: Math.max(8, Math.min(258, cityCenter.y + dy)),
  };
}

const LOCATIONS = Object.keys(CITY_CENTERS);

function VendorMapPin({
  vendor,
  x,
  y,
  selected,
  onPress,
  colors,
}: {
  vendor: VendorCard;
  x: number;
  y: number;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      testID={`map-pin-${vendor.id}`}
      onPress={onPress}
      style={[
        styles.pin,
        {
          left: x,
          top: y,
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          zIndex: selected ? 10 : 1,
        },
      ]}
    >
      <Text style={styles.pinEmoji}>
        {CATEGORY_ICONS[vendor.businessType?.toLowerCase() ?? ""] ?? "📍"}
      </Text>
      {selected && (
        <Text
          style={[styles.pinLabel, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}
          numberOfLines={1}
        >
          {vendor.businessName || vendor.ownerName}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function VendorMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState("Dar es Salaam");
  const [selectedVendor, setSelectedVendor] = useState<VendorCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ vendors: VendorCard[] }>(
        `/vendors?location=${encodeURIComponent(selectedLocation)}&limit=30`,
      );
      setVendors(data.vendors);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    load();
    setSelectedVendor(null);
  }, [load]);

  const cityCenter = CITY_CENTERS[selectedLocation] ?? DEFAULT_CENTER;

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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Vendor Map
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {/* City filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.locationRow}
        >
          {LOCATIONS.map((loc) => (
            <TouchableOpacity
              key={loc}
              testID={`location-${loc}`}
              onPress={() => setSelectedLocation(loc)}
              style={[
                styles.locationChip,
                {
                  backgroundColor: selectedLocation === loc ? colors.primary : colors.card,
                  borderColor: selectedLocation === loc ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.locationText,
                  {
                    color: selectedLocation === loc ? "#fff" : colors.foreground,
                    fontFamily:
                      selectedLocation === loc ? "Poppins_600SemiBold" : "Poppins_400Regular",
                  },
                ]}
              >
                {loc}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Schematic map canvas */}
      <View
        style={[
          styles.mapArea,
          { backgroundColor: colors.muted, borderBottomColor: colors.border },
        ]}
      >
        {/* Road grid */}
        <View style={styles.mapGrid}>
          <View style={[styles.roadH, { top: "30%", backgroundColor: colors.border }]} />
          <View style={[styles.roadH, { top: "60%", backgroundColor: colors.border }]} />
          <View style={[styles.roadV, { left: "35%", backgroundColor: colors.border }]} />
          <View style={[styles.roadV, { left: "65%", backgroundColor: colors.border }]} />
        </View>

        {/* City label */}
        <View
          style={[
            styles.locationLabel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text
            style={[
              styles.locationLabelText,
              { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
            ]}
          >
            {selectedLocation}
          </Text>
        </View>

        {/* City-centre crosshair */}
        <View
          style={[
            styles.cityMarker,
            { left: cityCenter.x - 6, top: cityCenter.y - 6, borderColor: colors.primary + "50" },
          ]}
        />

        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : vendors.length === 0 ? (
          <View style={styles.mapEmpty}>
            <Text
              style={[
                styles.mapEmptyText,
                { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
              ]}
            >
              No vendors in {selectedLocation}
            </Text>
          </View>
        ) : (
          vendors.map((vendor, idx) => {
            const pos = getPinPosition(cityCenter, idx);
            return (
              <VendorMapPin
                key={vendor.id}
                vendor={vendor}
                x={pos.x}
                y={pos.y}
                selected={selectedVendor?.id === vendor.id}
                onPress={() =>
                  setSelectedVendor(selectedVendor?.id === vendor.id ? null : vendor)
                }
                colors={colors}
              />
            );
          })
        )}
      </View>

      {/* Selected vendor card */}
      {selectedVendor && (
        <TouchableOpacity
          testID="selected-vendor-card"
          onPress={() => router.push(`/vendor/${selectedVendor.id}` as never)}
          style={[
            styles.selectedCard,
            { backgroundColor: colors.card, borderColor: colors.primary },
          ]}
        >
          <View
            style={[
              styles.selectedCover,
              { backgroundColor: colors.secondary, borderRadius: 10, overflow: "hidden" },
            ]}
          >
            {selectedVendor.coverImage ? (
              <Image
                source={{ uri: selectedVendor.coverImage }}
                style={styles.selectedCoverImg}
              />
            ) : (
              <View
                style={[
                  styles.selectedCoverPlaceholder,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Ionicons name="storefront-outline" size={28} color={colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.selectedInfo}>
            <View style={styles.selectedNameRow}>
              <Text
                style={[
                  styles.selectedName,
                  { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
                ]}
                numberOfLines={1}
              >
                {selectedVendor.businessName || selectedVendor.ownerName}
              </Text>
              {selectedVendor.verified && (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              )}
            </View>
            {selectedVendor.businessType && (
              <Text
                style={[
                  styles.selectedType,
                  { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
                ]}
              >
                {selectedVendor.businessType}
              </Text>
            )}
            <View style={styles.selectedMeta}>
              <Ionicons name="star" size={12} color={colors.accent} />
              <Text
                style={[
                  styles.selectedRating,
                  { color: colors.foreground, fontFamily: "Poppins_500Medium" },
                ]}
              >
                {selectedVendor.rating ? selectedVendor.rating.toFixed(1) : "New"}
              </Text>
              {selectedVendor.minPrice && (
                <Text
                  style={[
                    styles.selectedPrice,
                    { color: colors.primary, fontFamily: "Poppins_600SemiBold" },
                  ]}
                >
                  · From TZS {selectedVendor.minPrice.toLocaleString()}
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Vendor list */}
      <FlatList
        data={vendors}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.listRow,
          { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 },
        ]}
        ListHeaderComponent={
          <Text
            style={[
              styles.listHeader,
              { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
            ]}
          >
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} in {selectedLocation}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`list-vendor-${item.id}`}
            onPress={() => setSelectedVendor(item)}
            style={[
              styles.listCard,
              {
                backgroundColor: colors.card,
                borderColor:
                  selectedVendor?.id === item.id ? colors.primary : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View
              style={[
                styles.listCover,
                {
                  backgroundColor: colors.secondary,
                  borderRadius: colors.radius,
                  overflow: "hidden",
                },
              ]}
            >
              {item.coverImage ? (
                <Image source={{ uri: item.coverImage }} style={styles.listCoverImg} />
              ) : (
                <Ionicons name="storefront-outline" size={20} color={colors.primary} />
              )}
            </View>
            <Text
              style={[
                styles.listName,
                { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
              ]}
              numberOfLines={1}
            >
              {item.businessName || item.ownerName}
            </Text>
            {item.businessType && (
              <Text
                style={[
                  styles.listType,
                  { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
                ]}
                numberOfLines={1}
              >
                {item.businessType}
              </Text>
            )}
            <View style={styles.listRating}>
              <Ionicons name="star" size={10} color={colors.accent} />
              <Text
                style={[
                  styles.listRatingText,
                  { color: colors.foreground, fontFamily: "Poppins_500Medium" },
                ]}
              >
                {item.rating ? item.rating.toFixed(1) : "New"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text
              style={[
                styles.emptyText,
                { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
              ]}
            >
              No vendors found in this area
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18 },
  locationRow: { gap: 8, paddingHorizontal: 2 },
  locationChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  locationText: { fontSize: 13 },
  mapArea: {
    height: 300,
    position: "relative",
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  mapGrid: { ...StyleSheet.absoluteFillObject },
  roadH: { position: "absolute", left: 0, right: 0, height: 2, opacity: 0.4 },
  roadV: { position: "absolute", top: 0, bottom: 0, width: 2, opacity: 0.4 },
  cityMarker: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  locationLabel: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  locationLabelText: { fontSize: 12 },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapEmptyText: { fontSize: 14 },
  pin: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    maxWidth: 140,
  },
  pinEmoji: { fontSize: 14 },
  pinLabel: { fontSize: 11, flexShrink: 1 },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderTopWidth: 2,
    borderBottomWidth: 1,
  },
  selectedCover: { width: 56, height: 56 },
  selectedCoverImg: { width: "100%", height: "100%", resizeMode: "cover" },
  selectedCoverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  selectedInfo: { flex: 1, gap: 3 },
  selectedNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  selectedName: { flex: 1, fontSize: 15 },
  selectedType: { fontSize: 12 },
  selectedMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  selectedRating: { fontSize: 13 },
  selectedPrice: { fontSize: 12 },
  listRow: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  listHeader: { fontSize: 14, alignSelf: "center", marginRight: 8 },
  listCard: { width: 120, padding: 10, borderWidth: 1, gap: 6, alignItems: "center" },
  listCover: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  listCoverImg: { width: "100%", height: "100%", resizeMode: "cover" },
  listName: { fontSize: 12, textAlign: "center" },
  listType: { fontSize: 10, textAlign: "center" },
  listRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  listRatingText: { fontSize: 11 },
  emptyText: { fontSize: 13 },
});
